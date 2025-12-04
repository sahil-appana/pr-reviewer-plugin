import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Import validation utility
import { validateEnvironment, printValidationResults } from "./utils/envValidator.js";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const NODE_ENV = process.env.NODE_ENV || "development";

// Helper logging function
const log = {
  info: (msg) => LOG_LEVEL === "info" && console.log("ℹ️ ", msg),
  warn: (msg) => console.warn("⚠️ ", msg),
  error: (msg) => console.error("❌", msg),
  success: (msg) => console.log("✅", msg)
};

log.info("Environment: " + NODE_ENV);

// Validate environment before starting
const validation = validateEnvironment();
if (!validation.isValid) {
  console.error("\n❌ STARTUP VALIDATION FAILED\n");
  printValidationResults();
  process.exit(1);
}

printValidationResults();

log.info("Loaded GEMINI key: " + !!process.env.GEMINI_API_KEY);
log.info("Loaded GROQ key: " + !!process.env.GROQ_API_KEY);
log.info("Loaded OPENAI key: " + !!process.env.OPENAI_API_KEY);

import express from "express";
import cors from "cors";

// Import routes
import completionRoute from "./routes/completion.js";
import chatRoute from "./routes/chat.js";
import reviewPRRoute from "./routes/reviewPR.js";

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

app.use(express.json({ limit: "5mb" }));

// Request timeout middleware (30 seconds for API calls)
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    log.warn("Request timeout: " + req.method + " " + req.url);
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout" });
    }
  });
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log.info(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    message: "AI Backend Running",
    timestamp: new Date().toISOString(),
    providers: validation.providers
  });
});

app.get("/health", (req, res) => {
  const health = validateEnvironment();
  res.status(200).json({
    status: health.isValid ? "ok" : "degraded",
    environment: NODE_ENV,
    uptime: process.uptime(),
    providers: health.providers
  });
});

// Routes
app.use("/v1/complete", completionRoute);
app.use("/v1/chat", chatRoute);
app.use("/v1/review/pr", reviewPRRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found", path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  log.error("Unhandled error: " + err.message);
  res.status(err.status || 500).json({
    error: "Internal server error",
    message: NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  log.success(`Backend running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log.warn("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    log.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  log.error("Uncaught Exception: " + err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled Rejection: " + reason);
  process.exit(1);
});
