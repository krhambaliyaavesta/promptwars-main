import request from "supertest";
import app from "../server.js";
import * as aiService from "../services/ai.service.js";

// Mock the entire ai.service module to isolate route testing
jest.mock("../services/ai.service.js", () => {
  return {
    analyzeJournal: jest.fn(),
  };
});

describe("Mental Wellness Tracker API Tests", () => {
  const mockAnalyzeJournal = aiService.analyzeJournal as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    await request(app).post("/api/clear-cache");
  });

  afterAll(async () => {
    // Give Jest a moment to release handles if any
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe("GET /api/health", () => {
    it("should return 200 and the online status", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.message).toBe("Wellness API Online");
    });
  });

  describe("POST /api/analyze-journal", () => {
    const validPayload = {
      journalText:
        "I am feeling extremely stressed about the upcoming exam. There is so much mock test pressure.",
      moodScore: 4,
      targetExam: "JEE",
    };

    const mockAnalysisResponse = {
      detectedEmotions: ["Anxious", "Stressed", "Overwhelmed"],
      hiddenTriggers: ["Mock test score anxiety", "Peer pressure"],
      copingStrategy: {
        title: "Pacing & Self-Compassion Strategy",
        actionableSteps: [
          "Take a 15-minute screen-free break.",
          "Identify one topic of strength to boost confidence.",
          "Focus on mock tests as Diagnostic Tools rather than final outcomes.",
        ],
      },
      mindfulnessExercise:
        "4-7-8 Breathing Technique: Inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds.",
      empatheticMessage:
        "Preparing for JEE is a tough journey. It is completely natural to feel overwhelmed. Be kind to yourself.",
      crisisAlert: false,
    };

    it("should return 200 and the correct JSON schema for a valid request", async () => {
      mockAnalyzeJournal.mockResolvedValue(mockAnalysisResponse);

      const res = await request(app)
        .post("/api/analyze-journal")
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAnalysisResponse);
      expect(mockAnalyzeJournal).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeJournal).toHaveBeenCalledWith({
        journalText: validPayload.journalText,
        moodScore: validPayload.moodScore,
        targetExam: validPayload.targetExam,
      });
    });

    it("should surface a crisis alert with a supportive helpline message", async () => {
      const crisisResponse = {
        ...mockAnalysisResponse,
        empatheticMessage:
          "You do not have to go through this alone. Please reach out to Sneha India at +91-44-24640050.",
        crisisAlert: true,
      };
      mockAnalyzeJournal.mockResolvedValue(crisisResponse);

      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "I feel hopeless and I can't keep going with this prep.",
        moodScore: 1,
        targetExam: "UPSC",
      });

      expect(res.status).toBe(200);
      expect(res.body.crisisAlert).toBe(true);
      expect(res.body.empatheticMessage).toMatch(/\+91/);
    });

    it("should return 400 if moodScore is missing", async () => {
      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "Feeling okay",
        targetExam: "NEET",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Missing parameters");
      expect(mockAnalyzeJournal).not.toHaveBeenCalled();
    });

    it("should return 400 if journalText is empty or not a string", async () => {
      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "   ",
        moodScore: 5,
        targetExam: "UPSC",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid or empty 'journalText'");
      expect(mockAnalyzeJournal).not.toHaveBeenCalled();
    });

    it("should return 400 if moodScore is out of range (1-10)", async () => {
      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "Feeling a bit down",
        moodScore: 11,
        targetExam: "UPSC",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid 'moodScore'");
      expect(mockAnalyzeJournal).not.toHaveBeenCalled();
    });

    it("should return 400 if moodScore is not an integer", async () => {
      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "Feeling a bit down",
        moodScore: 5.5,
        targetExam: "UPSC",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid 'moodScore'");
    });

    it("should return 400 if targetExam is empty or not a string", async () => {
      const res = await request(app).post("/api/analyze-journal").send({
        journalText: "Trying hard",
        moodScore: 8,
        targetExam: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid or empty 'targetExam'");
    });

    it("should return 500 when the AI service throws an unhandled error", async () => {
      mockAnalyzeJournal.mockRejectedValue(
        new Error("Gemini Service Overloaded"),
      );

      const res = await request(app)
        .post("/api/analyze-journal")
        .send(validPayload);

      expect(res.status).toBe(500);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("internal server error occurred");
    });
  });

  describe("Caching Checks", () => {
    it("should serve duplicate requests from the cache on subsequent calls", async () => {
      const payload = {
        journalText: "Testing cache performance.",
        moodScore: 7,
        targetExam: "NEET",
      };

      const mockResponse = {
        detectedEmotions: ["Calm"],
        hiddenTriggers: [],
        copingStrategy: {
          title: "Maintain Momentum",
          actionableSteps: ["Keep going"],
        },
        mindfulnessExercise: "Breathe",
        empatheticMessage: "Looks good!",
        crisisAlert: false,
      };

      mockAnalyzeJournal.mockResolvedValue(mockResponse);

      // Clear the route's in-memory cache first
      await request(app).post("/api/clear-cache");

      // First request (Cache Miss)
      const res1 = await request(app)
        .post("/api/analyze-journal")
        .send(payload);

      expect(res1.status).toBe(200);

      // Second request (Cache Hit)
      const res2 = await request(app)
        .post("/api/analyze-journal")
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);

      // Verify the AI service was only called once
      expect(mockAnalyzeJournal).toHaveBeenCalledTimes(1);
    });
  });

  describe("Static asset serving", () => {
    it("should serve the app at / with a revalidating cache header", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.headers["cache-control"]).toMatch(/no-cache/);
    });

    it("should serve static assets with a Cache-Control max-age", async () => {
      const res = await request(app).get("/app.js");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toMatch(/max-age=\d+/);
    });
  });
});
