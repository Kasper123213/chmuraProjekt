require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { BlobServiceClient } = require('@azure/storage-blob');
const genai = require('@google/generative-ai'); // zakładam, że masz zainstalowane google-generative-ai
const app = express();
const port = process.env.PORT || 3000;

// Konfiguracja multer do odbierania plików w pamięci
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Azure Blob Storage setup
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "uploads";

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

// Funkcja do opisania obrazów przez Google AI
async function describeImages(files) {
  const inputs = [];

  for (const file of files) {
    inputs.push({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      },
    });
  }

  const result = await model.generateContent([
    { text: "Opisz szczegółowo każdy z obrazów osobno." },
    ...inputs
  ]);

  return result.response.text();
}

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: "Hello Kasper" });
});

// Endpoint upload
app.post('/upload', upload.array('files', 3), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Upload plików do Azure Blob Storage
    const uploadedFiles = [];
    for (const file of req.files) {
      const blobName = Date.now() + '-' + file.originalname;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(file.buffer, file.size);
      uploadedFiles.push(blobName);
    }

    // Opis zdjęć przez Google AI
    const aiDescriptions = await describeImages(req.files);

    res.json({
      message: "Files uploaded",
      files: uploadedFiles,
      aiDescriptions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
