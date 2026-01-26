const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const port = process.env.PORT || 3000;

// download
const piexif = require("piexifjs");
const JSZip = require("jszip");

// Multer: store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Azure Blob Storage
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "uploads";

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Google Generative AI - Updated to a current multimodal model (December 2025)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-3-flash-preview (latest fast multimodal model) or fallback to gemini-2.5-flash if needed
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Prompts (unchanged, but ensure ASCII compliance in output)
const promptShort = `
Otrzymasz 3 obrazy z kamer monitoringu, wykonane w roznych miejscach lub z roznych perspektyw.

Twoje zadanie:
1. Przelanalizuj zdjecia w kolejnosci chronologicznej.
2. Napisz, co moglo sie wydarzyc — jaka jest mozliwa historia.
3. Uzyj tylko najwazniejszych informacji widocznych na zdjeciach.
4. Styl: neutralny, rzeczowy.
5. Maksymalnie **150 znakow**.
6. Nie uzywaj poslich znakow, uzywaj wylacznie znakow ASCII bez nowych linii.

Zwroc odpowiedz TYLKO jako krotka historyjke, bez punktow i bez komentarzy technicznych.
`;

const promptLong = `
Otrzymujesz 3 zdjecia wykonane w roznych miejscach lub z roznych perspektyw.
Moga przedstawic rozne pomieszczenia, jeden obszar z kilku kamer
albo rozne lokalizacje powiazane jednym zdarzeniem.

Kazde zdjecie pokazuje moment wykrycia ruchu. Opisz dokladnie, co moglo sie wydarzyc miedzy tymi trzema punktami.
Przeanalizuj je lacznie i opisz logicznie przebieg zdarzenia.
Nie zgaduj danych osobowych.
Skup sie wylacznie na tym, co widac.

Zwroc odpowiedz w formie krotkiego, logicznego opisu wydarzenia. 
Nie uzywaj polskich znakow, uzywaj wylacznie znakow ASCII bez nowych linii.
`;

// Function to describe images using Google Gemini
async function describeImages(files, short) {
  const imageParts = files.map(file => ({
    inlineData: {
      mimeType: file.mimetype,
      data: file.buffer.toString("base64"),
    },
  }));

  const prompt = short ? promptShort : promptLong;

  // Content order: prompt first, then all 3 images
  const content = [{ text: prompt }, ...imageParts];

  const result = await model.generateContent(content);
  return result.response.text().trim();
}

// Fallback to OpenRouter (kept as backup)
async function describeImagesFallback(files, short) {
  const inputs = files.map(file => ({
    type: "image_url",
    image_url: {
      url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
    }
  }));

  const prompt = short ? promptShort : promptLong;

  const body = {
    model: "google/gemini-flash-1.5", // or "google/gemini-pro-1.5" if available on OpenRouter
    messages: [
      { role: "system", content: "You are a helpful assistant that analyzes security camera images." },
      { role: "user", content: [{ type: "text", text: prompt }, ...inputs] }
    ]
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://your-domain.com", // Replace with your domain
      "X-Title": "MonitoringAI",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function sanitizeMetadata(value) {
  if (!value) return "";
  let sanitized = value.replace(/[\r\n]+/g, " ");
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, "");
  return sanitized.trim();
}

async function uploadFilesToAzure(files, containerClient, aiShort, aiLong, batchID) {
  const uploadedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blobName = `${batchID}_${i + 1}.jpg`; // 1-based for clarity
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const metadata = (i === 2) ? {
      batchID,
      ai_short: aiShort,
      ai_long: aiLong
    } : { batchID };

    await blockBlobClient.uploadData(file.buffer, {
      metadata,
      blobHTTPHeaders: { blobContentType: file.mimetype }
    });

    uploadedFiles.push({
      fileName: blobName,
      url: blockBlobClient.url
    });
  }

  return uploadedFiles;
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: "Server is running" });
});

app.post('/api/upload', upload.array('files', 3), async (req, res) => {
  const batchID = req.body.batchID || Date.now().toString();
  let aiShort = "AI unavailable";
  let aiLong = "AI unavailable";

  try {
    if (!req.files || req.files.length !== 3) {
      return res.status(400).json({ error: "Exactly 3 image files required" });
    }

    // Try Gemini first
    aiShort = await describeImages(req.files, true);
    aiLong = await describeImages(req.files, false);

  } catch (err) {
    console.error("Gemini AI error:", err.message);

    // Fallback to OpenRouter
    try {
      aiShort = await describeImagesFallback(req.files, true);
      aiLong = await describeImagesFallback(req.files, false);
      console.log("Fallback to OpenRouter successful");
    } catch (fallbackErr) {
      console.error("OpenRouter fallback failed:", fallbackErr.message);
      aiShort = aiLong = "AI unavailable";
    }
  }

  try {
    const uploadedFiles = await uploadFilesToAzure(
      req.files,
      containerClient,
      aiShort,
      aiLong,
      batchID
    );

    res.json({
      message: "Upload and analysis complete",
      batchID,
      ai_short: aiShort,
      ai_long: aiLong,
      files: uploadedFiles
    });

  } catch (err) {
    console.error("Azure upload error:", err);
    res.status(500).json({ error: "Upload to Azure failed", details: err.message });
  }
});

app.get("/api/files", async (req, res) => {
  try {
    const files = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      const properties = await blockBlobClient.getProperties();

      files.push({
        fileName: blob.name,
        url: blockBlobClient.url,
        metadata: properties.metadata || {}
      });
    }

    res.json({ count: files.length, files });
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

/* ---------------- DOWNLOAD BATCH WITH EXIF ---------------- */

app.get("/api/download/:batchID", async (req, res) => {
  const { batchID } = req.params;
  const zip = new JSZip();

  try {
    const blobs = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      if (blob.name.startsWith(batchID + "_")) {
        blobs.push(blob.name);
      }
    }

    if (blobs.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    blobs.sort(); // chronological order

    for (let i = 0; i < blobs.length; i++) {
      const blobName = blobs[i];
      const blockBlob = containerClient.getBlockBlobClient(blobName);

      const props = await blockBlob.getProperties();
      const metadata = props.metadata || {};

      const imgRes = await fetch(blockBlob.url);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      let jpegData = buffer.toString("binary");

      let exifObj = {};
      try {
        exifObj = piexif.load(jpegData);
      } catch {
        exifObj = { "0th": {}, Exif: {}, GPS: {}, Interop: {}, "1st": {} };
      }

      let description = "";

      if (i === 0 && metadata.ai_long) {
        description = metadata.ai_long;
      }
      if (i === blobs.length - 1 && metadata.ai_short) {
        description = metadata.ai_short;
      }

      if (description) {
        exifObj["0th"][piexif.ImageIFD.ImageDescription] =
          description;
      }

      const exifBytes = piexif.dump(exifObj);
      const newJpeg = piexif.insert(exifBytes, jpegData);

      zip.file(blobName, Buffer.from(newJpeg, "binary"));
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${batchID}.zip`
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    res.send(zipBuffer);

  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});