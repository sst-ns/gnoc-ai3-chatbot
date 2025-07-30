import axios from "axios";

let socket;
let extractionCallback = null;
let progressCallback = null;
let fetchIncidentsCallback = null;
let fetchGraphCallback = null;
let fetchGraph2Callback = null;
let fetchGraph3Callback = null;
let fetchGraph4Callback = null;
let autoResetCallback = null; // Add this new callback

// Add this new function to register auto-reset

export const listenForAutoReset = (callback) => {
  autoResetCallback = callback;
};

export const CHATBOT_FUNCTION_URL = "https://uebm5ahiy5zvtyr7edfakdlzrm0cffcx.lambda-url.us-west-2.on.aws/";

export const connectWebSocket = (accessToken) => {
  // const baseUrl = "wss://jvzpnuyxyf.execute-api.us-west-2.amazonaws.com/default";
  const baseUrl = "wss://cew6zezbjd.execute-api.us-east-1.amazonaws.com/default";


  const wsUrl = accessToken
    ? `${baseUrl}?assertion=${encodeURIComponent(accessToken)}`
    : baseUrl;
  console.log("Assertion Token", accessToken);

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
    sendFetchRequest();
  };

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    console.log("📥 WebSocket message received:", message);

    if (message.uploadURL && message.key) {
      const file = window.currentUploadFile;
      await uploadFileToS3(message.uploadURL, file);

      if (file.name.endsWith(".xlsx")) {
        sendExcelRequest(message.key);
      } else {
        sendExtractRequest(message.key);
      }
      return;
    }

  // Handle progress updates (but don't return early for 100%)
      if (message.percentage !== undefined && progressCallback) {
        progressCallback(message.percentage, message.message);
        
        // Trigger extraction callback for 100% completion
        if (message.percentage === 100 && extractionCallback) {
          // For .docx files with parsedOutput
          if (message.parsedOutput) {
            extractionCallback(message.parsedOutput);
          } 
          // For .xlsx files without parsedOutput - just trigger with empty data
          else {
            extractionCallback({}); // or whatever default data structure you want
          }
        }
        return;
      }


    if (message.action === "fetchComplete" && message.files) {
      if (fetchIncidentsCallback) fetchIncidentsCallback(message.files);
      return;
    }

    if (message.Incidents && fetchIncidentsCallback) {
      fetchIncidentsCallback(message.Incidents);
    }

    if (message.graph1 && fetchGraphCallback) {
      fetchGraphCallback(message.graph1);
    }

    if (message.graph2 && fetchGraph2Callback) {
      fetchGraph2Callback(message.graph2);
    }

    if (message.graph3 && fetchGraph3Callback) {
      fetchGraph3Callback(message.graph3);
    }

    if (message.graph4 && fetchGraph4Callback) {
      fetchGraph4Callback(message.graph4);
    }

    if (!message.Incidents && !message.graph1 && !message.graph2 && !message.graph3 && !message.graph4) {
      console.warn("❗ Unexpected message format:", message);
    }
  };

  socket.onclose = () => {
    console.log("❌ WebSocket closed");
  };
};

export const listenForExtraction = (callback) => {
  extractionCallback = callback;
};

export const listenForProgress = (callback) => {
  progressCallback = callback;
};

export const listenForFetch = (setIncidentsCallback, setGraph1Callback, setGraph2Callback, setGraph3Callback, setGraph4Callback) => {
  fetchIncidentsCallback = setIncidentsCallback;
  fetchGraphCallback = setGraph1Callback;
  fetchGraph2Callback = setGraph2Callback;
  fetchGraph3Callback = setGraph3Callback;
  fetchGraph4Callback = setGraph4Callback;
};

export const sendFetchRequest = () => {
  socket.send(JSON.stringify({ action: "fetch" }));
  console.log("📤 Sent fetch request");
};

export const sendUploadRequest = (file, metadata) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    window.currentUploadFile = file;
    window.currentMetadata = metadata;

    const message = {
      action: "upload",
      key: file.name,
      contentType: file.type,
    };

    socket.send(JSON.stringify(message));
    console.log("📤 Sending upload request:", message);
  }
};

