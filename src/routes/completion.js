import express from "express";
import { callModel, pickModel } from "../services/modelRouter.js";
import { completionPrompt } from "../services/prompts.js";
import { buildFileContext } from "../services/contextBuilder.js";

const router = express.Router();

// Input validation helper
function validateCompletionInput(body) {
  const errors = [];
  
  if (!body.fileContent || typeof body.fileContent !== "string") {
    errors.push("fileContent is required and must be a string");
  }
  
  if (body.fileContent && body.fileContent.length > 50000) {
    errors.push("fileContent exceeds maximum length (50KB)");
  }
  
  if (body.cursorLine && typeof body.cursorLine !== "number") {
    errors.push("cursorLine must be a number");
  }
  
  return errors;
}

router.post("/", async (req, res) => {
  try {
    const { fileContent, cursorLine = 0 } = req.body;
    
    // Validate input
    const errors = validateCompletionInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: errors 
      });
    }
    
    console.log("📝 Code completion requested at line", cursorLine);
    
    const prefix = buildFileContext(fileContent, { line: cursorLine });
    const messages = [
      { role: "system", content: completionPrompt(prefix) }
    ];
    
    const model = pickModel("completion");
    const output = await callModel(model, messages, 150);
    
    if (!output?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from AI model");
    }
    
    console.log("✅ Code completion generated successfully");
    
    return res.json({
      completion: output.choices[0].message.content,
      model: model,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Completion error:", err.message);
    
    res.status(500).json({ 
      error: "Failed to generate completion",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

export default router;
