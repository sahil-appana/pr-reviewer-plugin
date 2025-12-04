import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Setup dotenv - load from pr-reviewer-plugin/.env (not parent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "..", ".env");
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

import { getPRDiff, postPRComment } from "./bitbucket.js";
import { reviewDiff } from "./reviewpr.js";

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));

const WORKSPACE = process.env.BITBUCKET_WORKSPACE || "airtel123";
const REPO = process.env.BITBUCKET_REPO || "pr-reviewer-plugin";
const BITBUCKET_AUTH = process.env.BITBUCKET_AUTH;
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const WEBHOOK_URL = RENDER_URL ? `${RENDER_URL}/webhook` : `http://localhost:${PORT}/webhook`;

const log = {
  info: (msg) => console.log("ℹ️", msg),
  error: (msg) => console.error("❌", msg),
  success: (msg) => console.log("✅", msg)
};

function validateEnvironment() {
  const errors = [];
  if (!BITBUCKET_AUTH) errors.push("BITBUCKET_AUTH not set");
  if (!BITBUCKET_AUTH || BITBUCKET_AUTH.trim().length === 0) errors.push("BITBUCKET_AUTH is empty");
  if (BITBUCKET_AUTH && !BITBUCKET_AUTH.toLowerCase().includes("bearer") && !BITBUCKET_AUTH.toLowerCase().includes("basic") && !BITBUCKET_AUTH.includes("ATATT")) {
    errors.push("BITBUCKET_AUTH doesn't look like a valid app token (should start with ATATT, Bearer or Basic)");
  }
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) errors.push("No AI keys found (need GEMINI_API_KEY or GROQ_API_KEY)");
  if (errors.length > 0) {
    log.error("Configuration failed: " + errors.join(", "));
    process.exit(1);
  }
  log.success("Environment validation passed");
  log.info(`Workspace: ${WORKSPACE}`);
  log.info(`Repository: ${REPO}`);
}

validateEnvironment();

app.get("/", (req, res) => {
  res.json({ 
    status: "healthy", 
    message: "Webhook Server Running",
    webhook_url: WEBHOOK_URL,
    configuration: {
      workspace: WORKSPACE,
      repository: REPO,
      port: PORT
    },
    timestamp: new Date().toISOString() 
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(), 
    workspace: WORKSPACE, 
    repository: REPO,
    auth_configured: !!BITBUCKET_AUTH,
    ai_providers: [
      process.env.GEMINI_API_KEY ? "Gemini" : null,
      process.env.GROQ_API_KEY ? "Groq" : null
    ].filter(Boolean)
  });
});

