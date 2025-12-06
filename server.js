// const express = require('express');
// const app = express();
// const port = process.env.PORT || 3000;

// app.get('/', (req, res) => {
//   // respond with JSON
//   res.json({ message: "Hello Kasper" });
// });

// app.listen(port, () => {
//   console.log(`Server listening on port ${port}`);
// });
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const app = express();
const port = process.env.PORT || 3000;

// Konfiguracja multer do odbierania plików w pamięci
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Azure Blob Storage setup
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "uploads"; // nazwa kontenera w Azure

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Endpoint GET testowy
app.get('/', (req, res) => {
  res.json({ message: "Hello Kasper" });
});

// Endpoint POST do przesyłania zdjęć
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const blobName = Date.now() + '-' + req.file.originalname; // unikalna nazwa pliku
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(req.file.buffer, req.file.size);

    res.json({ message: "File uploaded successfully", blobName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
