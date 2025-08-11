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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  Paper,
  Fade,
  Slide,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Alert,
  Snackbar,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import CategoryIcon from '@mui/icons-material/Category';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';
import ArticleIcon from '@mui/icons-material/Article';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AddIcon from '@mui/icons-material/Add';

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../../msalConfig";
import ReactMarkdown from "react-markdown";

const Users = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Ready to upload");
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
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

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
        setError("Authentication failed. Please try again.");
      }
    })();
  }, [accounts, inProgress, instance]);

 useEffect(() => {
  if (!accessToken) return;
  console.log("🔧 Setting up WebSocket and listeners");
  
  const ws = connectWebSocket(accessToken);
   listenForFetch(
      (incidents) => {
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
    console.log("🎯 EXTRACTION CALLBACK TRIGGERED!");
    
    const combinedData = {
      ...extractedData,
      fileName: file?.name,
      category,
      subcategory,
      rcaLink,
      knowledgeArticle,
    };
    
    setData(combinedData);
    setStatus("✅ Upload completed successfully");
    setProgress(100);
    setUploadSuccess(true);

    if(resetTimeoutRef.current){
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => {
      setStatus("Ready to upload");
      setProgress(0);
      setFile(null);
      setCategorization("");
      setSubcategory("");
      setRcaLink("");
      setKnowledgeArticle("");
      setPriority("");
      setCustomCategory("");
      setShowCustomInput(false);
      setUploadSuccess(false);
    },5000);
  });

  listenForProgress((percent, msg) => {
    console.log(`🔄 Component received progress: ${percent}% - ${msg}`);
    setProgress(percent);
    setStatus(msg || "⏳ Processing...");
  });
}, [accessToken]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError("");
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError("");
    }
  };

  const handleCategoryChange = (event) => {
    const val = event.target.value;
    if (val === "__custom__") {
      setShowCustomInput(true);
      setCategorization("");
      setCustomCategory("");
    } else {
      setShowCustomInput(false);
      setCategorization(val);
      setCustomCategory("");
    }
  };

  const handleCustomCategorySubmit = () => {
    if (customCategory.trim()) {
      setCategorization(customCategory.trim());
      setCategories(prev => [...new Set([...prev, customCategory.trim()])].sort());
      setShowCustomInput(false);
    }
  };

  // Check if file is DOCX
  const isDocxFile = file && file.name.toLowerCase().endsWith(".docx");
  
  // Check if file is XLSX  
  const isXlsxFile = file && file.name.toLowerCase().endsWith(".xlsx");

  const handleConfigureUpload = () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    // For XLSX files, upload directly without showing metadata dialog
    if (isXlsxFile) {
      handleUpload();
    } else {
      // For DOCX files, show metadata dialog
      setOpenMetadataDialog(true);
    }
  };

  const handleUpload = () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    // Validation only for DOCX files
    if (isDocxFile && (!category || !subcategory || !rcaLink)) {
      setError("Please fill Category, Subcategory and RCA Link for DOCX upload.");
      return;
    }

    setOpenMetadataDialog(false);
    setStatus("📤 Uploading file...");
    setProgress(0);
    setError("");

    sendUploadRequest(file, {
      category: isDocxFile ? category : "",
      subcategory: isDocxFile ? subcategory : "",
      rcaLink: isDocxFile ? rcaLink : "",
      knowledgeArticle: isDocxFile ? knowledgeArticle : "",
      priority: isDocxFile ? priority : "",
    });
  };

  const resetForm = () => {
    setFile(null);
    setCategorization("");
    setSubcategory("");
    setRcaLink("");
    setKnowledgeArticle("");
    setPriority("");
    setCustomCategory("");
    setShowCustomInput(false);
    setError("");
    setProgress(0);
    setStatus("Ready to upload");
  };

  const getStatusIcon = () => {
    if (uploadSuccess) return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    if (error) return <ErrorIcon sx={{ color: 'error.main' }} />;
    if (progress > 0 && progress < 100) return <CloudUploadIcon sx={{ color: 'primary.main' }} />;
    return <InfoIcon sx={{ color: 'text.secondary' }} />;
  };

  const getStatusColor = () => {
    if (uploadSuccess) return 'success';
    if (error) return 'error';
    if (progress > 0) return 'primary';
    return 'inherit';
  };

