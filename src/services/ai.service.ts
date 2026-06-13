import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import {
  JournalEntryRequest,
  WellnessAnalysisResponse,
} from "../types/index.js";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const isApiKeyConfigured =
  apiKey && apiKey !== "your_gemini_api_key_here" && apiKey.trim() !== "";

// Initialize the Gemini SDK if key is configured
let genAI: GoogleGenerativeAI | null = null;
if (isApiKeyConfigured) {
  genAI = new GoogleGenerativeAI(apiKey!);
}

// Model name is configurable so it can be updated without code changes as Google
// rotates model versions. Defaults to a current stable Flash model.
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/**
 * Enforces strict schema return from Gemini matching the WellnessAnalysisResponse interface
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
 * Analyzes a student's journal entry to detect burnout, stress, and crisis alerts.
 * Uses Gemini AI if the API key is configured; otherwise falls back to the offline mock analyzer.
 */
export async function analyzeJournal(
  entry: JournalEntryRequest,
): Promise<WellnessAnalysisResponse> {
  if (!isApiKeyConfigured || !genAI) {
    return generateOfflineMockAnalysis(entry);
  }

  try {
    const model = genAI.getGenerativeModel({
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
    const text = result.response.text();
    const parsedData = JSON.parse(text);

    return parsedData as WellnessAnalysisResponse;
  } catch (error) {
    console.error("Gemini API Error, falling back to mock:", error);
    // If the API fails mid-way, fall back to mock to ensure non-crashing service
    return generateOfflineMockAnalysis(entry);
  }
}

/**
 * Generates an offline fallback response that mimics the student wellness counselor.
 * Employs heuristic-based crisis detection to simulate safety behaviors offline.
 */
export function generateOfflineMockAnalysis(
  entry: JournalEntryRequest,
): WellnessAnalysisResponse {
  const textLower = entry.journalText.toLowerCase();

  // Crisis detection heuristics
  const crisisKeywords = [
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

  const hasCrisisWords = crisisKeywords.some((keyword) =>
    textLower.includes(keyword),
  );

  if (hasCrisisWords) {
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
      empatheticMessage:
        "It sounds like you are carrying an incredibly heavy weight right now, and I want you to know that your life and well-being are far more important than any exam. You do not have to go through this alone. Please connect with someone who can support you. You can reach out to Sneha India Helpline at +91-44-24640050 or Vandrevala Foundation at +91-9999666555. They offer free, confidential support 24/7.",
      crisisAlert: true,
    };
  }

  // Normal offline analysis based on mood score and input contents
  const emotions: string[] = [];
  const triggers: string[] = [];
  let copingTitle = "Balanced Study Scheduling";
  let copingSteps: string[] = [];
  let exercise = "Deep Breathing: 5 cycles of slow inhalation and exhalation.";
  let message = "";

  // Analyze Mood Score
  if (entry.moodScore <= 3) {
    emotions.push("Exhausted", "Anxious", "Stressed");
    triggers.push(
      "Burnout from high-intensity study schedule",
      "Anxiety about exam results",
    );
    copingTitle = "Cognitive Offloading & Recovery";
    copingSteps = [
      "Take a complete 2-hour break from all exam preparation books and devices.",
      "Go for a 15-minute walk outside in natural light.",
      "Break your target preparation topics into micro-tasks of 20 minutes each.",
    ];
    exercise =
      "5-4-3-2-1 Grounding: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste.";
    message = `Preparing for ${entry.targetExam} is a marathon, not a sprint. A mood score of ${entry.moodScore} indicates you are running on empty. It is okay to take a step back and rest; resting is a crucial part of studying effectively.`;
  } else if (entry.moodScore <= 6) {
    emotions.push("Apprehensive", "Fatigued", "Determined");
    triggers.push(
      "Peer pressure or high expectations",
      "Inconsistent sleep pattern",
    );
    copingTitle = "Sustained Focus & Pacing";
    copingSteps = [
      "Implement the Pomodoro Technique (25 mins study, 5 mins break).",
      "Dedicate at least 7 hours to sleep tonight.",
      "Write down one topic you mastered today to build self-confidence.",
    ];
    exercise =
      "4-7-8 Breathing Technique: Inhale for 4 seconds, hold for 7 seconds, and exhale completely for 8 seconds.";
    message = `You are maintaining a steady course, but there are clear signs of fatigue under the surface. Make sure you don't compromise your sleep for ${entry.targetExam} prep. You are doing well!`;
  } else {
    emotions.push("Focused", "Motivated", "Calm");
    triggers.push("Minor time-management pressure");
    copingTitle = "Optimizing High Performance";
    copingSteps = [
      "Review your progress tracker to celebrate small wins.",
      "Schedule active recall sessions for your most challenging topics.",
      "Hydrate frequently throughout the day.",
    ];
    exercise =
      "Mindful Listening: Sit quietly and focus solely on the ambient sounds around you for 2 minutes.";
    message = `It is wonderful to see you in a focused and calm state. Preparing for ${entry.targetExam} requires this level of mindfulness and dedication. Keep up this healthy momentum!`;
  }

  // Check custom text clues for specific exam struggles
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

  // De-duplicate lists
  const uniqueEmotions = Array.from(new Set(emotions));
  const uniqueTriggers = Array.from(new Set(triggers));

  return {
    detectedEmotions: uniqueEmotions,
    hiddenTriggers: uniqueTriggers,
    copingStrategy: {
      title: copingTitle,
      actionableSteps: copingSteps.slice(0, 3),
    },
    mindfulnessExercise: exercise,
    empatheticMessage: message,
    crisisAlert: false,
  };
}
