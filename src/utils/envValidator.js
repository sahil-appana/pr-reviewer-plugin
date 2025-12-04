/**
 * Environment Variable Validator
 * Validates all required API keys and configuration at startup
 */

// Color codes for logging
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

/**
 * Validate environment configuration
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[], providers: string[] }
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const providers = [];

  // Required environment variables
  const PORT = process.env.PORT || 5000;
  const NODE_ENV = process.env.NODE_ENV || "development";

  // Check API Keys
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const MOCK_MODE = process.env.MOCK_MODE === "true";

  // Validate at least one AI provider is configured
  if (GEMINI_KEY && GEMINI_KEY.trim().length > 0) {
    if (GEMINI_KEY.length < 20) {
      errors.push("GEMINI_API_KEY appears invalid (too short)");
    } else {
      providers.push("Gemini");
    }
  } else {
    warnings.push("GEMINI_API_KEY not configured");
  }

  if (GROQ_KEY && GROQ_KEY.trim().length > 0) {
    if (GROQ_KEY.length < 20) {
      errors.push("GROQ_API_KEY appears invalid (too short)");
    } else {
      providers.push("Groq");
    }
  } else {
    warnings.push("GROQ_API_KEY not configured");
  }

  if (OPENAI_KEY && OPENAI_KEY.trim().length > 0) {
    if (OPENAI_KEY.length < 20) {
      errors.push("OPENAI_API_KEY appears invalid (too short)");
    } else {
      providers.push("OpenAI");
    }
  } else {
    warnings.push("OPENAI_API_KEY not configured");
  }

  // Validate at least one provider is available
  if (providers.length === 0 && !MOCK_MODE) {
    errors.push("No AI API keys found (need GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY) and MOCK_MODE is disabled");
  }

  // Validate PORT
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`Invalid PORT: ${PORT} (must be 1-65535)`);
  }

  // Optional checks
  if (NODE_ENV !== "development" && NODE_ENV !== "production") {
    warnings.push(`NODE_ENV is "${NODE_ENV}" (expected "development" or "production")`);
  }

  if (process.env.MOCK_MODE === "true") {
    warnings.push("MOCK_MODE is enabled - all AI calls will return mock responses");
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    providers,
    config: {
      PORT,
      NODE_ENV,
      mockMode: MOCK_MODE,
      numProviders: providers.length
    }
  };
}

/**
 * Print validation results in a formatted way
 */
export function printValidationResults() {
  const validation = validateEnvironment();

  console.log(`\n${COLORS.cyan}${"=".repeat(60)}`);
  console.log("🔍 ENVIRONMENT VALIDATION REPORT");
  console.log(`${"=".repeat(60)}${COLORS.reset}\n`);

  // Config section
  console.log(`${COLORS.cyan}Configuration:${COLORS.reset}`);
  console.log(`  PORT: ${validation.config.PORT}`);
  console.log(`  Environment: ${validation.config.NODE_ENV}`);
  console.log(`  Mock Mode: ${validation.config.mockMode}`);

  // Providers section
  if (validation.providers.length > 0) {
    console.log(`\n${COLORS.green}✅ Available AI Providers (${validation.providers.length}):${COLORS.reset}`);
    validation.providers.forEach(p => console.log(`  - ${p}`));
  }

  // Errors section
  if (validation.errors.length > 0) {
    console.log(`\n${COLORS.red}❌ ERRORS (${validation.errors.length}):${COLORS.reset}`);
    validation.errors.forEach(err => console.log(`  - ${err}`));
  }

  // Warnings section
  if (validation.warnings.length > 0) {
    console.log(`\n${COLORS.yellow}⚠️  WARNINGS (${validation.warnings.length}):${COLORS.reset}`);
    validation.warnings.forEach(warn => console.log(`  - ${warn}`));
  }

  console.log(`\n${COLORS.cyan}${"=".repeat(60)}${COLORS.reset}\n`);

  if (!validation.isValid) {
    console.log(`${COLORS.red}❌ VALIDATION FAILED - Check errors above${COLORS.reset}\n`);
    return false;
  }

  console.log(`${COLORS.green}✅ VALIDATION PASSED${COLORS.reset}\n`);
  return true;
}

export default {
  validateEnvironment,
  printValidationResults
};
