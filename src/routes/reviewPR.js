import express from "express";
import { callModel } from "../services/modelRouter.js";
import { reviewPrompt } from "../services/prompts.js";

const router = express.Router();

/**
 * Extract JSON from various text formats with multiple fallback strategies
 */
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid input: expected string");
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty text provided");
  }
  
  try {
    // First try: direct JSON parsing
    return JSON.parse(trimmed);
  } catch (e) {
    // Second try: markdown code blocks (```json ... ```)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (innerErr) {
        console.warn("⚠️  Failed to parse JSON from code block");
      }
    }
    
    // Third try: find JSON object/array in text
    const objectMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objectMatch && objectMatch[1]) {
      try {
        return JSON.parse(objectMatch[1]);
      } catch (innerErr) {
        console.warn("⚠️  Failed to parse extracted JSON object");
      }
    }

    // Fourth try: look for labeled JSON sections
    const labeledMatch = text.match(/(?:"summary"|"comments"|"patches"|"testCases")\s*:[\s\S]*?(\{[\s\S]*?\})/);
    if (labeledMatch && labeledMatch[1]) {
      try {
        return JSON.parse(labeledMatch[1]);
      } catch (innerErr) {
        console.warn("⚠️  Failed to parse labeled JSON");
      }
    }
    
    throw new Error("Could not extract valid JSON from response after multiple attempts");
  }
}

/**
 * Create default review response
 */
function createDefaultReview() {
  return {
    summary: "Automated code review completed. Please review for accuracy.",
    comments: [],
    patches: [],
    testCases: [],
    status: "default"
  };
}

/**
 * Validate and sanitize review data
 */
function validateReview(data) {
  if (!data || typeof data !== "object") {
    return createDefaultReview();
  }

  try {
    return {
      summary: typeof data.summary === "string" 
        ? data.summary.trim().substring(0, 3000)
        : "Code review completed.",
      comments: Array.isArray(data.comments) 
        ? data.comments.filter(c => 
            c && typeof c === "object" 
            && typeof c.file === "string" && c.file.trim().length > 0
            && typeof c.comment === "string" && c.comment.trim().length > 0
          ).slice(0, 100)
        : [],
      patches: Array.isArray(data.patches) 
        ? data.patches.filter(p => 
            p && typeof p === "object" 
            && typeof p.file === "string" && p.file.trim().length > 0
            && typeof p.diff === "string" && p.diff.trim().length > 0
          ).slice(0, 30)
        : [],
      testCases: Array.isArray(data.testCases) 
        ? data.testCases
            .filter(tc => typeof tc === "string" && tc.trim().length > 0)
            .map(tc => tc.substring(0, 500))
            .slice(0, 20)
        : [],
      status: "validated"
    };
  } catch (err) {
    console.error("❌ Review validation error:", err.message);
    return createDefaultReview();
  }
}

/**
 * Input validation with comprehensive checks
 */
function validatePRInput(body) {
  const errors = [];
  
  // Check diffs
  if (!body || typeof body !== "object") {
    errors.push("Request body must be a valid JSON object");
    return errors;
  }

  if (!body.diffs || (typeof body.diffs === "string" && body.diffs.trim().length === 0)) {
    errors.push("diffs is required and cannot be empty");
  } else if (typeof body.diffs !== "string") {
    errors.push("diffs must be a string");
  } else if (body.diffs.length > 100000) {
    errors.push("diffs exceeds maximum size (100KB)");
  }
  
  // Check title
  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      errors.push("title must be a string");
    } else if (body.title.length > 500) {
      errors.push("title exceeds maximum length (500 chars)");
    }
  }
  
  // Check description
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      errors.push("description must be a string");
    } else if (body.description.length > 5000) {
      errors.push("description exceeds maximum length (5000 chars)");
    }
  }
  
  // Check filesChanged
  if (body.filesChanged !== undefined) {
    if (!Array.isArray(body.filesChanged)) {
      errors.push("filesChanged must be an array");
    } else if (body.filesChanged.length > 1000) {
      errors.push("filesChanged exceeds maximum array length (1000 items)");
    } else {
      // Validate array contents
      for (let i = 0; i < body.filesChanged.length; i++) {
        if (typeof body.filesChanged[i] !== "string") {
          errors.push(`filesChanged[${i}] must be a string`);
          break;
        }
      }
    }
  }
  
  return errors;
}

