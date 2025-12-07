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
5. Maksymalnie **50 słów**.

Zwróć odpowiedź TYLKO jako krótką historyjkę, bez punktów i bez komentarzy technicznych.
`;

const promptLong = `
Masz trzy zdjęcia z kamer monitoringu na mojej posesji:

- Zdjęcie 1: Kamera przy bramie
- Zdjęcie 2: Kamera kilka metrów dalej na podjeździe
- Zdjęcie 3: Kamera pod drzwiami wejściowymi

Każde zdjęcie pokazuje moment wykrycia ruchu. Opisz dokładnie, co mogło się wydarzyć między tymi trzema punktami. Uwzględnij kolejność ruchu osoby, możliwe intencje i działania. Nie zgaduj imion ani szczegółów prywatnych – skup się tylko na tym, co widać na obrazach. 
Zwróć odpowiedź w formie krótkiego, logicznego opisu wydarzenia.

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



async function uploadFilesToAzure(files, containerClient, aiDescriptions_short, aiDescriptions_long) {
  if (!files || files.length === 0) return [];

  const uploadedFiles = [];

  for (const file of files) {
    const baseName = file.originalname.replace(/\.[^/.]+$/, "");
    const blobName = `${Date.now()}-${baseName}.json`;
    // const blobName = Date.now() + '-' + file.originalname + '.json'; // końcówka .json
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Tworzymy JSON z metadanymi i base64 pliku
    const fileData = {
      originalName: file.originalname,
      uploadDate: new Date().toISOString(),
      mimeType: file.mimetype,
      size: file.size,
      aiDescription_short: aiDescriptions_short,
      aiDescription_long: aiDescriptions_long,
      content: file.buffer.toString('base64') // zapisujemy zawartość pliku jako base64
    };

    const jsonString = JSON.stringify(fileData);

    await blockBlobClient.upload(jsonString, Buffer.byteLength(jsonString), {
      blobHTTPHeaders: { blobContentType: "application/json" }
    });

    uploadedFiles.push(blobName);
  }

  return uploadedFiles;
}



// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: "Hello Kasper" });
});

// Endpoint upload
app.post('/api/upload', upload.array('files', 3), async (req, res) => {
  let aiDescriptions_short, aiDescriptions_long = "";


  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    };

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




  try{
    // // Upload plików do Azure Blob Storage
    const uploadedFiles = await uploadFilesToAzure(req.files, containerClient, aiDescriptions_short, aiDescriptions_long);

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



async function getFilesBetweenDates(containerClient, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const result = [];

  // Pobieramy metadane wszystkich blobów
  for await (const blob of containerClient.listBlobsFlat()) {
    
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      const downloadResp = await blockBlobClient.download(0);

      const text = await streamToString(downloadResp.readableStreamBody);

      const json = JSON.parse(text);

      const uploadDate = new Date(json.uploadDate);
    
      if (uploadDate >= start && uploadDate <= end) {
        result.push(json);
      }
    } catch (err) {
      console.error("Błąd przy odczycie blobu:", blob.name, err);
    }
  }
  return result;
}

// Konwersja stream → string
function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => chunks.push(data.toString()));
    readableStream.on("end", () => resolve(chunks.join("")));
    readableStream.on("error", reject);
  });
}
app.get("/api/files", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "Missing 'from' or 'to'" });

    const files = await getFilesBetweenDates(containerClient, from, to);
    res.json({ count: files.length, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message }); // zawsze JSON
  }
});






app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
