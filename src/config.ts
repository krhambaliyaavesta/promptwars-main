import dotenv from "dotenv";
import path from "path";

// Load environment variables once, here at the single configuration entry point.
dotenv.config();

// --- Runtime environment ---
export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_TEST = NODE_ENV === "test";

// --- Gemini configuration ---
const rawApiKey = process.env.GEMINI_API_KEY;
export const GEMINI_API_KEY = rawApiKey;
export const IS_GEMINI_CONFIGURED =
  !!rawApiKey &&
  rawApiKey !== "your_gemini_api_key_here" &&
  rawApiKey.trim() !== "";
// Configurable so the model can be updated without code changes as Google rotates
// model versions. Defaults to a current stable Flash model.
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

// --- Static frontend ---
export const PUBLIC_DIR = path.resolve("src/public");

// --- Input limits (used by request validation) ---
export const JOURNAL_MAX_LENGTH = 2000;
export const EXAM_MAX_LENGTH = 100;
export const MOOD_MIN = 1;
export const MOOD_MAX = 10;

// --- Caching ---
export const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// --- Rate limiting ---
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX = 100; // requests per window per IP
