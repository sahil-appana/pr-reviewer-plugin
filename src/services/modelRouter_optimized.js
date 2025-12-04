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

// Initialize clients only when first needed
function initializeClients() {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!gemini && GEMINI_KEY) {
    gemini = new GoogleGenerativeAI(GEMINI_KEY);
    console.log("📦 Gemini client initialized");
  }
  if (!groq && GROQ_KEY) {
    groq = new Groq({ apiKey: GROQ_KEY });
    console.log("📦 Groq client initialized");
  }
  if (!openai && OPENAI_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_KEY });
    console.log("📦 OpenAI client initialized");
  }
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
// HELPER FUNCTIONS
// ==========================================================

/**
 * Validate API response structure
 */
function validateResponse(response) {
  return response && 
         response.choices && 
         Array.isArray(response.choices) && 
         response.choices.length > 0 &&
         response.choices[0].message &&
         response.choices[0].message.content &&
         response.choices[0].message.content.trim().length > 0;
}

/**
 * Call Gemini API
 */
async function callGemini(modelName, prompt) {
  try {
    const model = gemini.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    return {
      choices: [{ message: { content: text } }]
    };
  } catch (error) {
    throw new Error(`Gemini error: ${error.message}`);
  }
}

/**
 * Call Groq API
 */
async function callGroq(modelName, messages, maxTokens) {
  try {
    const response = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: messages.map(m => m.content).join("\n") }],
      max_tokens: Math.min(maxTokens, 2000)
    });
    
    return response;
  } catch (error) {
    throw new Error(`Groq error: ${error.message}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(modelName, messages, maxTokens) {
  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: Math.min(maxTokens, 2000)
    });
    
    return response;
  } catch (error) {
    throw new Error(`OpenAI error: ${error.message}`);
  }
}

/**
 * Call Ollama API
 */
async function callOllama(modelName, prompt) {
  try {
    const response = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, prompt }),
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      choices: [{ message: { content: data.response || "" } }]
    };
  } catch (error) {
    throw new Error(`Ollama error: ${error.message}`);
  }
}

// ==========================================================
// MAIN MODEL ROUTER (Fallback Logic)
// ==========================================================

/**
 * Call AI model with fallback logic
 * @param {string} modelName - Requested model name
 * @param {array} messages - Messages array [{role, content}]
 * @param {number} maxTokens - Maximum tokens (default: 200)
 * @returns {object} Response in standard format
 * @throws {Error} If all providers fail
 */
export async function callModel(modelName, messages, maxTokens = 200) {
  // Validate inputs
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Invalid messages array: must be non-empty array");
  }
  
  initializeClients(); // Ensure clients are initialized
  
  console.log("🔥 callModel started - Model:", modelName, "Tokens:", maxTokens);
  
  const prompt = messages.map(m => m.content).join("\n");
  
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Empty prompt: no content in messages");
  }
  
  // Mock mode for testing
  if (mockMode) {
    console.log("🧪 Mock mode enabled - returning test response");
    return {
      choices: [{ 
        message: { 
          content: "Mock response generated. Enable real API by setting MOCK_MODE=false and providing valid API keys." 
        } 
      }]
    };
  }
  
  const failedAttempts = [];
  
  // Try each provider in fallback order
  for (const attempt of FALLBACK_MODELS) {
    try {
      console.log(`⚡ Attempting: ${attempt.provider}:${attempt.model}`);
      
      let response = null;
      
      // Route to appropriate provider
      if (attempt.provider === "gemini" && gemini) {
        response = await callGemini(attempt.model, prompt);
      } else if (attempt.provider === "groq" && groq) {
        response = await callGroq(attempt.model, messages, maxTokens);
      } else if (attempt.provider === "openai" && openai) {
        response = await callOpenAI(attempt.model, messages, maxTokens);
      } else if (attempt.provider === "ollama") {
        response = await callOllama(attempt.model, prompt);
      } else {
        console.log(`⏭️  Skipped: ${attempt.provider} (client not initialized)`);
        continue;
      }
      
      // Validate response
      if (validateResponse(response)) {
        console.log(`✅ Success: ${attempt.provider}:${attempt.model}`);
        return response;
      } else {
        throw new Error("Invalid response structure");
      }
      
    } catch (err) {
      failedAttempts.push(`${attempt.provider}:${attempt.model} (${err.message})`);
      console.warn(`⚠️  Failed: ${attempt.provider}:${attempt.model} - ${err.message}`);
    }
  }
  
  // All providers failed
  const errorMsg = `All AI providers failed. Attempted: ${failedAttempts.join(", ")}`;
  console.error("❌", errorMsg);
  throw new Error(errorMsg);
}

// ==========================================================
// MODEL PICKER
// ==========================================================

/**
 * Pick best model for request type
 * @param {string} type - Request type (completion, chat, review)
 * @returns {string} Model name to use
 */
export function pickModel(type) {
  const modelMap = {
    "completion": process.env.MODEL_GEMINI_FAST || "gemini-2.0-flash",
    "chat": process.env.MODEL_DEFAULT || "gemini-2.0-flash",
    "review": process.env.MODEL_GEMINI_SMART || "gemini-2.0-pro"
  };
  
  const model = modelMap[type] || "gemini-2.0-flash";
  console.log(`📋 Model picker: ${type} -> ${model}`);
  return model;
}
