import { generateOfflineMockAnalysis } from "./ai.service.js";
import { JournalEntryRequest } from "../types/index.js";

// These tests exercise the deterministic offline analyzer that powers the app when no
// GEMINI_API_KEY is configured. It encapsulates the core decision-making logic:
// crisis detection, mood-based branching, and contextual trigger detection.

const entry = (
  over: Partial<JournalEntryRequest> = {},
): JournalEntryRequest => ({
  journalText: "Studied for a few hours today.",
  moodScore: 6,
  targetExam: "JEE",
  ...over,
});

describe("generateOfflineMockAnalysis", () => {
  it("always returns the full WellnessAnalysisResponse shape", () => {
    const result = generateOfflineMockAnalysis(entry());
    expect(Array.isArray(result.detectedEmotions)).toBe(true);
    expect(Array.isArray(result.hiddenTriggers)).toBe(true);
    expect(typeof result.copingStrategy.title).toBe("string");
    expect(Array.isArray(result.copingStrategy.actionableSteps)).toBe(true);
    expect(typeof result.mindfulnessExercise).toBe("string");
    expect(typeof result.empatheticMessage).toBe("string");
    expect(typeof result.crisisAlert).toBe("boolean");
  });

  describe("crisis detection (safety)", () => {
    const crisisPhrases = [
      "I want to die",
      "I keep thinking I should kill myself",
      "I want to end my life",
      "sometimes I think about self-harm",
    ];

    it.each(crisisPhrases)("flags a crisis for: %s", (phrase) => {
      const result = generateOfflineMockAnalysis(
        entry({ journalText: phrase, moodScore: 1 }),
      );
      expect(result.crisisAlert).toBe(true);
      // Must point the student to professional help with a contact number.
      expect(result.empatheticMessage).toMatch(/\+91/);
    });

    it("does NOT flag a crisis for ordinary exam stress", () => {
      const result = generateOfflineMockAnalysis(
        entry({
          journalText: "I'm stressed about my mock test scores",
          moodScore: 4,
        }),
      );
      expect(result.crisisAlert).toBe(false);
    });
  });

  describe("mood-based branching", () => {
    it("treats a very low mood as burnout/exhaustion", () => {
      const result = generateOfflineMockAnalysis(entry({ moodScore: 2 }));
      expect(result.crisisAlert).toBe(false);
      expect(result.detectedEmotions).toEqual(
        expect.arrayContaining(["Exhausted"]),
      );
      // Personalizes with the target exam.
      expect(result.empatheticMessage).toContain("JEE");
    });

    it("treats a high mood as focused/positive", () => {
      const result = generateOfflineMockAnalysis(entry({ moodScore: 9 }));
      expect(result.detectedEmotions).toEqual(
        expect.arrayContaining(["Focused"]),
      );
    });
  });

  describe("contextual trigger detection", () => {
    it("detects mock-test anxiety from the text", () => {
      const result = generateOfflineMockAnalysis(
        entry({
          journalText: "My mock test marks were low again",
          moodScore: 4,
        }),
      );
      expect(result.hiddenTriggers.join(" ").toLowerCase()).toContain(
        "mock test",
      );
    });

    it("detects syllabus backlog from the text", () => {
      const result = generateOfflineMockAnalysis(
        entry({
          journalText: "I have a huge syllabus backlog to clear",
          moodScore: 5,
        }),
      );
      expect(result.hiddenTriggers.join(" ").toLowerCase()).toContain(
        "syllabus",
      );
    });

    it("caps actionable steps at three", () => {
      const result = generateOfflineMockAnalysis(
        entry({
          journalText: "mock test scores and syllabus backlog and no time",
          moodScore: 3,
        }),
      );
      expect(result.copingStrategy.actionableSteps.length).toBeLessThanOrEqual(
        3,
      );
    });
  });
});
