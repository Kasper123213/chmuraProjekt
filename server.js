const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { BlobServiceClient } = require('@azure/storage-blob');
const genai = require('@google/generative-ai'); 
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


const promptShort = `
Otrzymasz 3 zdjęcia z kamer monitoringu mojej posesji.

Każde kolejne zdjęcie jest wykonane później:
- Zdjęcie 1: kamera przy bramie
- Zdjęcie 2: kamera na podjeździe
- Zdjęcie 3: kamera przy drzwiach wejściowych

Twoje zadanie:
1. Przeanalizuj zdjęcia w kolejności chronologicznej.
2. Napisz, co mogło się wydarzyć — jaka jest możliwa historia.
3. Użyj tylko najważniejszych informacji widocznych na zdjęciach.
4. Styl: neutralny, rzeczowy.
5. Maksymalnie **150 znaków**.
6. Używaj wyłącznie znaków ASCII bez nowych linii i Polskich znaków.

Zwróć odpowiedź TYLKO jako krótką historyjkę, bez punktów i bez komentarzy technicznych.
`;

const promptLong = `
Masz trzy zdjęcia z kamer monitoringu na mojej posesji:

- Zdjęcie 1: Kamera przy bramie
- Zdjęcie 2: Kamera kilka metrów dalej na podjeździe
- Zdjęcie 3: Kamera pod drzwiami wejściowymi

Każde zdjęcie pokazuje moment wykrycia ruchu. Opisz dokładnie, co mogło się wydarzyć między tymi trzema punktami. Uwzględnij kolejność ruchu osoby, możliwe intencje i działania. Nie zgaduj imion ani szczegółów prywatnych – skup się tylko na tym, co widać na obrazach. 
Zwróć odpowiedź w formie krótkiego, logicznego opisu wydarzenia.
Używaj wyłącznie znaków ASCII bez nowych linii i Polskich znaków.
`;


// Funkcja do opisania obrazów przez Google AI
async function describeImages(files, short) {
  const inputs = [];

  for (const file of files) {
    inputs.push({
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString("base64"),
      },
    });
  }
  let prompt = '';
  if (short){
    prompt = promptShort;
    } else{
      prompt = promptLong;
  }
  try{
    const result = await model.generateContent([
      { text: prompt},
      ...inputs
    ]);
  } catch (err){
    console.error("\n\n\nGoogle AI error, retrying with OpenRouter...\n\n\n", err);
    return describeImages2(files, short);
  }

  return result.response.text();
}


// Funkcja opisująca obrazy przez OpenRouter AI
async function describeImages2(files, short) {
  const inputs = [];

  for (const file of files) {
    inputs.push({
      type: "input_image",
      image: file.buffer.toString("base64"),
      mime_type: file.mimetype,
    });
  }

  let prompt = "";
  if (short) {
    prompt = promptShort;
  } else {
    prompt = promptLong;
  }

  const body = {
    model: "openai/gpt-4o-mini", 
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: inputs }
    ]
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://twoja-domena.com",
      "X-Title": "MonitoringAI",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("OpenRouter API error: " + errorText);
  }

  return data.choices[0].message.content;
}


function sanitizeMetadata(value) {
  if (!value) return "";
  // usuwa znaki nowej linii i powroty karetki
  let sanitized = value.replace(/[\r\n]+/g, " ");
  // usuwa znaki nie-ASCII
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, "");
  return sanitized;
}


// Funkcja do uploadu plików do Azure z metadanymi
async function uploadFilesToAzure(files, containerClient, aiDescriptions_short, aiDescriptions_long, batchID) {

  const uploadedFiles = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Tworzymy unikalną nazwę pliku
    const blobName = `${batchID}_${i}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Metadane dla Azure Blob Storage
    const metadata = i===2?{
      batchID: batchID,
      aiDescriptions_short: sanitizeMetadata(aiDescriptions_short),
      aiDescriptions_long: sanitizeMetadata(aiDescriptions_long)
    }:{
      batchID: batchID
    };

    // Upload pliku JPG z metadanymi, bez JSON w treści
    await blockBlobClient.upload(file.buffer, file.size, { metadata });

    uploadedFiles.push({
      fileName: blobName,
      url: blockBlobClient.url,
      metadata
    });
  }

  return uploadedFiles;
}




// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: "Hello Kasper" });
});

// Endpoint upload
app.post('/api/upload', upload.array('files', 3), async (req, res) => {
  let aiDescriptions_short = [], aiDescriptions_long = [];
  const batchID = req.body.batchID || "unknown_batch";
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Opis zdjęć przez Google AI
    aiDescriptions_short = await describeImages(req.files, true);
    aiDescriptions_long = await describeImages(req.files, false);

    if (!aiDescriptions_short || !aiDescriptions_long) {
      throw new Error("AI descriptions undefined");
    }
  } catch (err) {
    console.error("AI description error:", err);
    aiDescriptions_short = ["AI unavailable"];
    aiDescriptions_long = ["AI unavailable"];
  }

  try {
    const uploadedFiles = await uploadFilesToAzure(
      req.files,
      containerClient,
      aiDescriptions_short,
      aiDescriptions_long,
      batchID
    );

    res.json({
      message: "Files uploaded",
      files: uploadedFiles,
      aiDescriptions_short,
      aiDescriptions_long
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});


// Pobranie wszystkich plików wraz z metadanymi
async function getAllFilesWithMetadata(containerClient) {
  const result = [];

  for await (const blob of containerClient.listBlobsFlat()) {
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      
      // Pobieramy właściwości blobu (metadata, contentType, size itp.)
      const properties = await blockBlobClient.getProperties();

      result.push({
        fileName: blob.name,
        url: blockBlobClient.url,
        size: properties.contentLength,
        contentType: properties.contentType,
        metadata: properties.metadata
      });

    } catch (err) {
      console.error("Błąd przy pobieraniu metadanych blobu:", blob.name, err);
    }
  }

  return result;
}

// Endpoint
app.get("/api/files", async (req, res) => {
  try {
    const files = await getAllFilesWithMetadata(containerClient);
    res.json({ count: files.length, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});







app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
