import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand as DocQueryCommand,
  BatchGetCommand
} from "@aws-sdk/lib-dynamodb";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';


import * as math from 'mathjs';

// Initialize AWS clients
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.region });

// Env variables
const TABLE_NAME = process.env.tableName;
const bucketName = process.env.bucket_name;
const STATS_CACHE_KEY = 'incident-stats-cache.json';
const Problem_Record_index = process.env.ProblemRecordIndex;
const sortIndex1 = process.env.sortIndex1;

const VALID_FIELDS = ['Resolved_Date_Time', 'Reported_Date_Time'];
const VALID_STAT_TYPES = [
  'Monthly_Count',
  'Monthly_Count_Per_Category',
  'Monthly_Avg_Time_Taken_to_Resolve',
  'Monthly_RCA_Count',
  'Monthly_Priority_count',
  'Yearly_Priority_count',
  'Yearly_Category_Count'
];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Entry point
export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));
  const path = event.routeKey.split("/")[1];

  switch (path) {
    case 'GetIncidentById':
      return await getIncidentById(event.queryStringParameters);
    case 'GetIncidentsByDate':
      return await getIncidentsByDate(event.queryStringParameters);
    case 'GetIncidentByProblemRecord':
      return await getIncidentsByProblemRecord(event.queryStringParameters);
    case 'GetMonthlyStats':
      return await getMonthlyStats(event.queryStringParameters);
    case 'Calculate':
      return await calculate(event.queryStringParameters);
    default:
      return { status: "ERROR", error: `Unknown action: ${path}` };
  }
};

// Get by Incident Numbers
const getIncidentById = async ({ Incident_Numbers }) => {
  if (!Incident_Numbers) return { status: "REPROMPT", error: "Missing Incident_Numbers parameter" };

  const ids = Incident_Numbers.split(",").map(id => id.trim()).filter(Boolean);
  if (ids.length === 0) return { status: "REPROMPT", error: "No valid Incident_Numbers provided." };

  const results = [];
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const batchResult = await dynamodb.send(new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: batch.map(Incident_Number => ({ Incident_Number }))
          }
        }
      }));

      const items = batchResult.Responses?.[TABLE_NAME] || [];
      results.push(...items.map(({ CommonValue, ...rest }) => rest));
    }

    return results.length
      ? { status: "SUCCESS", data: results }
      : { status: "REPROMPT", error: `No incidents found for provided IDs: ${Incident_Numbers}` };

  } catch (err) {
    console.error("BatchGet error:", err);
    return { status: "FAILURE", error: `Internal server error: ${err.message}` };
  }
};