return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          background: 'linear-gradient(135deg, #212A55 0%, #394A8C 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          mb: 4
        }}
      >
        Upload Documents
      </Typography>

      {/* Enhanced Upload Card */}
      <Card 
        elevation={3}
        sx={{ 
          background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
          border: '1px solid rgba(117, 117, 117, 0.1)',
          borderRadius: 3,
          overflow: 'visible'
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Drag and Drop Zone */}
          <Paper
            elevation={0}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              border: dragActive 
                ? '2px dashed #394A8C' 
                : file 
                  ? '2px solid #4caf50'
                  : '2px dashed #e0e0e0',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              backgroundColor: dragActive 
                ? 'rgba(57, 74, 140, 0.05)' 
                : file 
                  ? 'rgba(76, 175, 80, 0.05)'
                  : 'rgba(0, 0, 0, 0.02)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              '&:hover': {
                backgroundColor: 'rgba(57, 74, 140, 0.05)',
                borderColor: '#394A8C'
              }
            }}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {file ? (
                <>
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
                  <Typography variant="h6" color="success.main" fontWeight={600}>
                    File Selected
                  </Typography>
                  <Chip 
                    icon={<AttachFileIcon />}
                    label={file.name}
                    color="success"
                    variant="outlined"
                    sx={{ maxWidth: 300 }}
                  />
                  {/* File type info */}
                  <Typography variant="body2" color="text.secondary">
                    {isDocxFile && "DOCX file - Metadata configuration required"}
                    {isXlsxFile && "XLSX file - Ready for direct upload"}
                  </Typography>
                </>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography variant="h6" color="text.primary" fontWeight={600}>
                    {dragActive ? 'Drop your file here' : 'Choose a file or drag it here'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports DOCX and XLSX document formats
                  </Typography>
                </>
              )}
            </Box>
          </Paper>

          {/* Action Buttons - Only show when file is selected */}
          {file && (
            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleConfigureUpload}
                startIcon={<UploadFileIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #370467 0%, #370467 100%)',
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(57, 74, 140, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1a1f4a 0%, #370467 100%)',
                    boxShadow: '0 6px 20px rgba(57, 74, 140, 0.4)',
                  }
                }}
              >
                {isDocxFile ? 'Configure & Upload' : 'Upload File'}
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={resetForm}
                startIcon={<CloseIcon />}
                sx={{ px: 3, py: 1.5, borderRadius: 2 }}
              >
                Clear
              </Button>
            </Box>
          )}

          {/* Enhanced Status Section */}
          <Fade in={true}>
            <Box sx={{ mt: 4 }}>
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 3, 
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {getStatusIcon()}
                  <Typography variant="h6" color={getStatusColor()}>
                    Status: {status}
                  </Typography>
                </Box>
                
                {progress > 0 && (
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={progress} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: uploadSuccess 
                            ? 'linear-gradient(90deg, #4caf50 0%, #66bb6a 100%)'
                            : 'linear-gradient(90deg, #212A55 0%, #394A8C 100%)',
                          borderRadius: 4
                        }
                      }} 
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                      {progress.toFixed(0)}% Complete
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          </Fade>
        </CardContent>
      </Card>

      {/* Enhanced Metadata Dialog - Only for DOCX files */}
      <Dialog 
        open={openMetadataDialog} 
        onClose={() => setOpenMetadataDialog(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: "up" }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #370467 0%, #370467 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <UploadFileIcon />
          Configure Upload Details - DOCX File
          <IconButton
            onClick={() => setOpenMetadataDialog(false)}
            sx={{ ml: 'auto', color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            The following fields are required for DOCX file uploads
          </Alert>
          
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Category Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Category *</InputLabel>
                <Select
                  value={category || ""}
                  onChange={handleCategoryChange}
                  label="Category *"
                  startAdornment={<CategoryIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  <MenuItem value="">Select Category</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem value={cat} key={cat}>{cat}</MenuItem>
                  ))}
                  <MenuItem value="__custom__">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Add New Category
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {showCustomInput && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter new category..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomCategorySubmit();
                      if (e.key === "Escape") {
                        setShowCustomInput(false);
                        setCustomCategory("");
                      }
                    }}
                    autoFocus
                  />
                  <Button 
                    variant="contained" 
                    size="small"
                    onClick={handleCustomCategorySubmit}
                  >
                    Add
                  </Button>
                </Box>
              )}
            </Grid>

            {/* Subcategory */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                required
                label="Subcategory *"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                InputProps={{
                  startAdornment: <DescriptionIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            {/* RCA Link */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="RCA Link *"
                value={rcaLink}
                onChange={(e) => setRcaLink(e.target.value)}
                type="url"
                InputProps={{
                  startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            {/* Knowledge Article */}
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Knowledge Article (Optional)"
                value={knowledgeArticle}
                onChange={(e) => setKnowledgeArticle(e.target.value)}
                InputProps={{
                  startAdornment: <ArticleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            {/* Priority */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Priority (Optional)</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  label="Priority (Optional)"
                  startAdornment={<PriorityHighIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  <MenuItem value="">Select Priority</MenuItem>
                  <MenuItem value="Critical">
                    <Chip label="Critical" color="error" size="small" />
                  </MenuItem>
                  <MenuItem value="High">
                    <Chip label="High" color="warning" size="small" />
                  </MenuItem>
                  <MenuItem value="Medium">
                    <Chip label="Medium" color="info" size="small" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* File Info */}
            {file && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(57, 74, 140, 0.05)' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Selected File:
                  </Typography>
                  <Chip 
                    icon={<AttachFileIcon />}
                    label={file.name}
                    color="primary"
                    variant="outlined"
                  />
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            onClick={() => setOpenMetadataDialog(false)}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            size="large"
            startIcon={<CloudUploadIcon />}
            disabled={!category || !subcategory || !rcaLink}
            sx={{
              background: 'linear-gradient(135deg, #370467 0%, #394A8C 100%)',
              px: 4,
              '&:hover': {
                background: 'linear-gradient(135deg, #1a1f4a 0%, #2d3a75 100%)',
              }
            }}
          >
            Upload File
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setError("")} 
          severity="error" 
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={uploadSuccess}
        autoHideDuration={4000}
        onClose={() => setUploadSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setUploadSuccess(false)} 
          severity="success" 
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          File uploaded successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Users;