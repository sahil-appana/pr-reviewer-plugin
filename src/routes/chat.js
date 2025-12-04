import express from "express";
import { pickModel, callModel } from "../services/modelRouter.js";
import { chatPrompt } from "../services/prompts.js";

const router = express.Router();

// Input validation
function validateChatInput(body) {
  const errors = [];
  
  if (!body.message || typeof body.message !== "string") {
    errors.push("message is required and must be a string");
  }
  
  if (body.message && body.message.length === 0) {
    errors.push("message cannot be empty");
  }
  
  if (body.message && body.message.length > 10000) {
    errors.push("message exceeds maximum length (10KB)");
  }
  
  return errors;
}

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    
    // Validate input
    const errors = validateChatInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: errors 
      });
    }
    
    console.log("💬 Chat message received");
    
    const model = pickModel("chat");
    const output = await callModel(model, [
      { role: "system", content: chatPrompt(message) }
    ]);
    
    if (!output?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from AI model");
    }
    
    console.log("✅ Chat response generated");
    
    res.json({ 
      answer: output.choices[0].message.content,
      model: model,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Chat error:", err.message);
    
    res.status(500).json({ 
      error: "Failed to generate chat response",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

export default router;
