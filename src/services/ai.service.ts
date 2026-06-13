import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  IS_GEMINI_CONFIGURED,
} from "../config.js";
import {
  JournalEntryRequest,
  WellnessAnalysisResponse,
  CopingStrategy,
} from "../types/index.js";

// --- Tunable analysis constants ---
const MOOD_LOW_THRESHOLD = 3; // <= this is treated as burnout/exhaustion
const MOOD_MID_THRESHOLD = 6; // <= this is fatigued-but-coping
const MAX_ACTIONABLE_STEPS = 3;

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "better off dead",
  "giving up on life",
  "ending it all",
  "self-harm",
  "harm myself",
  "cut myself",
  "hang myself",
];

const CRISIS_HELPLINE_MESSAGE =
  "It sounds like you are carrying an incredibly heavy weight right now, and I want you to know that your life and well-being are far more important than any exam. You do not have to go through this alone. Please connect with someone who can support you. You can reach out to Sneha India Helpline at +91-44-24640050 or Vandrevala Foundation at +91-9999666555. They offer free, confidential support 24/7.";

// Lazily created Gemini client so the module loads cleanly even without a key.
let client: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI | null {
  if (!IS_GEMINI_CONFIGURED) return null;
  if (!client) client = new GoogleGenerativeAI(GEMINI_API_KEY!);
  return client;
}

/**
 * Strict schema that forces Gemini to return the WellnessAnalysisResponse shape.
 */
const wellnessAnalysisSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    detectedEmotions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "List of emotions detected in the journal entry (e.g., anxiety, overwhelmed, motivated, calm).",
    },
    hiddenTriggers: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "Underlying causes of stress or anxiety identified from the text (e.g., peer pressure, fear of failure, lack of sleep).",
    },
    copingStrategy: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "A catchy, relevant title for the coping strategy.",
        },
        actionableSteps: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Step-by-step actionable advice for the student.",
        },
      },
      required: ["title", "actionableSteps"],
    },
    mindfulnessExercise: {
      type: SchemaType.STRING,
      description:
        "A short description of a mindfulness or grounding exercise suitable for the student's current state (e.g., 5-4-3-2-1 technique, deep breathing).",
    },
    empatheticMessage: {
      type: SchemaType.STRING,
      description:
        "A warm, validation-rich message from an empathetic counselor. If crisisAlert is true, this must be a safe, urgent message providing crisis helpline details.",
    },
    crisisAlert: {
      type: SchemaType.BOOLEAN,
      description:
        "Must be true if the journal text shows any signs of self-harm, suicidal ideation, severe clinical depression, or immediate mental health crisis. Otherwise, false.",
    },
  },
  required: [
    "detectedEmotions",
    "hiddenTriggers",
    "copingStrategy",
    "mindfulnessExercise",
    "empatheticMessage",
    "crisisAlert",
  ],
};

const SYSTEM_INSTRUCTION = `
You are an empathetic, expert student counselor specializing in helping students who are preparing for highly stressful, high-stakes exams (like JEE, NEET, UPSC, Board exams, etc.).
Your goal is to analyze the student's journal entry and mood score to provide valuable, supportive mental wellness insights.

Strictly adhere to the following rules:
1. Emotion & Trigger Analysis: Read the journal entry carefully to identify detected emotions and hidden stressors or burnout patterns (triggers).
2. Persona: Your response must be extremely warm, validation-rich, compassionate, and non-judgmental. Do not sound clinical or robotic.
3. Crisis Safety Intervention (CRITICAL):
   - You must inspect the text for any signs of self-harm, suicidal ideation, severe hopelessness, or desire to end their life.
   - If any such thoughts are detected (even if expressed subtly), you MUST set "crisisAlert" to true.
   - When "crisisAlert" is true, the "empatheticMessage" MUST contain a supportive, warm, yet urgent message urging them to connect with professionals, and include a clear crisis helpline contact detail (such as: "Please reach out to Sneha India Helpline at +91-44-24640050 or Vandrevala Foundation at +91-9999666555. You don't have to carry this pain alone. We are here for you.").
   - If no self-harm or severe crisis is detected, set "crisisAlert" to false, and let "empatheticMessage" be a standard warm, encouraging, counseling message.
4. Actionable Steps: Provide 2-3 highly realistic, simple, and context-aware actionable coping steps tailored to their target exam and current state.
5. Mindfulness Exercise: Give them a specific, simple breathing, grounding, or relaxation exercise they can do right now in under 5 minutes.
6. Target Exam Context: Keep the specific struggles of preparing for their target exam (e.g. JEE, NEET, UPSC) in mind.

Respond ONLY in valid JSON matching the specified schema.
`;

