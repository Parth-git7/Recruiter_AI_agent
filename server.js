require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { matchCandidatesWithFoundry } = require("./foundryService");
const { sendOutreachEmail, generateDraftEmail } = require("./emailService");

const app = express();
const PORT = process.env.PORT || 3000;

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
