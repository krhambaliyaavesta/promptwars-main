# HACKATHON EVALUATION CONSTRAINTS

You are building **MindCompanion**, a Node.js/TypeScript monolith with a vanilla
HTML/JS frontend: a Mental Wellness Tracker for students preparing for high-stakes
competitive exams (JEE, NEET, UPSC, Boards). Output is scored against 6 parameters.
Prioritize generation in this order.

## [HIGH IMPACT] 1. PROBLEM STATEMENT ALIGNMENT
- Core logic: analyze a student's journal entry together with a mood score (1-10) and a
  target exam, and return empathetic, structured wellness insights.
- Required output (and the API/UI must contain all of it):
  1. Detected emotions
  2. Hidden triggers / burnout patterns
  3. Coping strategy (title + actionable steps)
  4. Mindfulness exercise
  5. Empathetic message
  6. Crisis alert flag (`crisisAlert`)
- Safety is mandatory: if the entry shows self-harm or severe distress, `crisisAlert`
  must be true and the message must point to helplines. The UI must surface this
  prominently and keep helplines reachable at all times.
- Architecture: use the `@google/generative-ai` SDK with a strict response schema. NO
  RAG. Zero-shot / few-shot structured prompting only. No React, no bundler.

## [HIGH IMPACT] 2. CODE QUALITY
- Strict TypeScript backend, vanilla JavaScript frontend.
- Separation of concerns: `src/api/` routes, `src/services/` Gemini logic,
  `src/public/` static frontend, `src/types/` shared interfaces.
- Self-documenting names; global Express error handling; no unhandled rejections.
- The frontend/backend contract is `WellnessAnalysisResponse` in `src/types/index.ts`.
  Change the type first if the contract must evolve.

## [MEDIUM IMPACT] 3. SECURITY
- Never hardcode `GEMINI_API_KEY`; load via `dotenv`.
- Use `helmet` and `cors`.
- Validate and sanitize all inputs (journalText, moodScore, targetExam) before they
  reach the model.
- Rate-limit the AI endpoint with `express-rate-limit`.
- Render all model/user content in the DOM as text (no `innerHTML`) to prevent XSS.
- Never fabricate medical advice in the UI; safety copy comes from the backend.

## [MEDIUM IMPACT] 4. EFFICIENCY
- Fully async, non-blocking server.
- In-memory cache for identical requests within a short window.
- Keep the system prompt concise but strictly structured.

## [LOW IMPACT] 5. TESTING
- `jest` + `supertest`. Mock the AI service.
- Cover the `/api/analyze-journal` contract: 200 success, validation 400s, 500 path,
  caching, and the crisis path.

## [LOW IMPACT] 6. ACCESSIBILITY
- Semantic HTML (`<header>`, `<main>`, `<section>`, `<footer>`).
- Labels for every input; `aria-live` on loading/results; `role="alert"` on the crisis
  banner and inline errors.
- Keyboard operable with visible focus; WCAG AA contrast.