/**
 * Runtime type guard: verifies a parsed value matches WellnessAnalysisResponse
 * before we trust it. Protects the UI from malformed model output.
 */
function isWellnessAnalysisResponse(
  value: unknown,
): value is WellnessAnalysisResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const coping = v.copingStrategy as Record<string, unknown> | undefined;
  return (
    Array.isArray(v.detectedEmotions) &&
    Array.isArray(v.hiddenTriggers) &&
    typeof coping === "object" &&
    coping !== null &&
    typeof coping.title === "string" &&
    Array.isArray(coping.actionableSteps) &&
    typeof v.mindfulnessExercise === "string" &&
    typeof v.empatheticMessage === "string" &&
    typeof v.crisisAlert === "boolean"
  );
}

/**
 * Analyzes a student's journal entry to detect burnout, stress, and crisis signals.
 * Uses Gemini when configured; otherwise (or on any failure) falls back to the
 * deterministic offline analyzer so the service never crashes.
 */
export async function analyzeJournal(
  entry: JournalEntryRequest,
): Promise<WellnessAnalysisResponse> {
  const gemini = getGeminiClient();
  if (!gemini) {
    return generateOfflineMockAnalysis(entry);
  }

  try {
    const model = gemini.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: wellnessAnalysisSchema,
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `
      Student Mood Score (1-10): ${entry.moodScore}
      Target Exam: ${entry.targetExam}
      Journal Entry Text:
      "${entry.journalText}"
    `;

    const result = await model.generateContent(prompt);
    const parsed: unknown = JSON.parse(result.response.text());

    if (!isWellnessAnalysisResponse(parsed)) {
      console.error(
        "Gemini returned an unexpected shape; using offline fallback.",
      );
      return generateOfflineMockAnalysis(entry);
    }

    return parsed;
  } catch (error) {
    console.error("Gemini API error, falling back to offline analysis:", error);
    return generateOfflineMockAnalysis(entry);
  }
}

// --- Offline analyzer (deterministic, no network) ---

/** Detects explicit crisis language in the (lowercased) journal text. */
function containsCrisisLanguage(textLower: string): boolean {
  return CRISIS_KEYWORDS.some((keyword) => textLower.includes(keyword));
}

/** The safety-first response returned whenever crisis language is detected. */
function buildCrisisResponse(): WellnessAnalysisResponse {
  return {
    detectedEmotions: ["Overwhelmed", "Despair", "Severe Hopelessness"],
    hiddenTriggers: [
      "Academic exhaustion",
      "Severe mental distress",
      "Isolation",
    ],
    copingStrategy: {
      title: "Immediate Safety & Professional Support",
      actionableSteps: [
        "Stop studying immediately and step away from your study desk.",
        "Reach out to a trusted family member, friend, or mentor to let them know how you feel.",
        "Contact professional counselors who specialize in student crisis support.",
      ],
    },
    mindfulnessExercise:
      "Box Breathing: Inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds. Focus only on the count.",
    empatheticMessage: CRISIS_HELPLINE_MESSAGE,
    crisisAlert: true,
  };
}

interface MoodAnalysis {
  emotions: string[];
  triggers: string[];
  copingStrategy: CopingStrategy;
  mindfulnessExercise: string;
  empatheticMessage: string;
}

