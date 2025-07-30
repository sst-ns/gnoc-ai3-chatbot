import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  BatchGetCommand
} from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';
import ExcelJS from 'exceljs';

// AWS Clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const STATS_CACHE_KEY = 'incident-stats-cache.json';

// Helpers
const excelDateToISO = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const adjustedSerial = value > 59 ? value - 1 : value;
    return new Date(excelEpoch.getTime() + adjustedSerial * 86400000).toISOString();
  }
  return null;
};


const clean = (item) => {
  const cleaned = {};
  Object.keys(item).forEach(key => {
    if (item[key] !== null && item[key] !== undefined && item[key] !== '') {
      cleaned[key] = item[key];
    }
  });
  return cleaned;
};

const parseExcelToJson = async (s3Response) => {
  const chunks = [];
  for await (const chunk of s3Response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  const rows = [];
  let headers = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // Skip empty first element

    if (rowNumber === 1) {
      headers = values;
    } else {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = values[idx] ?? null;
      });
      rows.push(obj);
    }
  });
  return rows;
};

const normalizeData = (data) => {
  return data.map(row => {
    const incident = {
      Incident_Number: row['Incident Number'],
      Priority: row['Priority'],
      Reported_Date_Time: excelDateToISO(row['Issue Date']),
      Resolved_Date_Time: excelDateToISO(row['End Date']),
      Time_Taken_to_Resolve: row['Downtime'] ? String(row['Downtime']) : null,
      Root_Cause: row['--------RFO----------'],
      Category: row['POA'],
      Problem_Statement: row["Impacted Site/Service"],
      Incident_Description: `Impact : ${row['--------- Business Impact -----------'] || ''}\nResolution approach:${row['Resolution approach'] || ''}`,
      CommonValue: 'Incident',
      Source: "MDB"
    };

    // Clean strings
    Object.entries(incident).forEach(([key, value]) => {
      if (typeof value === 'string') {
        incident[key] = value.trim().replace(/\s+/g, ' ') || null;
      }
    });

    return incident;
  });
};

const deduplicateData = (data) => {
  const map = new Map();
  for (const record of data) {
    if (record.Incident_Number) {
      map.set(record.Incident_Number, record);
    }
  }
  return Array.from(map.values());
};

const getExistingRcaIncidentNumbers = async (incidentNumbers, tableName) => {
  const rcaIncidentNumbers = new Set();
  const batchSize = 100;

  for (let i = 0; i < incidentNumbers.length; i += batchSize) {
    const batch = incidentNumbers.slice(i, i + batchSize);
    const command = new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: batch.map(num => ({ Incident_Number: num })),
          ProjectionExpression: "#incident, #src",
          ExpressionAttributeNames: {
            "#incident": "Incident_Number",
            "#src": "Source"
          }
        }
      }
    });

    try {
      const result = await dynamodb.send(command);
      const records = result.Responses?.[tableName] || [];
      for (const record of records) {
        if (record.Source === 'RCA') {
          rcaIncidentNumbers.add(record.Incident_Number);
        }
      }
    } catch (err) {
      console.error('Error fetching RCA incidents:', err);
    }
  }

  return rcaIncidentNumbers;
};

const batchWriteToDynamoDB = async (data, tableName, sendToClient) => {
  const batchSize = 25;
  let totalProcessed = 0;
  const maxRetries = 3;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize).map(record => ({
      PutRequest: { Item: clean(record) }
    }));

    let unprocessedItems = { [tableName]: batch };
    let retryCount = 0;

    while (unprocessedItems[tableName]?.length > 0 && retryCount < maxRetries) {
      try {
        const command = new BatchWriteCommand({
          RequestItems: unprocessedItems
        });

        const result = await dynamodb.send(command);
        
        // Handle unprocessed items
        unprocessedItems = result.UnprocessedItems || {};
        
        if (unprocessedItems[tableName]?.length > 0) {
          retryCount++;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
        
      } catch (error) {
        console.error(`Batch write error (attempt ${retryCount + 1}):`, error);
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
      }
    }

    totalProcessed += batch.length;
    
    // Send progress updates during long operations
    const progress = 80 + (i / data.length) * 15; // 80% to 95%
    await sendToClient({ 
      percentage: Math.round(progress), 
      message: `Saving to database... ${totalProcessed}/${data.length} records processed` 
    });
  }

  return totalProcessed;
};
const sendToClientFactory = (connectionId, endpoint) => {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  return async (message) => {
    try {
      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message))
      });
      await client.send(command);
    } catch (err) {
      console.error('Error sending to client:', err);
    }
  };
};

// Main handler
export const handler = async (event) => {
  const { connectionId, endpoint, bucketName, fileName, tableName } = event;
  const sendToClient = sendToClientFactory(connectionId, endpoint);

  try {
    if (!fileName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Filename is required' }) };
    }

    await sendToClient({ percentage: 10, message: `Starting extraction for "${fileName}"...` });

    const s3Response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: fileName }));

    await sendToClient({ percentage: 25, message: `File downloaded from S3. Preparing for JSON conversion...` });

    let data = await parseExcelToJson(s3Response);

    await sendToClient({ percentage: 40, message: `JSON conversion successful. Processing data...` });

    let processedData = normalizeData(data);
    console.log(processedData)
    processedData = deduplicateData(processedData);

    const allIncidentNumbers = processedData.map(r => r.Incident_Number).filter(Boolean);
    const existingRcaSet = await getExistingRcaIncidentNumbers(allIncidentNumbers, tableName);
    processedData = processedData.filter(r => !existingRcaSet.has(r.Incident_Number));

    await sendToClient({ percentage: 80, message: `Data filtered. Saving to database...` });

    const totalProcessed = await batchWriteToDynamoDB(processedData, tableName, sendToClient);
    await sendToClient({ percentage: 95, message: `Database save complete. Cleaning up...` });

    await deleteStatsCache(bucketName);
    await sendToClient({
      percentage: 100,
      message: `Extraction complete for "${fileName}". Total records processed: "${totalProcessed}".`,
    });

    return { statusCode: 200 };

  } catch (error) {
    console.error('Error processing file:', error);
    await sendToClient({
      percentage: 100,
      error: `Extraction failed for "${fileName}".`,
      details: error.message,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error during extraction', error: error.message }),
    };
  }
};

async function deleteStatsCache(bucketName) {
  try {
    const result = await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: STATS_CACHE_KEY }));
    console.log("Deleted file successfully", result);
  } catch (error) {
    console.error('deleteStatsCache error:', error);
  }
}
