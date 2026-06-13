import { JournalEntryRequest } from "../types/index.js";
import {
  JOURNAL_MAX_LENGTH,
  EXAM_MAX_LENGTH,
  MOOD_MIN,
  MOOD_MAX,
} from "../config.js";

/**
 * Result of validating an incoming journal-analysis request.
 * On success it carries the sanitized, typed payload ready for the AI service.
 */
export type ValidationResult =
  | { ok: true; value: JournalEntryRequest }
  | { ok: false; message: string };

/**
 * Validates and sanitizes the body of POST /api/analyze-journal.
 * Keeps all user-input checks in one testable place, away from the route handler.
 */
export function validateJournalRequest(body: unknown): ValidationResult {
  const { journalText, moodScore, targetExam } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    journalText === undefined ||
    moodScore === undefined ||
    targetExam === undefined
  ) {
    return {
      ok: false,
      message:
        "Missing parameters. Please provide 'journalText', 'moodScore', and 'targetExam'.",
    };
  }

  if (typeof journalText !== "string" || journalText.trim() === "") {
    return {
      ok: false,
      message: "Invalid or empty 'journalText'. It must be a non-empty string.",
    };
  }

  const parsedMood = Number(moodScore);
  if (
    Number.isNaN(parsedMood) ||
    !Number.isInteger(parsedMood) ||
    parsedMood < MOOD_MIN ||
    parsedMood > MOOD_MAX
  ) {
    return {
      ok: false,
      message: "Invalid 'moodScore'. It must be an integer between 1 and 10.",
    };
  }

  if (typeof targetExam !== "string" || targetExam.trim() === "") {
    return {
      ok: false,
      message: "Invalid or empty 'targetExam'. It must be a non-empty string.",
    };
  }

  // Sanitize: trim and cap length to prevent prompt injection / payload abuse.
  return {
    ok: true,
    value: {
      journalText: journalText.trim().substring(0, JOURNAL_MAX_LENGTH),
      moodScore: parsedMood,
      targetExam: targetExam.trim().substring(0, EXAM_MAX_LENGTH),
    },
  };
}
