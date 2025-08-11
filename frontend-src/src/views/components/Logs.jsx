// src/components/ChatBot.jsx
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {sendChatMessageToBackend} from "../../services/api";

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../../msalConfig";
import { v4 as uuidv4 } from "uuid";


const ChatBot = () => {
  // Initialize chat history with welcome message
  const [chatHistory, setChatHistory] = useState([
    { 
      sender: "bot", 
      text: "Hi! How may I help you? 👋\n\nI'm here to assist you with:\n• **Incident Analysis** - Get insights from incident data\n• **Data Visualization** - Generate charts and reports\n• **System Queries** - Ask questions about trends and patterns\n• **Root Cause Analysis** - Explore RCA details\n\nFeel free to ask me anything!" 
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const { instance, accounts, inProgress } = useMsal();
  const [conversationId, setConversationId] = useState(uuidv4());
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      setChatHistory((h) => [...h, { sender: "bot", text: "❌ I apologize, but I encountered an error processing your request. Please try again or rephrase your question." }]);
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
    // Reset to initial state with welcome message
    setChatHistory([
      { 
        sender: "bot", 
        text: "Hi! How may I help you? 👋\n\nI'm here to assist you with:\n• **Incident Analysis** - Get insights from incident data\n• **Data Visualization** - Generate charts and reports\n• **System Queries** - Ask questions about trends and patterns\n• **Root Cause Analysis** - Explore RCA details\n\nFeel free to ask me anything!" 
      }
    ]);
    setConversationId(uuidv4());
    inputRef.current?.focus();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "Show me incident trends for 2024",
    "What are the top incident categories?",
    "Generate a monthly RCA report",
    "Show average resolution time by priority"
  ];

  const handleSuggestionClick = (question) => {
    setUserInput(question);
    inputRef.current?.focus();
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerTitleStyle}>
          <span style={robotIconStyle}>🤖</span>
          <div>
            <h2 style={titleStyle}>AI Assistant</h2>
            <p style={subtitleStyle}>Your intelligent incident analysis companion</p>
          </div>
        </div>
        <button style={clearBtnStyle} onClick={handleClearChat} title="Clear conversation">
          🗑️ Clear Chat
        </button>
      </div>

      {/* Chat Area */}
      <div style={chatContainerStyle}>
        <div style={chatBoxStyle}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={messageContainerStyle(msg.sender)}>
              {msg.sender === "bot" && (
                <div style={avatarStyle}>🤖</div>
              )}
              
              <div style={messageWrapperStyle(msg.sender)}>
                {msg.text && (
                  <div style={bubbleStyle(msg.sender)}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}
                {msg.image && msg.isFunctionCallImage && (
                  <div style={imageContainerStyle}>
                    <div style={imageMetaStyle}>
                      📊 {msg.functionName} - {msg.filename}
                    </div>
                    <img
                      src={msg.image}
                      alt={msg.filename}
                      style={imageStyle}
                    />
                  </div>
                )}
              </div>

              {msg.sender === "user" && (
                <div style={userAvatarStyle}>👤</div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div style={messageContainerStyle("bot")}>
              <div style={avatarStyle}>🤖</div>
              <div style={typingIndicatorStyle}>
                <div style={typingDotsStyle}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span style={typingTextStyle}>AI is analyzing and generating response...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested Questions */}
        {chatHistory.length === 1 && (
          <div style={suggestionsContainerStyle}>
            <p style={suggestionsLabelStyle}>💡 Try asking:</p>
            <div style={suggestionsGridStyle}>
              {suggestedQuestions.map((question, i) => (
                <button
                  key={i}
                  style={suggestionBtnStyle}
                  onClick={() => handleSuggestionClick(question)}
                  onMouseEnter={(e) => e.target.style.background = '#f0f2ff'}
                  onMouseLeave={(e) => e.target.style.background = '#fff'}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={inputContainerStyle}>
        <div style={inputWrapperStyle}>
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your question here... (Press Enter to send, Shift+Enter for new line)"
            style={inputStyle}
            rows={1}
            disabled={isTyping}
          />
          <button 
            style={{...sendBtnStyle, opacity: (!userInput.trim() || isTyping) ? 0.5 : 1}} 
            onClick={handleSend}
            disabled={!userInput.trim() || isTyping}
            title="Send message"
          >
            {isTyping ? "⏳" : "🚀"}
          </button>
        </div>
        <div style={hintStyle}>
          💡 <strong>Pro tip:</strong> Be specific in your queries for better results. Ask about trends, categories, time periods, or specific metrics.
        </div>
      </div>
    </div>
  );
};

// Enhanced Styles
const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  maxHeight: '700px',
  background: 'linear-gradient(135deg, #f5f7fa 0%, #d6dde8 100%)',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
  margin: '20px',
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
};

const headerStyle = {
  background: 'linear-gradient(135deg, #370467 0%, #370467 100%)',
  color: 'white',
  padding: '20px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
};

const headerTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px'
};

const robotIconStyle = {
  fontSize: '44px',
  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
};

const titleStyle = {
  margin: '0',
  fontSize: '24px',
  fontWeight: '600'
};

const subtitleStyle = {
  margin: '4px 0 0 0',
  fontSize: '14px',
  opacity: '0.9',
  fontWeight: '400'
};

const chatContainerStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const chatBoxStyle = {
  flex: 1,
  padding: '24px',
  overflowY: 'auto',
  background: '#ffffff',
  backgroundImage: 'linear-gradient(45deg, #f8f9fa 25%, transparent 25%), linear-gradient(-45deg, #f8f9fa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8f9fa 75%), linear-gradient(-45deg, transparent 75%, #f8f9fa 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
};

const messageContainerStyle = (sender) => ({
  display: 'flex',
  alignItems: 'flex-end',
  marginBottom: '16px',
  gap: '12px',
  flexDirection: sender === 'user' ? 'row-reverse' : 'row'
});

const messageWrapperStyle = (sender) => ({
  maxWidth: '75%',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
});

const avatarStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #212A55 0%, #394A8C 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  flexShrink: 0,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
};

const userAvatarStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #6B73FF 0%, #8B5CF6 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  flexShrink: 0,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
};

const bubbleStyle = (sender) => ({
  padding: '16px 20px',
  borderRadius: sender === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
  background: sender === 'user' 
    ? 'linear-gradient(135deg, #6B73FF 0%, #8B5CF6 100%)'
    : 'linear-gradient(135deg, #370467 0%, #370467 100%)',
  color: 'white',
  fontSize: '15px',
  lineHeight: '1.5',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  position: 'relative'
});

const typingIndicatorStyle = {
  background: 'linear-gradient(135deg, #370467 0%, #394A8C 100%)',
  color: 'white',
  padding: '16px 20px',
  borderRadius: '20px 20px 20px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

const typingDotsStyle = {
  display: 'flex',
  gap: '4px'
};

const typingTextStyle = {
  fontSize: '14px',
  fontStyle: 'italic'
};

const imageContainerStyle = {
  marginTop: '8px'
};

const imageMetaStyle = {
  fontSize: '12px',
  color: '#666',
  marginBottom: '8px',
  background: 'rgba(255,255,255,0.9)',
  padding: '6px 12px',
  borderRadius: '12px',
  display: 'inline-block'
};

const imageStyle = {
  maxWidth: '100%',
  borderRadius: '12px',
  border: '3px solid white',
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
};

const suggestionsContainerStyle = {
  padding: '20px 24px',
  background: 'rgba(255,255,255,0.9)',
  borderTop: '1px solid #e9ecef'
};

const suggestionsLabelStyle = {
  margin: '0 0 12px 0',
  color: '#495057',
  fontSize: '14px',
  fontWeight: '600'
};

const suggestionsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '8px'
};

const suggestionBtnStyle = {
  background: '#fff',
  border: '2px solid #e9ecef',
  borderRadius: '12px',
  padding: '12px 16px',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  textAlign: 'left',
  color: '#495057'
};

const inputContainerStyle = {
  background: 'white',
  padding: '20px 24px',
  borderTop: '1px solid #e9ecef'
};

const inputWrapperStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '12px'
};

const inputStyle = {
  flex: 1,
  padding: '16px 20px',
  borderRadius: '24px',
  border: '2px solid #e9ecef',
  fontSize: '15px',
  fontFamily: 'inherit',
  resize: 'none',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  minHeight: '24px',
  maxHeight: '120px'
};

const sendBtnStyle = {
  padding: '16px 24px',
  background: 'linear-gradient(135deg, #212A55 0%, #394A8C 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '24px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(33, 42, 85, 0.4)'
};

const clearBtnStyle = {
  padding: '10px 20px',
  background: 'rgba(255,255,255,0.2)',
  color: 'white',
  border: '2px solid rgba(255,255,255,0.3)',
  borderRadius: '12px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease'
};

const hintStyle = {
  fontSize: '12px',
  color: '#6c757d',
  textAlign: 'center',
  padding: '8px',
  background: 'rgba(108, 117, 125, 0.1)',
  borderRadius: '8px'
};

export default ChatBot;