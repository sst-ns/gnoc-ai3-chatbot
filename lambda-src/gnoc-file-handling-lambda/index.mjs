import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand as DocQueryCommand,
  GetCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.region });
const lambdaClient = new LambdaClient({ region: process.env.region });

const bucketName = process.env.bucket_name;
const tableName = process.env.tableName;
const lambdaFunctionName = process.env.lambdaFunctionName;
const lambdaUploadFunction = process.env.lambdaUploadFunction;
const sortIndex1 = process.env.sortIndex1;
const STATS_CACHE_KEY = 'incident-stats-cache.json';

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const sendToClient = async (apigw, connectionId, message) => {
  try {
    await apigw.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message))
    }));
  } catch (err) {
    console.error('WebSocket send error:', err);
  }
};

export const handler = async (event) => {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;
  const apigw = new ApiGatewayManagementApiClient({ endpoint });
  const body = JSON.parse(event.body || '{}');

  try {
    const {
      key, contentType, Incident_Number, Category,
      SubCategory, RcaLink, KnowledgeArticle, Priority
    } = body;

    switch (routeKey) {
      case 'upload': {
        if (!key || !contentType) {
          await sendToClient(apigw, connectionId, { error: 'Missing key/contentType' });
          return { statusCode: 400 };
        }

        const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType });
        const uploadURL = await getSignedUrl(s3, command, { expiresIn: 240 });
        await sendToClient(apigw, connectionId, { uploadURL, key });
        break;
      }

      case 'delete': {
        if (!Incident_Number) {
          await sendToClient(apigw, connectionId, { error: 'Missing Incident_Number' });
          return { statusCode: 400 };
        }

        const result = await dynamodb.send(new GetCommand({
          TableName: tableName,
          Key: { Incident_Number }
        }));

        const incidentToDelete = result.Item;
        if (!incidentToDelete) {
          await sendToClient(apigw, connectionId, { error: 'Incident not found' });
          return { statusCode: 404 };
        }

        await dynamodb.send(new DeleteCommand({ TableName: tableName, Key: { Incident_Number } }));
        const updatedStats = await updateCachedStatsOnDelete(incidentToDelete);

        await sendToClient(apigw, connectionId, { message: `Deleted ${Incident_Number}` });
        if (updatedStats) {
          await sendToClient(apigw, connectionId, {
            graph1: updatedStats.Monthly_Count_Per_Category,
            graph2: updatedStats.Monthly_Avg_Time_Taken_to_Resolve,
            graph3: updatedStats.Monthly_RCA_Count,
            graph4: updatedStats.Yearly_Priority_count,
          });
        }
        break;
      }

      case 'extract': {
        if (!key || !key.endsWith('.docx')) {
          await sendToClient(apigw, connectionId, { error: 'Invalid docx key' });
          return { statusCode: 400 };
        }

        const payload = JSON.stringify({
          connectionId, endpoint, bucketName, fileName: key, tableName,
          Category, SubCategory, RcaLink, KnowledgeArticle, Priority
        });

        await lambdaClient.send(new InvokeCommand({
          FunctionName: lambdaFunctionName,
          InvocationType: 'Event',
          Payload: Buffer.from(payload)
        }));
        break;
      }

      case 'excel': {
        if (!key) {
          await sendToClient(apigw, connectionId, { error: 'Missing Excel file key' });
          return { statusCode: 400 };
        }

        const payload = JSON.stringify({ connectionId, endpoint, bucketName, fileName: key, tableName });
        await lambdaClient.send(new InvokeCommand({
          FunctionName: lambdaUploadFunction,
          InvocationType: 'Event',
          Payload: Buffer.from(payload)
        }));
        break;
      }
      case 'fetch': {
        let stats;

        try {
          stats = await getCachedStats();
          if (stats) {
            await sendToClient(apigw, connectionId, {
              graph1: stats.Monthly_Count_Per_Category,
              graph2: stats.Monthly_Avg_Time_Taken_to_Resolve,
              graph3: stats.Monthly_RCA_Count,
              graph4: stats.Yearly_Priority_count,
              categories: stats.Unique_Categories_Array
            });
          }
        } catch (error) {
          console.warn('Failed to use cached stats. Will recalculate after full scan.', error);
        }

        let Incidents = [];
        let ExclusiveStartKey;

        do {
          const command = new DocQueryCommand({
            TableName: tableName,
            IndexName: sortIndex1,
            KeyConditionExpression: 'CommonValue = :val',
            ExpressionAttributeValues: { ':val': "Incident" },
            ScanIndexForward: false,
            ExclusiveStartKey: ExclusiveStartKey
          });

          const result = await dynamodb.send(command);
          const cleanedItems = result.Items?.map(({ CommonValue, ...rest }) => rest) || [];
          Incidents.push(...cleanedItems);

          for (let i = 0; i < cleanedItems.length; i += 10) {
            await sendToClient(apigw, connectionId, { Incidents: cleanedItems.slice(i, i + 10) });
          }

          ExclusiveStartKey = result.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        // Recalculate stats only if cache was missing or we want to refresh
        if (!stats) {
          const newStats = calculateIncidentStats(Incidents);
          await sendToClient(apigw, connectionId, {
            graph1: newStats.Monthly_Count_Per_Category,
            graph2: newStats.Monthly_Avg_Time_Taken_to_Resolve,
            graph3: newStats.Monthly_RCA_Count,
            graph4: newStats.Yearly_Priority_count,
            categories: newStats.Unique_Categories_Array
          });

          await cacheStats(newStats);
        }

        break;
      }

      case '$connect': {
        console.log('WebSocket connected');
        break;
      }

      default: {
        await sendToClient(apigw, connectionId, { error: 'Invalid routeKey' });
        return { statusCode: 400 };
      }
    }

    return { statusCode: 200 };

  } catch (err) {
    console.error('Handler error:', err);
    await sendToClient(apigw, connectionId, { error: 'Internal Server Error' });
    return { statusCode: 500 };
  }
};