/**
 * PR Review Endpoint
 */
router.post("/", async (req, res) => {
  try {
    const { 
      title = "", 
      description = "", 
      diffs = "", 
      filesChanged = [] 
    } = req.body || {};
    
    // Validate input
    const errors = validatePRInput(req.body);
    if (errors.length > 0) {
      console.warn("❌ Validation failed:", errors);
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
        suggestion: "Check request parameters",
        ...createDefaultReview()
      });
    }
    
    console.log("📋 PR review requested - Files:", filesChanged.length || 0);
    console.log("📋 Diff size:", diffs.length, "bytes");
    
    // Sanitize inputs
    const safeTitle = typeof title === "string" ? title.substring(0, 500) : "";
    const safeDescription = typeof description === "string" ? description.substring(0, 5000) : "";
    const safeFilesChanged = Array.isArray(filesChanged) 
      ? filesChanged.slice(0, 100).filter(f => typeof f === "string")
      : [];
    
    // Generate prompt
    const prompt = reviewPrompt(safeTitle, safeDescription, diffs, safeFilesChanged);
    
    if (!prompt || prompt.length === 0) {
      throw new Error("Failed to generate prompt");
    }

    console.log("🤖 Calling AI model for review...");
    
    // Call AI model with extended tokens for detailed review
    let result;
    try {
      result = await callModel("gemini-2.0-pro", [{ role: "user", content: prompt }], 2000);
    } catch (modelErr) {
      console.error("❌ Model call failed:", modelErr.message);
      throw new Error("AI service unavailable: " + modelErr.message);
    }

    if (!result) {
      throw new Error("Null response from AI model");
    }

    if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
      console.error("❌ Invalid response structure: no choices array");
      return res.status(500).json({
        error: "Invalid API response structure",
        ...createDefaultReview()
      });
    }

    const responseText = result.choices[0].message?.content;
    
    if (!responseText || typeof responseText !== "string") {
      console.error("❌ No content in response");
      return res.status(500).json({
        error: "Empty response from AI model",
        ...createDefaultReview()
      });
    }

    if (responseText.trim().length === 0) {
      console.warn("⚠️  Empty response text from AI");
      return res.status(500).json({
        error: "AI returned empty response",
        ...createDefaultReview()
      });
    }

    console.log("📝 Processing AI response (" + responseText.length + " bytes)...");
    
    let reviewData;
    try {
      reviewData = extractJSON(responseText);
    } catch (parseErr) {
      console.warn("⚠️  JSON parsing failed:", parseErr.message);
      console.log("📌 Response preview:", responseText.substring(0, 500));
      
      // Return structured response with text fallback
      return res.json({
        ...createDefaultReview(),
        summary: responseText.substring(0, 2000),
        rawResponse: true,
        timestamp: new Date().toISOString()
      });
    }

    // Validate and sanitize review data
    const validatedReview = validateReview(reviewData);
    
    console.log(`✅ PR review completed: ${validatedReview.comments.length} comments, ${validatedReview.patches.length} patches`);
    
    return res.json({
      ...validatedReview,
      timestamp: new Date().toISOString(),
      filesAnalyzed: safeFilesChanged.length
    });
    
  } catch (err) {
    console.error("❌ Review PR Error:", err.message);
    
    const statusCode = err.message.includes("Validation") ? 400 : 500;
    
    res.status(statusCode).json({
      error: "Internal server error during review",
      message: process.env.NODE_ENV === "development" ? err.message : "Please try again",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      ...createDefaultReview()
    });
  }
});

export default router;