/** Produces a baseline analysis driven by the numeric mood score. */
function analyzeByMood(moodScore: number, targetExam: string): MoodAnalysis {
  if (moodScore <= MOOD_LOW_THRESHOLD) {
    return {
      emotions: ["Exhausted", "Anxious", "Stressed"],
      triggers: [
        "Burnout from high-intensity study schedule",
        "Anxiety about exam results",
      ],
      copingStrategy: {
        title: "Cognitive Offloading & Recovery",
        actionableSteps: [
          "Take a complete 2-hour break from all exam preparation books and devices.",
          "Go for a 15-minute walk outside in natural light.",
          "Break your target preparation topics into micro-tasks of 20 minutes each.",
        ],
      },
      mindfulnessExercise:
        "5-4-3-2-1 Grounding: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste.",
      empatheticMessage: `Preparing for ${targetExam} is a marathon, not a sprint. A mood score of ${moodScore} indicates you are running on empty. It is okay to take a step back and rest; resting is a crucial part of studying effectively.`,
    };
  }

  if (moodScore <= MOOD_MID_THRESHOLD) {
    return {
      emotions: ["Apprehensive", "Fatigued", "Determined"],
      triggers: [
        "Peer pressure or high expectations",
        "Inconsistent sleep pattern",
      ],
      copingStrategy: {
        title: "Sustained Focus & Pacing",
        actionableSteps: [
          "Implement the Pomodoro Technique (25 mins study, 5 mins break).",
          "Dedicate at least 7 hours to sleep tonight.",
          "Write down one topic you mastered today to build self-confidence.",
        ],
      },
      mindfulnessExercise:
        "4-7-8 Breathing Technique: Inhale for 4 seconds, hold for 7 seconds, and exhale completely for 8 seconds.",
      empatheticMessage: `You are maintaining a steady course, but there are clear signs of fatigue under the surface. Make sure you don't compromise your sleep for ${targetExam} prep. You are doing well!`,
    };
  }

  return {
    emotions: ["Focused", "Motivated", "Calm"],
    triggers: ["Minor time-management pressure"],
    copingStrategy: {
      title: "Optimizing High Performance",
      actionableSteps: [
        "Review your progress tracker to celebrate small wins.",
        "Schedule active recall sessions for your most challenging topics.",
        "Hydrate frequently throughout the day.",
      ],
    },
    mindfulnessExercise:
      "Mindful Listening: Sit quietly and focus solely on the ambient sounds around you for 2 minutes.",
    empatheticMessage: `It is wonderful to see you in a focused and calm state. Preparing for ${targetExam} requires this level of mindfulness and dedication. Keep up this healthy momentum!`,
  };
}

/**
 * Layers in extra triggers and coping steps based on specific keywords found in
 * the text. Mutates the provided triggers and steps arrays.
 */
function applyContextualTriggers(
  textLower: string,
  triggers: string[],
  copingSteps: string[],
): void {
  if (
    textLower.includes("mock test") ||
    textLower.includes("marks") ||
    textLower.includes("score")
  ) {
    triggers.push("Anxiety stemming from mock test scores");
    copingSteps.unshift(
      "Remind yourself that mock tests are diagnostic tools to find gaps, not final predictors of your exam success.",
    );
  }
  if (
    textLower.includes("syllabus") ||
    textLower.includes("time") ||
    textLower.includes("backlog")
  ) {
    triggers.push("Overwhelm due to syllabus backlog");
    copingSteps.push(
      "Create a structured checklist focusing on high-weightage topics first to clear backlogs systematically.",
    );
  }
}

/**
 * Generates an offline fallback response that mimics the student wellness counselor.
 * Employs heuristic-based crisis detection to preserve safety behavior offline.
 */
export function generateOfflineMockAnalysis(
  entry: JournalEntryRequest,
): WellnessAnalysisResponse {
  const textLower = entry.journalText.toLowerCase();

  if (containsCrisisLanguage(textLower)) {
    return buildCrisisResponse();
  }

  const base = analyzeByMood(entry.moodScore, entry.targetExam);
  const triggers = [...base.triggers];
  const copingSteps = [...base.copingStrategy.actionableSteps];

  applyContextualTriggers(textLower, triggers, copingSteps);

  return {
    detectedEmotions: Array.from(new Set(base.emotions)),
    hiddenTriggers: Array.from(new Set(triggers)),
    copingStrategy: {
      title: base.copingStrategy.title,
      actionableSteps: copingSteps.slice(0, MAX_ACTIONABLE_STEPS),
    },
    mindfulnessExercise: base.mindfulnessExercise,
    empatheticMessage: base.empatheticMessage,
    crisisAlert: false,
  };
}