// --- Utility Functions ---

function calculateIncidentStats(Incidents) {
  const Monthly_Count = {};
  const Monthly_Count_Per_Category = {};
  const Monthly_RCA_Count = {};
  const sum_TTOR = {};
  const count_TTOR = {};
  const Monthly_Avg_Time_Taken_to_Resolve = {};
  const Yearly_Priority_count = {};
  const Monthly_Priority_count = {};
  const Monthly_Count_Per_Category_Per_Priority = {};
  const Unique_Categories = new Set();
  const Yearly_Category_Count = {};

  const validPriorities = new Set(["Critical", "High", "Medium"]);

  for (const incident of Incidents) {
    if (!incident.Reported_Date_Time) continue;
    const date = new Date(incident.Reported_Date_Time);
    if (isNaN(date)) continue;

    const year = date.getFullYear();
    const monthName = monthNames[date.getMonth()];
    const category = incident.Category;
    const Source = incident.Source;
    const Priority = incident.Priority;

    if (category) Unique_Categories.add(category);

    if (!Monthly_Count[year]) {
      Monthly_Count[year] = {};
      Monthly_Count_Per_Category[year] = {};
      sum_TTOR[year] = {};
      count_TTOR[year] = {};
      Monthly_Avg_Time_Taken_to_Resolve[year] = {};
      Monthly_RCA_Count[year] = {};
      Monthly_Priority_count[year] = {};
      Monthly_Count_Per_Category_Per_Priority[year] = {};
      Yearly_Priority_count[year] = { Critical: 0, High: 0, Medium: 0 };
      Yearly_Category_Count[year] = {};

      for (const m of monthNames) {
        Monthly_Count[year][m] = 0;
        Monthly_Count_Per_Category[year][m] = {};
        sum_TTOR[year][m] = 0;
        count_TTOR[year][m] = 0;
        Monthly_Avg_Time_Taken_to_Resolve[year][m] = 0;
        Monthly_RCA_Count[year][m] = 0;
        Monthly_Priority_count[year][m] = { Critical: 0, High: 0, Medium: 0 };
        Monthly_Count_Per_Category_Per_Priority[year][m] = {};
      }
    }

    Monthly_Count[year][monthName] += 1;

    if (category) {
      if (!Monthly_Count_Per_Category[year][monthName][category]) {
        Monthly_Count_Per_Category[year][monthName][category] = 0;
      }
      Monthly_Count_Per_Category[year][monthName][category] += 1;

      if (!Yearly_Category_Count[year][category]) {
        Yearly_Category_Count[year][category] = 0;
      }
      Yearly_Category_Count[year][category] += 1;
    }

    if (Source === "RCA") {
      Monthly_RCA_Count[year][monthName] += 1;
    }

    if (Priority && validPriorities.has(Priority)) {
      Monthly_Priority_count[year][monthName][Priority] += 1;
      Yearly_Priority_count[year][Priority] += 1;
      if (category) {
        if (!Monthly_Count_Per_Category_Per_Priority[year][monthName][category]) {
          Monthly_Count_Per_Category_Per_Priority[year][monthName][category] = { Critical: 0, High: 0, Medium: 0 };
        }
        Monthly_Count_Per_Category_Per_Priority[year][monthName][category][Priority] += 1;
      }
    }

    if (incident.Time_Taken_to_Resolve) {
      const ttor = parseFloat(incident.Time_Taken_to_Resolve);
      if (!isNaN(ttor)) {
        sum_TTOR[year][monthName] += ttor;
        count_TTOR[year][monthName] += 1;
      }
    }
  }

  for (const year in sum_TTOR) {
    for (const month in sum_TTOR[year]) {
      const sum = sum_TTOR[year][month];
      const count = count_TTOR[year][month];
      Monthly_Avg_Time_Taken_to_Resolve[year][month] = count > 0 ? sum / count : 0;
    }
  }

  return {
    Monthly_Count,
    Monthly_Count_Per_Category,
    sum_TTOR,
    count_TTOR,
    Monthly_Avg_Time_Taken_to_Resolve,
    Monthly_RCA_Count,
    Yearly_Priority_count,
    Monthly_Priority_count,
    Monthly_Count_Per_Category_Per_Priority,
    Unique_Categories_Array: Array.from(Unique_Categories),
    Yearly_Category_Count
  };
}

