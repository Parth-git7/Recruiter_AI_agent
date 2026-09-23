require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { matchCandidatesWithFoundry } = require("./foundryService");
const { sendOutreachEmail, generateDraftEmail } = require("./emailService");

// Modern pdfjs-dist with XRef error recovery support
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Multer configuration — store in memory for PDF parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."), false);
    }
  },
});

/**
 * Extract text from a PDF buffer using pdfjs-dist directly.
 * Uses stopAtErrors=false to recover from bad XRef entries.
 */
async function extractPdfText(buffer) {
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data: uint8,
    stopAtErrors: false,   // ← recover from XRef errors
    verbosity: 0,          // suppress console warnings
  }).promise;

  const totalPages = doc.numPages;
  const pageTexts = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item) => item.str !== undefined)
      .map((item) => item.str);
    pageTexts.push(strings.join(" "));
  }

  await doc.destroy();
  return { text: pageTexts.join("\n\n").trim(), pages: totalPages };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static frontend from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    agentName: process.env.FOUNDRY_AGENT_NAME || "candidate-matchmaker",
    foundryEndpointConfigured: Boolean(
      process.env.FOUNDRY_PROJECT_ENDPOINT &&
        !process.env.FOUNDRY_PROJECT_ENDPOINT.includes("your-resource")
    ),
  });
});

// PDF parsing endpoint — uses modern pdfjs-dist with XRef recovery
app.post("/api/parse-pdf", upload.single("pdfFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded." });
    }

    const filename = req.file.originalname;
    const sizeKB = (req.file.size / 1024).toFixed(1);
    console.log(`[API] Parsing PDF: ${filename} (${sizeKB} KB)`);

    const { text, pages } = await extractPdfText(req.file.buffer);

    if (!text) {
      return res.status(422).json({
        error: "Could not extract any text from the PDF. The file may be image-based or empty.",
      });
    }

    console.log(`[API] PDF parsed — ${text.length} chars from ${pages} page(s).`);
    return res.json({ text, pages, filename });
  } catch (error) {
    console.error("[API] Error parsing PDF:", error.message);
    return res.status(500).json({
      error: error.message || "Failed to parse the PDF file.",
    });
  }
});

// Candidate matching endpoint
app.post("/api/match-candidates", async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
      return res.status(400).json({
        error: "Job description is required.",
      });
    }

    console.log(`[API] Received candidate matching request (length: ${jobDescription.length} chars)`);

    const candidates = await matchCandidatesWithFoundry(jobDescription);

    return res.json({
      candidates,
      count: candidates.length,
    });
  } catch (error) {
    console.error("[API] Error matching candidates:", error.message);
    return res.status(500).json({
      error: error.message || "Failed to match candidates using Microsoft AI Foundry agent.",
    });
  }
});

// Outreach email draft generator endpoint
app.get("/api/email-template", (req, res) => {
  const { name, role, company, date, time, timeZone, meetingLink } = req.query;
  const draft = generateDraftEmail(name, role, {
    company,
    date,
    time,
    timeZone,
    meetingLink,
  });
  res.json(draft);
});

// Send outreach email endpoint (Gmail API)
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        error: "Missing required fields: to, subject, and body are all required.",
      });
    }

    console.log(`[API] Sending outreach email to ${to}...`);
    const result = await sendOutreachEmail({ to, subject, body });
    console.log(`[API] Email successfully sent to ${to} (Message ID: ${result.messageId})`);

    return res.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("[API] Error sending outreach email:", error.message);
    return res.status(500).json({
      error: error.message || "Failed to send outreach email.",
    });
  }
});

// Fallback to index.html for any unhandled page routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Candidate Matchmaker running at http://localhost:${PORT}`);
  console.log(` Microsoft Foundry Agent: ${process.env.FOUNDRY_AGENT_NAME || "candidate-matchmaker"}`);
  console.log(`====================================================`);
});
