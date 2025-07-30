import React, { useEffect, useState, useRef } from "react";
import {
  connectWebSocket,
  sendUploadRequest,
  listenForExtraction,
  listenForProgress,
  listenForFetch,
  sendFetchRequest,
  sendDeleteRequest,
  listenForAutoReset,
} from "../../services/api";
import {
  Box,
  Typography,
  Dialog,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import CategoryIcon from '@mui/icons-material/Category';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';
import ArticleIcon from '@mui/icons-material/Article';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../../msalConfig";
import ReactMarkdown from "react-markdown";

const Users = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("No file uploaded");
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState([]);
  const [category, setCategorization] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [rcaLink, setRcaLink] = useState("");
  const [knowledgeArticle, setKnowledgeArticle] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(1);
  const [expandedIncident, setExpandedIncident] = useState(null);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [openMetadataDialog, setOpenMetadataDialog] = useState(false);
  const [priority, setPriority] = useState("");
  const { instance, accounts, inProgress } = useMsal();
  const [accessToken, setAccessToken] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const resetTimeoutRef = useRef(null);
  const [categories, setCategories] = useState([]); 

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

  const inputStyle = {
    marginLeft: "10px",
    padding: "6px",
    width: "80%",
    borderRadius: "4px",
    border: "1px solid #ccc",
    marginTop: "4px"
  };

 useEffect(() => {
  if (!accessToken) return;
  console.log("🔧 Setting up WebSocket and listeners"); // DEBUG
  
  const ws = connectWebSocket(accessToken);
   listenForFetch(
      (incidents) => {
        // Build a category list from incidents (array of incidents or rows)
        let unique = [];
        if (Array.isArray(incidents)) {
          unique = [...new Set(incidents.map(row => row.Category).filter(Boolean))];
        } else if (incidents && Array.isArray(incidents.files)) {
          unique = [...new Set(incidents.files.map(row => row.Category).filter(Boolean))];
        }
        setCategories(prevCategories => {
          const newCategories = new Set([...prevCategories, ...unique]);
          return [...newCategories].sort();
        });
      }
    );

  listenForExtraction((extractedData) => {
    console.log("🎯 EXTRACTION CALLBACK TRIGGERED!"); // DEBUG
    console.log("📊 Received data:", extractedData); // DEBUG
    console.log("🕒 Current time:", new Date().toLocaleTimeString()); // DEBUG
    
    const combinedData = {
      ...extractedData,
      fileName: file?.name,
      category,
      subcategory,
      rcaLink,
      knowledgeArticle,
    };
    
    setData(combinedData);
    setStatus("✅ Extraction complete");
    setProgress(100);

    console.log("⏰ Setting 3-second reset timer..."); // DEBUG

    if(resetTimeoutRef.current){
      clearTimeout(resetTimeoutRef.current);
      console.log("Cleared existing timeout"); 
    }

    resetTimeoutRef.current = setTimeout(() => {
      console.log("EXECUTING AUTO RESET NOW");
      setStatus("No file uploaded");
      setProgress(0);
      setFile(null);
      setCategorization("");
      setSubcategory("");
      setRcaLink("");
      setKnowledgeArticle("");
      setPriority("");
      setCustomCategory("");
      setShowCustomInput(false);
    },3000);

    console.log("Reset timer set witn ID:", resetTimeoutRef.current);
  });
    listenForProgress((percent, msg) => {
    console.log(`🔄 Component received progress: ${percent}% - ${msg}`);
    setProgress(percent);
    setStatus(msg || "⏳ Extracting...");
  });
}, [accessToken]);


  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) {
      alert("Please select a file first");
      return;
    }
    setStatus("📤 Uploading...");
    setProgress(0);
    const metadata = {
      category,
      subcategory,
      rcaLink,
      knowledgeArticle,
    };
    sendUploadRequest(file, metadata);
  };

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setShowCustomInput(true);
      setCategorization(""); // Clear the main category
      setCustomCategory(""); // Reset custom input
    } else {
      setShowCustomInput(false);
      setCategorization(val);
      setCustomCategory(""); // Reset custom input when selecting predefined category
    }
  };

  const handleCustomCategorySubmit = () => {
    if (customCategory.trim()) {
      setCategorization(customCategory.trim());
      setShowCustomInput(false);
    }
  };

  const handleCustomCategoryKeyDown = (e) => {
    if (e.key === "Enter") {
      handleCustomCategorySubmit();
    }
    if (e.key === "Escape") {
      setShowCustomInput(false);
      setCustomCategory("");
    }
  };