app.post("/webhook", async (req, res) => {
  // Basic guard: only accept Pull Request events
  const eventKey = (req.headers["x-event-key"] || req.headers["X-Event-Key"] || "").toString();
  if (eventKey && !eventKey.startsWith("pullrequest:")) {
    return res.status(204).json({ status: "ignored", reason: "unsupported event", event: eventKey });
  }

  try {
    const pr = req.body?.pullrequest;
    if (!pr || typeof pr !== "object") return res.status(400).json({ error: "Invalid payload: missing pullrequest object" });

    let prId = pr.id;
    if (!prId) return res.status(400).json({ error: "Invalid payload: missing id" });
    if (typeof prId === "string") prId = parseInt(prId, 10);
    if (typeof prId !== "number" || Number.isNaN(prId)) return res.status(400).json({ error: "Invalid PR ID" });

    log.info(`📌 Webhook received for PR #${prId} - Event: ${eventKey || 'unknown'}`);

    try {
      log.info(`📥 Fetching diff for PR #${prId}...`);
      const diff = await getPRDiff(WORKSPACE, REPO, prId, BITBUCKET_AUTH);
      if (!diff || diff.length === 0) {
        log.info(`⏭️ No changes for PR #${prId}, skipping review`);
        return res.status(200).json({ status: "skipped", message: "No changes", prId });
      }

      log.info(`🤖 Generating review for PR #${prId} (${diff.length} bytes of diff)...`);
      const rawReview = await reviewDiff(diff);

      // Normalize review content: support both string and structured object responses
      let reviewText = "";
      if (!rawReview) throw new Error("Empty review generated");

      if (typeof rawReview === "string") {
        reviewText = rawReview;
      } else if (typeof rawReview === "object") {
        // If API returned validated structure, format into markdown
        if (rawReview.review && typeof rawReview.review === "string") {
          reviewText = rawReview.review;
        } else {
          // Build markdown summary + inline comments
          const parts = [];
          if (rawReview.summary) parts.push(`**Summary**:\n\n${rawReview.summary}`);
          if (Array.isArray(rawReview.comments) && rawReview.comments.length > 0) {
            parts.push('\n**Comments:**');
            rawReview.comments.slice(0, 200).forEach(c => {
              const file = c.file || "<unknown>";
              const comment = c.comment || "";
              parts.push(`- **${file}**: ${comment}`);
            });
          }
          if (Array.isArray(rawReview.patches) && rawReview.patches.length > 0) {
            parts.push('\n**Suggested Patches:**');
            rawReview.patches.slice(0, 20).forEach(p => {
              parts.push(`- **${p.file}**\n\n\`\`\`diff\n${p.diff.substring(0,1000)}\n\`\`\``);
            });
          }
          reviewText = parts.join('\n\n') || JSON.stringify(rawReview).substring(0, 4000);
        }
      } else {
        throw new Error("Unsupported review format returned from backend");
      }

      if (!reviewText || reviewText.trim().length === 0) throw new Error("Empty review text");

      log.info(`📤 Posting review to PR #${prId} (${reviewText.length} characters)...`);
      await postPRComment(WORKSPACE, REPO, prId, reviewText, BITBUCKET_AUTH);
      log.success(`✨ Review completed for PR #${prId}`);
      return res.status(200).json({ status: "success", message: "Review posted", prId });
    } catch (err) {
      log.error(`Error processing PR #${prId}: ${err?.message || err}`);
      try {
        if (err.stack) console.error(err.stack);
        if (err.response) {
          console.error("Error response status:", err.response.status);
          try { console.error("Error response data:", JSON.stringify(err.response.data).substring(0,3000)); } catch (e) { console.error("(couldn't stringify err.response.data)"); }
        }
      } catch (loggingErr) {
        console.error("Failed to log error details:", loggingErr);
      }

      return res.status(500).json({ error: err?.message || "Processing error", prId });
    }
  } catch (err) {
    log.error(`Webhook error: ${err?.message || err}`);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  log.success(`Server running on port ${PORT}`);
  log.info(`Webhook URL: ${WEBHOOK_URL}`);
  
  if (RENDER_URL) {
    log.success(`🚀 Deployed on Render.com`);
    log.info(`Public URL: ${RENDER_URL}`);
  } else {
    log.info(`💻 Running locally on http://localhost:${PORT}`);
  }
  
  log.info(`
╔════════════════════════════════════════════════════════════════╗
║                📡 WEBHOOK SERVER STATUS                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ Webhook URL:                                                   ║
║ ${WEBHOOK_URL}${''.padEnd(Math.max(0, 66 - WEBHOOK_URL.length))}║
║                                                                ║
║ Configuration:                                                 ║
║   • Workspace: ${WORKSPACE}${''.padEnd(Math.max(0, 56 - WORKSPACE.length))}║
║   • Repository: ${REPO}${''.padEnd(Math.max(0, 50 - REPO.length))}║
║   • Environment: ${process.env.NODE_ENV || 'development'}${''.padEnd(Math.max(0, 48 - (process.env.NODE_ENV || 'development').length))}║
║                                                                ║
║ Add to Bitbucket Webhooks:                                   ║
║ Settings → Webhooks → Add webhook                            ║
║ Event: pullrequest:*                                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
