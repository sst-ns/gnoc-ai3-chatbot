// src/components/ChatBot.jsx
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {sendChatMessageToBackend} from "../../services/api";

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../../msalConfig";
import { v4 as uuidv4 } from "uuid";


const ChatBot = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const { instance, accounts, inProgress } = useMsal();
  const [conversationId, setConversationId] = useState(uuidv4());




   useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;
    if (!accounts.length) return;

    (async () => {
      try {
        const resp = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        setAccessToken(resp.idToken || resp.accessToken);
      } catch (err) {
        console.error("Token acquisition error:", err);
      }
    })();
  }, [accounts, inProgress, instance]);

 const fetchImageWithToken = async (url, token) => {
  console.log("🔍 Fetching image with token:", url); // DEBUG
  
  try {
    const res = await fetch(url, {
      headers: {
        "X-TOKEN": token
      }
    });

    console.log("🔍 Fetch response status:", res.status); // DEBUG
    console.log("🔍 Fetch response ok:", res.ok); // DEBUG

    if (!res.ok) {
      console.error("❌ Image fetch failed with status:", res.status);
      throw new Error(`Image fetch failed with status: ${res.status}`);
    }

    const blob = await res.blob();
    console.log("🔍 Blob size:", blob.size); // DEBUG
    console.log("🔍 Blob type:", blob.type); // DEBUG
    
    const objectUrl = URL.createObjectURL(blob);
    console.log("✅ Created object URL:", objectUrl); // DEBUG
    
    return objectUrl;
  } catch (err) {
    console.error("❌ Image fetch error:", err);
    return null;
  }
};

  const handleSend = async () => {
    if (!userInput.trim()) return;
    setChatHistory((h) => [...h, { sender: "user", text: userInput }]);
    setUserInput("");
    setIsTyping(true);

    try {
      const response = await sendChatMessageToBackend(userInput, instance, conversationId);
      const account = instance.getAllAccounts()[0];
      const tokenResp = await instance.acquireTokenSilent({
        account,
        scopes: ["https://skyline.ds.dev.accenture.com/skyline_full"],
      });
      const token = tokenResp.accessToken;

      if (response.functionCallImages?.length) {
        const processedImages = await Promise.all(
          response.functionCallImages.map(async (imgData) => {
            const secureBlob = await fetchImageWithToken(imgData.url, token);
            return {
              sender: "bot",
              image: secureBlob || imgData.url,
              filename: imgData.filename,
              functionName: imgData.functionName,
              isFunctionCallImage: true,
            };
          })
        );
        setChatHistory((h) => [...h, ...processedImages]);
      }

      const cleanedReply = cleanReplyText(response.reply || "");
      if (cleanedReply) setChatHistory((h) => [...h, { sender: "bot", text: cleanedReply }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory((h) => [...h, { sender: "bot", text: "Error processing your request." }]);
    } finally {
      setIsTyping(false);
    }
  };

   const cleanReplyText = (text) => {
    if (!text) return "";
    return text
      .replace(/<loading>.*?<\/loading>/gi, '')
      .replace(/<function>.*?<\/function>/gs, '')
      .replace(/<image>https?:\/\/[^<\s]+<\/image>/gi, '')
      .replace(/\\n/g, '\n')
      .replace(/^["']|["']$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setConversationId(uuidv4());
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>🤖 Ask the Bot</h3>
      <div style={chatBoxStyle}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === "user" ? "right" : "left", marginBottom: "10px" }}>
            {msg.text && (
              <div style={{ ...bubbleStyle, background: msg.sender === "user" ? "#daf5e9" : "#f0dfff" }}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            )}
            {msg.image && msg.isFunctionCallImage && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  📊 {msg.functionName} - {msg.filename}
                </div>
                <img
                  src={msg.image}
                  alt={msg.filename}
                  style={{
                    maxWidth: "75%",
                    borderRadius: 10,
                    border: "2px solid #e6dcff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div style={{ ...bubbleStyle, fontStyle: "italic", color: "#666" }}>
            Bot is analyzing and generating visuals...
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask your question…"
          style={inputStyle}
        />
        <button style={sendBtnStyle} onClick={handleSend}>Send</button>
        <button style={clearBtnStyle} onClick={handleClearChat}>Clear</button>
      </div>
    </div>
  );
};

export default ChatBot;

// Add these styles at bottom of ChatBot.jsx
const chatBoxStyle = {
  border: "1px solid #e0e0e0",
  borderRadius: 10,
  padding: 15,
  height: 350,
  overflowY: "auto",
  background: "#f7f9fc",
  marginBottom: 20,
};
const bubbleStyle = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 12,
  maxWidth: "75%",
  fontSize: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};
const inputStyle = {
  flex: 1,
  padding: 12,
  borderRadius: 8,
  border: "1px solid #ccc",
};
const sendBtnStyle = {
  padding: "8px 16px",
  background: "#D8B4E2",
  color: "#4B0082",
  border: "1px solid #B67EDC",
  borderRadius: 6,
  cursor: "pointer",
};
const clearBtnStyle = {
  padding: "8px 16px",
  background: "#F3D9EC",
  color: "#8B1C62",
  border: "1px solid #D36FA1",
  borderRadius: 6,
  cursor: "pointer",
};