export async function sendChatMessageToBackend(userMessage, instance,conversationId) {
  try {
    const account = instance.getAllAccounts()[0];
    const resp = await instance.acquireTokenSilent({
      account,
      scopes: ["https://skyline.ds.dev.accenture.com/skyline_full"],
    });

    const token = resp.accessToken;
    connectWebSocket(token);

    const ATA_URL = "https://gruironpgdrswfzh2zyiw3fqzm0umwjm.lambda-url.us-east-1.on.aws/";

    const { data: agentData } = await axios.post(
      ATA_URL,
      {
        noise: true,
        gptID: "DR-hg3mc41md0yalp2d",
        message: userMessage,
        conversationId: conversationId, 
      },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 200000,
      }
    );

    console.log("Agent Data:", agentData);
    
    // **FIX: Extract function call images FIRST from raw response**
    const functionCallImages = extractFunctionCallImages(agentData);
    
    return {
      reply: agentData?.reply ?? JSON.stringify(agentData),
      functionCallImages: functionCallImages,
      rawResponse: agentData
    };
  } catch (error) {
    console.error("🔴 Auth or axios error:", error);
    return { reply: "Error authenticating or calling the bot service." };
  }
}

// **FIXED**: Enhanced extraction function with better debugging
const extractFunctionCallImages = (agentData) => {
  const images = [];

  try {
    // **FIX: Use the raw reply directly, not processed reply**
    const rawReply = agentData?.reply || agentData || '';
    console.log("🔍 Raw reply for image extraction:", rawReply);
    console.log("🔍 Reply length:", rawReply.length);
    console.log("🔍 Reply type:", typeof rawReply);

    // **FIX: Handle string vs object response**
    let replyContent = '';
    if (typeof rawReply === 'string') {
      replyContent = rawReply;
    } else if (rawReply.reply) {
      replyContent = rawReply.reply;
    } else {
      replyContent = JSON.stringify(rawReply);
    }

    console.log("🔍 Reply content to search:", replyContent.substring(0, 500) + "...");

    // **Enhanced regex patterns**
    const patterns = [
      /<function>\s*({[^}]*})\s*<\/function>/gs,                    // JSON object pattern
      /<function>\s*({.*?})\s*<\/function>/gs,                      // Nested JSON pattern
      /<function[^>]*>\s*({.*?})\s*<\/function>/gs,                 // With attributes
      /<function>(.*?)<\/function>/gs,                              // Fallback pattern
    ];

    let allMatches = [];
    
    patterns.forEach((pattern, patternIndex) => {
      const matches = [...replyContent.matchAll(pattern)];
      console.log(`🔍 Pattern ${patternIndex + 1} (${pattern}) found ${matches.length} matches`);
      
      matches.forEach(match => {
        console.log(`🔍 Match content preview:`, match[1].substring(0, 200));
      });
      
      allMatches = allMatches.concat(matches);
    });

    // Remove duplicates
    const uniqueMatches = allMatches.filter((match, index, arr) => 
      arr.findIndex(m => m[1] === match[1]) === index
    );

    console.log("🔍 Total unique function call matches:", uniqueMatches.length);

    uniqueMatches.forEach((match, index) => {
      console.log(`🔍 Processing match ${index + 1}`);
      
      try {
        let functionData;
        let matchContent = match[1].trim();
        
        // **FIX: Better JSON parsing with multiple attempts**
        const parseAttempts = [
          () => JSON.parse(matchContent),
          () => JSON.parse(matchContent.replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '')),
          () => JSON.parse(matchContent.replace(/\\"/g, '"').replace(/\\n/g, '\n')),
          () => {
            // Try to find JSON-like content within the match
            const jsonMatch = matchContent.match(/\{.*\}/s);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          }
        ];

        for (let i = 0; i < parseAttempts.length; i++) {
          try {
            functionData = parseAttempts[i]();
            if (functionData) {
              console.log(`✅ JSON parsed successfully with attempt ${i + 1}`);
              break;
            }
          } catch (e) {
            console.log(`⚠️ Parse attempt ${i + 1} failed:`, e.message);
          }
        }

        if (!functionData) {
          console.error(`❌ All JSON parse attempts failed for match ${index + 1}`);
          // continue;
        }

        console.log(`🔍 Parsed function data ${index + 1}:`, functionData);

        // **Enhanced response processing**
        if (functionData.response) {
          let responseData = functionData.response;
          
          if (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (e) {
              console.log(`⚠️ Response is string but not JSON parseable:`, responseData);
            }
          }

          console.log(`🔍 Response data ${index + 1}:`, responseData);

          // **Multiple URL field extraction**
          const urlFields = ['presignedUrl', 'url', 'imageUrl', 'chartUrl', 'svgUrl'];
          
          urlFields.forEach(field => {
            if (responseData && responseData[field]) {
              const imageObj = {
                url: responseData[field],
                filename: responseData.filename || responseData.name || 'chart.svg',
                functionName: functionData.name || functionData.function || 'unknown'
              };
              images.push(imageObj);
              console.log(`✅ Added image from ${field}:`, imageObj);
            }
          });

          // Handle image arrays
          if (responseData && responseData.images && Array.isArray(responseData.images)) {
            responseData.images.forEach((img, imgIndex) => {
              const imageObj = {
                url: typeof img === 'string' ? img : (img.url || img.presignedUrl),
                filename: img.filename || img.name || `image-${imgIndex}.svg`,
                functionName: functionData.name || 'unknown'
              };
              if (imageObj.url) {
                images.push(imageObj);
                console.log(`✅ Added array image ${imgIndex}:`, imageObj);
              }
            });
          }
        }

        // **Direct function data URL check**
        const directUrlFields = ['presignedUrl', 'url', 'imageUrl'];
        directUrlFields.forEach(field => {
          if (functionData[field]) {
            const imageObj = {
              url: functionData[field],
              filename: functionData.filename || 'chart.svg',
              functionName: functionData.name || 'unknown'
            };
            images.push(imageObj);
            console.log(`✅ Added direct image from ${field}:`, imageObj);
          }
        });

      } catch (parseError) {
        console.error(`❌ Failed to process match ${index + 1}:`, parseError);
        console.log(`❌ Problematic content:`, match[1]);
      }
    });

    // **Enhanced fallback URL extraction**
    if (images.length === 0) {
      console.log("🔍 No images found in function calls, trying comprehensive URL extraction...");
      
      const urlPatterns = [
        /https:\/\/gnocai3data\.s3[^\s<>"']+\.(?:svg|png|jpg|jpeg|gif|webp)[^\s<>"']*/gi,
        /https:\/\/[^\s<>"']*amethyststudio[^\s<>"']*\.(?:svg|png|jpg|jpeg|gif|webp)[^\s<>"']*/gi,
        /https:\/\/[^\s<>"']+\.(?:svg|png|jpg|jpeg|gif|webp)\?[^\s<>"']*/gi,
        /"(https:\/\/[^"]*\.(?:svg|png|jpg|jpeg|gif|webp)[^"]*)"/gi,
        /'(https:\/\/[^']*\.(?:svg|png|jpg|jpeg|gif|webp)[^']*)'/gi,
      ];

      urlPatterns.forEach((pattern, patternIndex) => {
        const urlMatches = [...replyContent.matchAll(pattern)];
        console.log(`🔍 URL pattern ${patternIndex + 1} found ${urlMatches.length} matches`);
        
        urlMatches.forEach(urlMatch => {
          const url = urlMatch[1] || urlMatch[0]; // Handle capturing groups
          if (!images.some(img => img.url === url)) {
            const imageObj = {
              url: url,
              filename: 'extracted-chart.svg',
              functionName: 'url-extracted'
            };
            images.push(imageObj);
            console.log("✅ Added fallback URL image:", imageObj);
          }
        });
      });
    }

    console.log("🔍 Final extracted images count:", images.length);
    console.log("🔍 Final extracted images:", images);

  } catch (error) {
    console.error("❌ Error in extractFunctionCallImages:", error);
    console.log("❌ Error stack:", error.stack);
  }

  return images;
};


const uploadFileToS3 = async (uploadURL, file) => {
  try {
    console.log("⏫ Uploading to S3...");
    await axios.put(uploadURL, file, {
      headers: { "Content-Type": file.type },
      maxBodyLength: Infinity,
    });
    console.log("✅ Uploaded to S3");
  } catch (error) {
    console.error("❌ Upload to S3 failed", error);
  }
};

const sendExtractRequest = (key) => {
  const { category, subcategory, rcaLink, knowledgeArticle, priority } = window.currentMetadata || {};
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = {
      action: "extract",
      key,
      Category: category,
      SubCategory: subcategory,
      RcaLink: rcaLink,
      KnowledgeArticle: knowledgeArticle,
      Priority: priority
    };
    socket.send(JSON.stringify(message));
    console.log("🔍 Sent extract request:", message);
  }
};

const sendExcelRequest = (key) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = {
      action: "excel",
      key,
    };
    socket.send(JSON.stringify(message));
    console.log("📤 Sent excel request:", message);
  }
};

export const sendDeleteRequest = (incidentNumber) => {
  console.log("🔢 incidentNumber:", incidentNumber);
  const payload = {
    action: "delete",
    Incident_Number: incidentNumber
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    console.log("📤 Sent delete payload via WebSocket:", payload);
  } else {
    console.error("❌ WebSocket not open. Cannot send delete request.");
  }
};

export default connectWebSocket;
