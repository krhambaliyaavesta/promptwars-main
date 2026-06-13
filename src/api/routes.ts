import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { analyzeJournal } from "../services/ai.service.js";
import { JournalEntryRequest } from "../types/index.js";

const router = Router();

// Rate limiting: prevent abuse of AI endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again after 15 minutes"
  }
});

// Cache interface
interface CacheEntry {
  data: any;
  expiry: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (Hackathon constraint)

// Helper to clean up expired cache entries
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiry) {
      cache.delete(key);
    }
  }
};

/**
 * POST /api/analyze-journal
 * Analyzes the user's journal text, mood, and target exam.
 */
router.post(
  "/analyze-journal",
  apiLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      cleanExpiredCache();

      const { journalText, moodScore, targetExam } = req.body;

      // Validate inputs exist
      if (journalText === undefined || moodScore === undefined || targetExam === undefined) {
        res.status(400).json({
          status: "error",
          message: "Missing parameters. Please provide 'journalText', 'moodScore', and 'targetExam'."
        });
        return;
      }

      // Type validations
      if (typeof journalText !== "string" || journalText.trim() === "") {
        res.status(400).json({
          status: "error",
          message: "Invalid or empty 'journalText'. It must be a non-empty string."
        });
        return;
      }

      const parsedMood = Number(moodScore);
      if (isNaN(parsedMood) || !Number.isInteger(parsedMood) || parsedMood < 1 || parsedMood > 10) {
        res.status(400).json({
          status: "error",
          message: "Invalid 'moodScore'. It must be an integer between 1 and 10."
        });
        return;
      }

      if (typeof targetExam !== "string" || targetExam.trim() === "") {
        res.status(400).json({
          status: "error",
          message: "Invalid or empty 'targetExam'. It must be a non-empty string."
        });
        return;
      }

      // Input Sanitization to prevent prompt injection and payload crashing
      // Limit journalText length to 2000 characters and targetExam to 100 characters
      const sanitizedJournal = journalText.trim().substring(0, 2000);
      const sanitizedExam = targetExam.trim().substring(0, 100);

      // Caching key creation (exact match within 10-minute window)
      const cacheKey = `wellness:${sanitizedJournal}:${parsedMood}:${sanitizedExam}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() < cached.expiry) {
        res.json(cached.data);
        return;
      }

      const requestEntry: JournalEntryRequest = {
        journalText: sanitizedJournal,
        moodScore: parsedMood,
        targetExam: sanitizedExam
      };

      // Call AI service (falls back to mock if API key is not configured)
      const analysisResult = await analyzeJournal(requestEntry);

      // Cache the successful response
      cache.set(cacheKey, {
        data: analysisResult,
        expiry: Date.now() + CACHE_DURATION
      });

      res.json(analysisResult);
    } catch (error) {
      next(error); // Forward to the Express global error handler
    }
  }
);

/**
 * Expose clear cache endpoint for testing convenience
 */
router.post("/clear-cache", (req: Request, res: Response) => {
  cache.clear();
  res.json({ status: "success", message: "Cache cleared" });
});

export default router;
