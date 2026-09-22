/**
 * Microsoft AI Foundry Agent Service Integration
 * 
 * Securely connects to your existing Microsoft AI Foundry project and invokes
 * the 'candidate-matchmaker' agent using the Foundry Agent Service REST protocol
 * or @azure/ai-projects SDK.
 */

const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

/**
 * Robustly extracts and normalizes candidate list from agent output text.
 * Handles Markdown code fences (```json ... ```), raw JSON, or numbered lists.
 */
function extractCandidatesFromText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  let parsed = null;

  // 1. Try parsing markdown json block
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      parsed = JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) {
      // Continue to next extraction
    }
  }

  // 2. Try finding any JSON object or array in the text
  if (!parsed) {
    const jsonMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0].trim());
      } catch (e) {
        // Fallback
      }
    }
  }

  // 3. Try parsing entire string directly
  if (!parsed) {
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      // Not raw JSON
    }
  }

  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.shortlisted_candidates)) {
      rawList = parsed.shortlisted_candidates;
    } else if (Array.isArray(parsed.candidates)) {
      rawList = parsed.candidates;
    } else if (Array.isArray(parsed.matching_candidates)) {
      rawList = parsed.matching_candidates;
    } else if (Array.isArray(parsed.results)) {
      rawList = parsed.results;
    }
  }

  // 4. Fallback: Parse numbered list or text blocks
  if (rawList.length === 0) {
    const candidateBlocks = rawText.split(/\n(?=\s*\d+[\.\)]\s+[A-Z])/);

    for (const block of candidateBlocks) {
      const nameMatch = block.match(/^\s*\d+[\.\)]\s+([A-Za-z\s.'-]+?)(?:\s*[-–—\n]|\s*$)/m) ||
                        block.match(/(?:name|candidate):\s*([A-Za-z\s.'-]+)/i);
      const emailMatch = block.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const scoreMatch = block.match(/(?:match\s*score|score):\s*(\d{1,3})/i);

      if (nameMatch && (emailMatch || scoreMatch)) {
        rawList.push({
          name: nameMatch[1].trim(),
          email: emailMatch ? emailMatch[1].trim() : "",
          match_score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
        });
      }
    }
  }

  // Normalize candidate objects
  return rawList.map((item) => {
    const name = item.name || item.candidate_name || item.fullName || "Candidate";
    const email = item.email || item.candidate_email || item.emailAddress || "";
    let matchScore = item.match_score ?? item.score ?? item.matchScore ?? null;

    if (matchScore !== null) {
      const num = Number(matchScore);
      matchScore = isNaN(num) ? null : Math.round(num);
    }

    return {
      name: String(name).trim(),
      email: String(email).trim(),
      match_score: matchScore,
    };
  });
}

/**
 * Invokes the Microsoft AI Foundry Agent with the provided Job Description.
 * 
 * @param {string} jobDescription 
 * @returns {Promise<Array<{ name: string, email: string, match_score: number|null }>>}
 */
async function matchCandidatesWithFoundry(jobDescription) {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.FOUNDRY_API_KEY || process.env.AZURE_OPENAI_API_KEY;
  const agentName = process.env.FOUNDRY_AGENT_NAME || "candidate-matchmaker";

  const isConfigured = endpoint && !endpoint.includes("your-resource") && !endpoint.includes("your-project");

  if (!isConfigured) {
    console.warn("[Foundry] No valid FOUNDRY_PROJECT_ENDPOINT configured in .env. Using fallback demo data.");
    return getLocalDemoCandidates(jobDescription);
  }

  // Construct prompt requesting match analysis & real email extraction from candidate-resumes
  const promptMessage = [
    "Please evaluate the following Job Description against the candidates in your 'candidate-resumes' knowledge base.",
    "Identify the shortlisted candidates matching this role.",
    "IMPORTANT: Retrieve each candidate's real email address directly from their resume in candidate-resumes.",
    "Provide the candidate full name, match score (0-100), and real email address.",
    "",
    "--- JOB DESCRIPTION ---",
    jobDescription,
  ].join("\n");

  console.log(`[Foundry] Calling agent "${agentName}" on Microsoft AI Foundry project...`);

  // Microsoft AI Foundry Agent Service OpenAI Responses protocol endpoint
  const responseProtocolUrl = `${endpoint.replace(/\/$/, "")}/agents/${agentName}/endpoint/protocols/openai/responses?api-version=v1`;

  try {
    const response = await fetch(responseProtocolUrl, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: promptMessage,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Foundry Agent Service responded with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let assistantText = "";

    if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.role === "assistant" && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === "output_text" && c.text) {
              assistantText += c.text + "\n";
            }
          }
        }
      }
    }

    console.log("[Foundry] Agent response received. Extracting candidate details...");
    const candidates = extractCandidatesFromText(assistantText);
    console.log(`[Foundry] Successfully extracted ${candidates.length} candidates.`);

    return candidates;
  } catch (error) {
    console.error("[Foundry] Error invoking agent:", error.message);
    throw error;
  }
}

/**
 * Fallback candidate data based on actual resumes in /resumes directory
 */
function getLocalDemoCandidates(jobDescription) {
  const jdLower = (jobDescription || "").toLowerCase();

  if (jdLower.includes("cyber") || jdLower.includes("security") || jdLower.includes("soc")) {
    return [
      { name: "Ethan Brooks", email: "ethan.brooks@gmail.com", match_score: 96 },
      { name: "Meilin Zhao", email: "meilin.zhao@gmail.com", match_score: 92 },
      { name: "Victoria Nwachukwu", email: "victoria.nwachukwu@gmail.com", match_score: 87 },
    ];
  }

  return [
    { name: "Arjun Sharma", email: "arjun.sharma@gmail.com", match_score: 95 },
    { name: "Rafael Torres", email: "rafael.torres@gmail.com", match_score: 90 },
    { name: "Priya Menon", email: "priya.menon@gmail.com", match_score: 85 },
  ];
}

module.exports = {
  matchCandidatesWithFoundry,
  extractCandidatesFromText,
};
