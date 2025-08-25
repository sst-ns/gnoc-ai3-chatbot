import AWS from 'aws-sdk'; // AWS SDK v2
import mammoth from 'mammoth';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const region = process.env.region;
const STATS_CACHE_KEY = 'incident-stats-cache.json';
const bucketName = process.env.bucket_name;


const task = z.object({
  task_number: z.string().default('Not Specified').describe("Task number with type as shown in the Action Details table (e.g., '1 - Corrective')"),
  task_type: z.string().default('Not Specified').describe('Type (Corrective/Preventive) as indicated in the task number'),
  owner: z.string().default('Not Specified').describe('Owner of the task exactly as written in the Owner column'),
  planned_date: z.string().default('Not Specified').describe("Planned Date of Implementation exactly as shown in the table (e.g., '19/10/2024')"),
  actual_date: z.string().default('Not Specified').describe("Actual date of implementation exactly as shown in the table (e.g., '17/10/2024')"),
  status: z.string().default('Not Specified').describe("Status exactly as shown in the table (e.g., Closed, Open)"),
  description: z.string().default('Not Specified').describe('The complete Action Description text'),
  update: z.string().default('Not Specified').describe('Updates on the task'),
});

const IncidentSchema = z.object({
  Incident_Number: z.string().default('Not Specified').describe('Incident number of the incident for which RCA is raised (e.g., INC12345678)'),
  Reported_Date_Time: z.string().default('Not Specified').describe('Reported Date & Time of the incident (ISO 8601 format)'),
  Resolved_Date_Time: z.string().default('Not Specified').describe('Resolved Date & Time of the incident (ISO 8601 format)'),
  Time_Taken_to_Resolve: z.string().default('Not Specified').describe('Time taken to resolve (in minutes)'),
  LocationImpacted: z.array(z.string()).default([]).describe("list of all the Location(s) Impacted"),
  Problem_Record: z.string().default('Not Specified').describe('Problem Record number (e.g., PRB0123456)'),
  Problem_Statement: z.string().default('Not Specified').describe('Detailed Problem Statement'),
  Incident_Description: z.string().default('Not Specified').describe('all the Paragraphs in Incident Description'),
  Root_Cause: z.string().default('Not Specified').describe('Detailed Root Cause of the incident in lower case'),
  RCA_Analysis: z.string().default('Not Specified').describe('RCA Analysis (e.g., 5 Whys) in  lower case'),
  Permanent_Fix: z.string().default("Not Specified").describe("Permanent_Fix"),
  ActionPlan: z.array(task).default([]).describe("List of tasks mentioned in the document"),
});

const parser = StructuredOutputParser.fromZodSchema(IncidentSchema);
const formatInstructions = parser.getFormatInstructions();

const prompt = ChatPromptTemplate.fromTemplate(
  `Extract structured incident data from the following text:
{text}

Follow this format: ${formatInstructions.replace(/[{]/g, '{{').replace(/[}]/g, '}}')}`
);

async function extractHTML(buffer) {
  const { value } = await mammoth.convertToHtml({ buffer });
  return value.replace(/<img[^>]*>/g, '');
}

export const handler = async (event) => {
  console.log('Event:', event);
  const { connectionId, endpoint, bucketName, fileName,tableName,Category,SubCategory,RcaLink,Priority } = event;

  const apigw = new AWS.ApiGatewayManagementApi({ endpoint });

  const sendToClient = async (message) => {
    try {
      await apigw.postToConnection({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      }).promise();
    } catch (err) {
      console.error('Error sending to client:', err);
    }
  };

  try {

    await sendToClient({ percentage: 10, message: `📄 Starting to process "${fileName}"...` })
    const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileName }).promise();
    await sendToClient({ percentage: 20, message: `✅ File received! Converting document to readable format...` });

    const HTML = await extractHTML(s3Object.Body);
    await sendToClient({ percentage: 30, message: `📝 Document converted! Preparing content for AI analysis...` });

    const model = new ChatBedrockConverse({
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      region: region,
      temperature: 0,
    });
    const chain = prompt.pipe(model).pipe(parser);
    await sendToClient({ percentage: 40, message: `🤖 AI is analyzing your document and extracting key incident data...` });

    const parsedOutput = await chain.invoke({ text: HTML });

    await sendToClient({ percentage: 85, message: `💾 Great! Data extracted successfully. Saving to your database...` });

    parsedOutput.fileName = fileName;
    parsedOutput.Category=Category;
    parsedOutput.SubCategory=SubCategory;
    parsedOutput.RcaLink=RcaLink
    parsedOutput.Priority=Priority
    parsedOutput.CommonValue="Incident"
    parsedOutput.Source="RCA"
    await dynamoDB.put({
      TableName: tableName,
      Item: parsedOutput,
    }).promise();

    await sendToClient({
      percentage: 95,
      message: `🎉 Processing complete for "${fileName}"! Your incident data is now available.`,
      parsedOutput,
    });

    await deleteStatsCache()
    
    await sendToClient({
      percentage: 100,
      message: `🧹 Finishing up and cleaning temporary files...`,
      parsedOutput,
    });
    return { statusCode: 200 };
  } catch (error) {
    console.error('Extraction Error:', error);
    await sendToClient({
      percentage: 100,
      error: `❌ Sorry, we couldn't process "${fileName}". Please try again or contact support if the issue persists.`,
      details: error.message,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error during extraction', error: error.message }),
    };
  }
};

async function deleteStatsCache() {
  try {
    const response = await s3.deleteObject({Bucket: bucketName, Key: STATS_CACHE_KEY}).promise();
    console.log('deleteStatsCache response:', response);
  } catch (error) {
    console.error('deleteStatsCache error:', error);
  }
}