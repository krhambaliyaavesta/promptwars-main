import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { analyzeJournal } from "../services/ai.service.js";
import { WellnessAnalysisResponse } from "../types/index.js";
import { validateJournalRequest } from "./validation.js";
import {
  CACHE_DURATION_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  IS_TEST,
} from "../config.js";

const router = Router();

// Rate limiting: prevent abuse of the AI endpoint.
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
});

// Simple in-memory cache for identical requests within the cache window.
interface CacheEntry {
  data: WellnessAnalysisResponse;
  expiry: number;
}
const cache = new Map<string, CacheEntry>();

/** Removes expired entries so the cache map does not grow unbounded. */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiry) {
      cache.delete(key);
    }
  }
}

/** Builds a stable cache key from the sanitized request payload. */
function buildCacheKey(value: WellnessAnalysisRequestKey): string {
  return `wellness:${value.journalText}:${value.moodScore}:${value.targetExam}`;
}

interface WellnessAnalysisRequestKey {
  journalText: string;
  moodScore: number;
  targetExam: string;
}

/**
 * POST /api/analyze-journal
 * Validates the request, serves from cache when possible, otherwise calls the
 * AI service and caches the structured result.
 */
router.post(
  "/analyze-journal",
  apiLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      cleanExpiredCache();

      const validation = validateJournalRequest(req.body);
      if (!validation.ok) {
        res.status(400).json({ status: "error", message: validation.message });
        return;
      }

      const entry = validation.value;
      const cacheKey = buildCacheKey(entry);

      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        res.json(cached.data);
        return;
      }

      // Falls back to the offline mock automatically if no API key is configured.
      const analysisResult = await analyzeJournal(entry);

      cache.set(cacheKey, {
        data: analysisResult,
        expiry: Date.now() + CACHE_DURATION_MS,
      });

      res.json(analysisResult);
    } catch (error) {
      next(error); // Forward to the Express global error handler.
    }
  },
);

// Test-only helper to reset the in-memory cache between test cases.
if (IS_TEST) {
  router.post("/clear-cache", (_req: Request, res: Response) => {
    cache.clear();
    res.json({ status: "success", message: "Cache cleared" });
  });
}

export default router;