return (
    <div>
      <h2>Upload Files</h2>

      <Dialog open={openMetadataDialog} onClose={() => setOpenMetadataDialog(false)}>
        <Box p={3} width="400px">
          <Typography variant="h6" gutterBottom style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <UploadFileIcon /> Enter Additional Details
          </Typography>

          <label style={labelStyle}>
            <CategoryIcon />
            {!showCustomInput ? (
              <select
                value={category || ""}
                onChange={handleCategoryChange}
                style={inputStyle}
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option value={cat} key={cat}>{cat}</option>
                ))}
                <option value="__custom__">Add new...</option>
              </select>
            ) : (
              <div style={{ display: "flex", alignItems: "center", width: "80%", gap: "5px" }}>
                <input
                  type="text"
                  style={{ ...inputStyle, marginLeft: 0, width: "100%" ,overflowY: "auto"}}
                  placeholder="Type new category..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={handleCustomCategoryKeyDown}
                  onBlur={handleCustomCategorySubmit}
                  autoFocus
                />
                <button 
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomCategory("");
                  }}
                  style={{
                    padding: "4px 8px",
                    background: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </label>

          <label style={labelStyle}>
            <DescriptionIcon />
            <input
              type="text"
              placeholder="Subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <LinkIcon />
            <input
              type="text"
              placeholder="RCA Link"
              value={rcaLink}
              onChange={(e) => setRcaLink(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <ArticleIcon />
            <input
              type="text"
              placeholder="Knowledge Article"
              value={knowledgeArticle}
              onChange={(e) => setKnowledgeArticle(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <PriorityHighIcon />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Priority</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
          </label>

          <label style={labelStyle}>
            <UploadFileIcon style={{ marginRight: '9px' }} />
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ marginTop: "8px" }}
            />
          </label>

          <Box mt={2} display="flex" justifyContent="flex-end">
            <button onClick={() => setOpenMetadataDialog(false)} style={{ marginRight: "10px" }}>Cancel</button>
            <button
              onClick={() => {
                if (!file) {
                  alert("Please select a file first.");
                  return;
                }

                const isDocx = file.name.toLowerCase().endsWith(".docx");

                if (isDocx && (!category || !subcategory || !rcaLink)) {
                  alert("Please fill Category, Subcategory and RCA Link for DOCX upload.");
                  return;
                }

                setOpenMetadataDialog(false);
                setStatus("📤 Uploading...");
                setProgress(0);

                sendUploadRequest(file, {
                  category,
                  subcategory,
                  rcaLink,
                  knowledgeArticle,
                  priority,
                });
              }}
              style={uploadBtnStyle}
            >
              Upload Now
            </button>
          </Box>
        </Box>
      </Dialog>

      <div style={cardStyle}>
        <button
          onClick={() => setOpenMetadataDialog(true)}
          style={chooseFileBtnStyle}
          onMouseOver={(e) => (e.target.style.background = "#c7b5cfff")}
          onMouseOut={(e) => (e.target.style.background = "#e6dcff")}
        >
          📂 Choose File
        </button>

        <div style={{ marginTop: "10px" }}>
          <strong>Status:</strong> {status}
          <br />
          <progress value={progress} max="100" style={{ width: "100%", accentColor: "green" }} />
        </div>
      </div>
    </div>
  );
};

  const labelStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "10px",
    gap: "10px"
  };

const sendBtnStyle = {
  padding: "8px 16px",
  background: "#D8B4E2",
  color: "#4B0082",
  border: "1px solid #B67EDC",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "500",
  fontSize: 14,
  transition: "all 0.3s ease",
};

const cardStyle = {
  flex: "1 1 400px",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  padding: 15,
  minWidth: "400px",
};

const chooseFileBtnStyle = {
  padding: "10px 20px",
  background: "#D8B4E2",
  color: "#4B0082",
  border: "1px solid #B67EDC",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "500",
  fontSize: "14px",
  transition: "all 0.3s ease",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const uploadBtnStyle = {
    background: "#673ab7",
    color: "#fff",
    padding: "8px 16px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  };

export default Users;