// Date Filtered Query
const getIncidentsByDate = async ({ field, start_date, end_date, category, priority, source }) => {
  if (!field || !start_date || !end_date) {
    return { status: "REPROMPT", error: "Missing field, start_date, or end_date" };
  }

  if (!VALID_FIELDS.includes(field)) {
    return {
      status: "REPROMPT",
      error: `Invalid field: ${field}. Must be one of ${VALID_FIELDS.join(', ')}`
    };
  }

  try {
    let incidents = [];
    let ExclusiveStartKey;

    do {
      const keyCondExpr = 'CommonValue = :commonValue and #f BETWEEN :start AND :end';
      const exprAttrNames = { '#f': field };
      const exprAttrValues = {
        ':start': start_date,
        ':end': end_date,
        ':commonValue': 'Incident'
      };
      const filterExprs = [];

      if (priority) {
        filterExprs.push('#p = :pri');
        exprAttrNames['#p'] = 'Priority';
        exprAttrValues[':pri'] = priority;
      }
      if (category) {
        filterExprs.push('#c = :cat');
        exprAttrNames['#c'] = 'Category';
        exprAttrValues[':cat'] = category;
      }
      if (source) {
        filterExprs.push('#s = :src');
        exprAttrNames['#s'] = 'Source';
        exprAttrValues[':src'] = source;
      }

      const result = await dynamodb.send(new DocQueryCommand({
        TableName: TABLE_NAME,
        IndexName: `${field}-index`,
        KeyConditionExpression: keyCondExpr,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        FilterExpression: filterExprs.length ? filterExprs.join(' AND ') : undefined,
        ExclusiveStartKey
      }));

      incidents = incidents.concat((result.Items || []).map(({ CommonValue, ...rest }) => rest));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return incidents.length
      ? { status: "SUCCESS", data: { incidents, count: incidents.length } }
      : { status: "REPROMPT", error: "No incident found in the given date range." };

  } catch (err) {
    return { status: "FAILURE", error: `Internal server error: ${err.message}` };
  }
};

// Query by Problem Record
const getIncidentsByProblemRecord = async ({ Problem_Records }) => {
  if (!Problem_Records) return { status: "REPROMPT", error: "Missing Problem_Records parameter" };

  const records = Problem_Records.split(",").map(r => r.trim()).filter(Boolean);
  if (!records.length) return { status: "REPROMPT", error: "No valid Problem_Records provided." };

  const allResults = [];
  try {
    for (const record of records) {
      const result = await dynamodb.send(new DocQueryCommand({
        TableName: TABLE_NAME,
        IndexName: Problem_Record_index,
        KeyConditionExpression: 'Problem_Record = :val',
        ExpressionAttributeValues: { ':val': record }
      }));

      allResults.push(...(result.Items || []).map(({ CommonValue, ...rest }) => rest));
    }

    return allResults.length
      ? { status: "SUCCESS", data: allResults }
      : { status: "REPROMPT", error: `No incidents found for Problem_Records: ${Problem_Records}` };

  } catch (err) {
    return { status: "FAILURE", error: `Internal server error: ${err.message}` };
  }
};

// Get All Incidents
const getAllIncidents = async () => {
  let results = [], ExclusiveStartKey;
  do {
    const res = await dynamodb.send(new DocQueryCommand({
      TableName: TABLE_NAME,
      IndexName: sortIndex1,
      KeyConditionExpression: 'CommonValue = :val',
      ExpressionAttributeValues: { ':val': "Incident" },
      ScanIndexForward: false,
      ExclusiveStartKey
    }));

    results.push(...(res.Items || []).map(({ CommonValue, ...rest }) => rest));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return results;
};

// Get Monthly Stats (Mandatory year & statType)
const getMonthlyStats = async ({ year, statType }) => {
  if (!year) return { status: "REPROMPT", error: "Missing year parameter." };
  if (!statType) return { status: "REPROMPT", error: "Missing statType parameter." };
  if (!VALID_STAT_TYPES.includes(statType)) {
    return { status: "REPROMPT", error: `Invalid statType: ${statType}. Must be one of ${VALID_STAT_TYPES.join(', ')}` };
  }

  let stats;
  try {
    stats = await getCachedStats();
  } catch {
    const incidents = await getAllIncidents();
    stats = calculateIncidentStats(incidents);
    await cacheStats(stats);
  }

  const yearStats = {
    Monthly_Count: stats.Monthly_Count[year] || {},
    Monthly_Count_Per_Category: stats.Monthly_Count_Per_Category[year] || {},
    Monthly_Avg_Time_Taken_to_Resolve: stats.Monthly_Avg_Time_Taken_to_Resolve[year] || {},
    Monthly_RCA_Count: stats.Monthly_RCA_Count[year] || {},
    Monthly_Priority_count: stats.Monthly_Priority_count[year] || {},
    Yearly_Priority_count: stats.Yearly_Priority_count[year] || { Critical: 0, High: 0, Medium: 0 },
    Yearly_Category_Count: stats.Yearly_Category_Count[year] || {}
  };

  return yearStats[statType]
    ? { status: "SUCCESS", data: yearStats[statType] }
    : { status: "REPROMPT", error: `Statistic type '${statType}' not available for year ${year}.` };
};



// Math Expression Evaluation
const calculate = async ({ expression }) => {
  if (!expression) return { status: "REPROMPT", error: "Missing 'expression' parameter." };
  try {
    const result = math.evaluate(expression);
    return { status: "SUCCESS", data: { expression, result } };
  } catch (err) {
    return { status: "FAILURE", error: `Failed to evaluate expression: ${err.message}` };
  }
};

// Stats Calculation
function calculateIncidentStats(Incidents) {
  const Monthly_Count = {};
  const Monthly_Count_Per_Category = {};
  const Monthly_RCA_Count = {};
  const sum_TTOR = {};
  const count_TTOR = {};
  const Monthly_Avg_Time_Taken_to_Resolve = {};
  const Yearly_Priority_count = {};
  const Monthly_Priority_count = {};
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