const fs = require("fs");
const path = require("path");
let googleapisInstance = null;
function getGoogleApis() {
  if (!googleapisInstance) {
    googleapisInstance = require("googleapis").google;
  }
  return googleapisInstance;
}

/**
 * Generates an interview outreach email draft in the exact format requested.
 * Replaces placeholders with provided values or fallback environment variables.
 *
 * @param {string} candidateName - Candidate full name
 * @param {string} role - Role / Job title
 * @param {object} [options] - Additional parameters for company, date, recruiter info, etc.
 * @returns {{ subject: string, body: string }}
 */
function generateDraftEmail(candidateName, role, options = {}) {
  const candidate = (candidateName && candidateName.trim()) || "[Candidate Name]";
  const jobTitle = (role && role.trim()) || "[Job Title]";
  const company = (options.company || process.env.COMPANY_NAME || "company name").trim();

  // Date is always 2 days after today's date
  let date = options.date;
  if (!date) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    date = targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Time is always 10:00 AM fixed
  const time = "10:00 AM";

  // Mode is always Online
  const mode = "Online";

  // Fake dummy Google Meet link
  const meetingLink = options.meetingLink || "https://meet.google.com/abc-defg-hij";

  const subject =
    options.subject ||
    `Virtual Interview Round Invitation: ${jobTitle} - ${candidate}`;

  const body = `Dear ${candidate},

Congratulations!

We are pleased to inform you that you have successfully cleared the **Resume Screening Round** for the position of **${jobTitle}** at **${company}**.

Based on your qualifications, experience, and profile, your application has been shortlisted for the **next stage of our recruitment process — the Virtual Interview Round**.

### Interview Details

**Date:** ${date}
**Time:** ${time}
**Mode:** ${mode}
**Meeting Link:** ${meetingLink}

We kindly request you to **join the meeting at least 5 minutes before the scheduled time** to ensure that your audio, video, and internet connection are working properly.

Please keep a copy of your resume and any relevant documents readily available during the interview.

We appreciate your interest in **${company}** and look forward to speaking with you. We wish you the very best for the upcoming round.

warm regards, 
HR , 
${company}
companyname@gmail.com
+9999999999`;

  return { subject, body };
}

/**
 * Initializes and returns an authorized Google OAuth2 client
 * using credentials.json and token.json in the project root.
 */
function getOAuth2Client() {
  const credentialsPath = path.join(__dirname, "credentials.json");
  const tokenPath = path.join(__dirname, "token.json");

  if (!fs.existsSync(credentialsPath)) {
    throw new Error("Missing credentials.json for Gmail API in root directory.");
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error("Missing token.json for Gmail API in root directory.");
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));

  const creds = credentials.installed || credentials.web;
  if (!creds) {
    throw new Error("Invalid credentials.json format: missing installed/web client configuration.");
  }

  const google = getGoogleApis();
  const oauth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris ? creds.redirect_uris[0] : "http://localhost"
  );

  oauth2Client.setCredentials({
    access_token: token.token || token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scopes ? token.scopes.join(" ") : token.scope,
    token_type: token.token_type || "Bearer",
    expiry_date: token.expiry ? new Date(token.expiry).getTime() : token.expiry_date,
  });

  // Listen for automatic token refreshes and persist back to token.json
  oauth2Client.on("tokens", (tokens) => {
    try {
      const currentToken = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
      const updated = {
        ...currentToken,
        ...tokens,
        token: tokens.access_token || currentToken.token,
      };
      fs.writeFileSync(tokenPath, JSON.stringify(updated, null, 2));
      console.log("[EmailService] Saved refreshed OAuth tokens to token.json");
    } catch (saveErr) {
      console.error("[EmailService] Could not persist refreshed token:", saveErr.message);
    }
  });

  return oauth2Client;
}

/**
 * Converts markdown-formatted email text to clean HTML
 * preserving bold text, headings, links, and paragraph structure.
 */
function formatEmailToHtml(bodyText) {
  let html = bodyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers: ### Title
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #1e293b; margin: 16px 0 8px 0; font-size: 16px; font-weight: 700;">$1</h3>');

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Markdown links: [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>');

  // Convert raw URLs (e.g. meeting links) into clickable links if not already wrapped
  html = html.replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #2563eb; text-decoration: underline;">$1</a>');

  // Paragraphs & line breaks
  const paragraphs = html.split(/\n{2,}/);
  const formattedParagraphs = paragraphs
    .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #334155;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155; margin: 0; padding: 16px; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
    ${formattedParagraphs}
  </div>
</body>
</html>`;
}

/**
 * Sends an outreach email via Gmail API as a multipart (plain + HTML) message.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email plain/markdown body
 * @returns {Promise<{ messageId: string }>}
 */
async function sendOutreachEmail({ to, subject, body }) {
  const auth = getOAuth2Client();
  const google = getGoogleApis();
  const gmail = google.gmail({ version: "v1", auth });

  const boundary = "boundary_" + Date.now().toString(16);
  const htmlBody = formatEmailToHtml(body);

  const messageLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    body,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    htmlBody,
    "",
    `--${boundary}--`,
  ];

  const rawMessage = messageLines.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return { messageId: response.data.id };
}

module.exports = {
  generateDraftEmail,
  sendOutreachEmail,
};