async function getCachedStats() {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: STATS_CACHE_KEY
    }));
    const jsonString = await response.Body.transformToString();
    return JSON.parse(jsonString);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') return null;
    console.error('getCachedStats error:', error);
    throw error;
  }
}

async function cacheStats(stats) {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: STATS_CACHE_KEY,
      Body: JSON.stringify(stats),
      ContentType: 'application/json',
    });
    await s3.send(command);
    console.log('Stats cached successfully');
  } catch (error) {
    console.error('Error caching stats:', error);
  }
}

async function updateCachedStatsOnDelete(incidentToDelete) {
  try {
    const cachedStats = await getCachedStats();
    if (!cachedStats) return null;

    const {
      Monthly_Count, Monthly_Count_Per_Category, sum_TTOR, count_TTOR,
      Monthly_Avg_Time_Taken_to_Resolve, Monthly_RCA_Count, Yearly_Priority_count,
      Monthly_Priority_count, Unique_Categories_Array, Yearly_Category_Count,
      Monthly_Count_Per_Category_Per_Priority
    } = cachedStats;

    const date = new Date(incidentToDelete.Reported_Date_Time);
    if (isNaN(date)) return null;

    const year = date.getFullYear();
    const monthName = monthNames[date.getMonth()];
    const category = incidentToDelete.Category;
    const Source = incidentToDelete.Source;
    const Priority = incidentToDelete.Priority;
    const validPriorities = new Set(["Critical", "High", "Medium"]);

    if (Monthly_Count?.[year]?.[monthName] > 0) {
      Monthly_Count[year][monthName] -= 1;
    }

    if (category && Monthly_Count_Per_Category?.[year]?.[monthName]?.[category] > 0) {
      Monthly_Count_Per_Category[year][monthName][category] -= 1;
      if (Monthly_Count_Per_Category[year][monthName][category] === 0) {
        delete Monthly_Count_Per_Category[year][monthName][category];
      }
    }

    if (category && Yearly_Category_Count?.[year]?.[category] > 0) {
      Yearly_Category_Count[year][category] -= 1;
      if (Yearly_Category_Count[year][category] === 0) {
        delete Yearly_Category_Count[year][category];
      }
    }

    if (Source === "RCA" && Monthly_RCA_Count?.[year]?.[monthName] > 0) {
      Monthly_RCA_Count[year][monthName] -= 1;
    }

    if (Priority && validPriorities.has(Priority)) {
      if (Monthly_Priority_count?.[year]?.[monthName]?.[Priority] > 0) {
        Monthly_Priority_count[year][monthName][Priority] -= 1;
      }
      if (Yearly_Priority_count?.[year]?.[Priority] > 0) {
        Yearly_Priority_count[year][Priority] -= 1;
      }
      if (category && Monthly_Count_Per_Category_Per_Priority?.[year]?.[monthName]?.[category]?.[Priority] > 0) {
        Monthly_Count_Per_Category_Per_Priority[year][monthName][category][Priority] -= 1;
      }
    }

    if (incidentToDelete.Time_Taken_to_Resolve) {
      const deletedTTOR = parseFloat(incidentToDelete.Time_Taken_to_Resolve);
      if (!isNaN(deletedTTOR) && count_TTOR?.[year]?.[monthName] > 0) {
        sum_TTOR[year][monthName] -= deletedTTOR;
        count_TTOR[year][monthName] -= 1;
        Monthly_Avg_Time_Taken_to_Resolve[year][monthName] =
          count_TTOR[year][monthName] > 0
            ? sum_TTOR[year][monthName] / count_TTOR[year][monthName]
            : 0;
      }
    }

    const updatedStats = {
      Monthly_Count, Monthly_Count_Per_Category, sum_TTOR, count_TTOR,
      Monthly_Avg_Time_Taken_to_Resolve, Monthly_RCA_Count, Yearly_Priority_count,
      Monthly_Priority_count, Unique_Categories_Array, Yearly_Category_Count,
      Monthly_Count_Per_Category_Per_Priority
    };
    await cacheStats(updatedStats);
    return updatedStats;
  } catch (error) {
    console.error('Error updating cached stats on delete:', error);
    await deleteStatsCache();
    return null;
  }
}

async function deleteStatsCache() {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: STATS_CACHE_KEY }));
  } catch (error) {
    console.error('deleteStatsCache error:', error);
  }
}
