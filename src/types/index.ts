export interface JournalEntryRequest {
  journalText: string;
  moodScore: number;
  targetExam: string;
}

export interface CopingStrategy {
  title: string;
  actionableSteps: string[];
}

export interface WellnessAnalysisResponse {
  detectedEmotions: string[];
  hiddenTriggers: string[];
  copingStrategy: CopingStrategy;
  mindfulnessExercise: string;
  empatheticMessage: string;
  crisisAlert: boolean;
}
