// ==========================================================
// IMPORTS
// ==========================================================
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import OpenAI from "openai";
import fetch from "node-fetch";

// ==========================================================
// ENV VARIABLES & CLIENT INITIALIZATION (LAZY LOADING)
// ==========================================================
let gemini = null;
let groq = null;
let openai = null;
let clientsInitialized = false;

/**
 * Initialize API clients with validation
 */
function initializeClients() {
  if (clientsInitialized) return;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  let keysAvailable = [];

  try {
    if (GEMINI_KEY && GEMINI_KEY.trim().length > 0) {
      gemini = new GoogleGenerativeAI(GEMINI_KEY);
      keysAvailable.push("Gemini");
      console.log("📦 Gemini client initialized");
    }
  } catch (err) {
    console.warn("⚠️  Failed to initialize Gemini:", err.message);
  }

  try {
    if (GROQ_KEY && GROQ_KEY.trim().length > 0) {
      groq = new Groq({ apiKey: GROQ_KEY });
      keysAvailable.push("Groq");
      console.log("📦 Groq client initialized");
    }
  } catch (err) {
    console.warn("⚠️  Failed to initialize Groq:", err.message);
  }

  try {
    if (OPENAI_KEY && OPENAI_KEY.trim().length > 0) {
      openai = new OpenAI({ apiKey: OPENAI_KEY });
      keysAvailable.push("OpenAI");
      console.log("📦 OpenAI client initialized");
    }
  } catch (err) {
    console.warn("⚠️  Failed to initialize OpenAI:", err.message);
  }

  if (keysAvailable.length === 0) {
    console.warn("⚠️  WARNING: No AI API keys configured! Available providers: " + keysAvailable.join(", "));
  }

  clientsInitialized = true;
}

const mockMode = process.env.MOCK_MODE === "true";

// ==========================================================
// MODEL FALLBACK ORDER
// ==========================================================
const FALLBACK_MODELS = [
  { provider: "gemini", model: "gemini-2.0-flash" },
  { provider: "gemini", model: "gemini-2.0-pro" },
  { provider: "groq", model: "llama-3.1-70b-versatile" },
  { provider: "openai", model: "gpt-4.1-mini" },
  { provider: "ollama", model: "llama3" }
];

console.log("FALLBACK LIST ORDER:", FALLBACK_MODELS);

// ==========================================================
// INPUT VALIDATION
// ==========================================================
/**
 * Validate input messages
 */
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      throw new Error("each message must be an object");
    }
    if (!msg.content || typeof msg.content !== "string") {
      throw new Error("each message must have a non-empty string content field");
    }
    if (msg.content.length > 100000) {
      throw new Error("message content exceeds maximum length (100KB)");
    }
  }
}

/**
 * Validate API response structure
 */
function validateResponse(response, provider) {
  if (!response) {
    throw new Error(`Empty response from ${provider}`);
  }

  if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
    const content = response.choices[0]?.message?.content;
    if (content && typeof content === "string" && content.trim().length > 0) {
      return true;
    }
  }

  throw new Error(`Invalid response structure from ${provider}`);
}

// ==========================================================
// MAIN MODEL ROUTER (FALLBACK LOGIC)
// ==========================================================
export async function callModel(modelName, messages, maxTokens = 200) {
  try {
    // Validate inputs
    validateMessages(messages);
    
    if (typeof maxTokens !== "number" || maxTokens < 1) {
      throw new Error("maxTokens must be a positive number");
    }

    // Initialize clients
    initializeClients();

    console.log("🔥 callModel STARTED with model:", modelName);

    const prompt = messages.map(m => m.content).join("\n");

    if (!prompt || prompt.trim().length === 0) {
      throw new Error("Empty prompt generated from messages");
    }

    // Mock mode for testing
    if (mockMode) {
      console.log("📋 MOCK_MODE=true, returning mock response");
      return {
        choices: [{ message: { content: "Mock response (MOCK_MODE=true)" } }]
      };
    }

    // 🔁 Loop through fallback providers
    for (const attempt of FALLBACK_MODELS) {
      try {
        // ======================================================
        // GEMINI 2.0 — FAST & PRO MODELS
        // ======================================================
        if (attempt.provider === "gemini" && gemini) {
          console.log("⚡ Trying Gemini:", attempt.model);

          const model = gemini.getGenerativeModel({ model: attempt.model });
          const result = await model.generateContent(prompt);

          if (!result?.response) {
            throw new Error("Invalid response structure from Gemini");
          }

          const text = result.response.text();

          if (!text || text.trim().length === 0) {
            throw new Error("Empty response from Gemini");
          }

          console.log("✅ Gemini success!");
          return {
            choices: [{ message: { content: text } }]
          };
        }

        // ======================================================
        // GROQ — FALLBACK 1
        // ======================================================
        if (attempt.provider === "groq" && groq) {
          console.log("⚡ Trying Groq:", attempt.model);

          const res = await groq.chat.completions.create({
            model: attempt.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: Math.min(maxTokens, 2000),
            temperature: 0.7
          });

          validateResponse(res, "Groq");
          console.log("✅ Groq success!");
          return res;
        }

        // ======================================================
        // OPENAI — FALLBACK 2
        // ======================================================
        if (attempt.provider === "openai" && openai) {
          console.log("⚡ Trying OpenAI:", attempt.model);

          const res = await openai.chat.completions.create({
            model: attempt.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: Math.min(maxTokens, 2000),
            temperature: 0.7
          });

          validateResponse(res, "OpenAI");
          console.log("✅ OpenAI success!");
          return res;
        }

        // ======================================================
        // OLLAMA — LOCAL FALLBACK
        // ======================================================
        if (attempt.provider === "ollama") {
          console.log("⚡ Trying Ollama:", attempt.model);

          const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
          
          try {
            const res = await fetch(`${ollamaHost}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: attempt.model,
                prompt: prompt,
                stream: false
              }),
              timeout: 30000
            }).then(r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            });

            if (!res?.response || typeof res.response !== "string") {
              throw new Error("Invalid response from Ollama");
            }

            if (res.response.trim().length === 0) {
              throw new Error("Empty response from Ollama");
            }

            console.log("✅ Ollama success!");
            return {
              choices: [{ message: { content: res.response } }]
            };
          } catch (ollamaErr) {
            console.warn(`⚠️  Ollama unavailable: ${ollamaErr.message}`);
            continue;
          }
        }

      } catch (err) {
        console.warn(`❌ FAILED: ${attempt.provider}:${attempt.model} - ${err.message}`);
        continue;
      }
    }

    // If all providers fail
    throw new Error("❌ All AI providers failed - no response generated. Check API keys and connectivity.");

  } catch (err) {
    console.error("❌ callModel error:", err.message);
    throw err;
  }
}

// ==========================================================
// MODEL PICKER
// ==========================================================
/**
 * Pick model based on type (completion, chat, review)
 */
export function pickModel(type = "chat") {
  const modelMap = {
    completion: process.env.MODEL_COMPLETION || "gemini-2.0-flash",
    chat: process.env.MODEL_CHAT || "gemini-2.0-pro",
    review: process.env.MODEL_REVIEW || "gemini-2.0-pro"
  };

  return modelMap[type] || "gemini-2.0-pro";
}

/**
 * Get list of initialized providers for debugging
 */
export function getAvailableProviders() {
  initializeClients();
  return {
    gemini: !!gemini,
    groq: !!groq,
    openai: !!openai,
    mockMode: mockMode
  };
}
