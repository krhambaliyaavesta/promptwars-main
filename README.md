# MindCompanion — Mental Wellness Tracker for Exam Aspirants

A supportive AI companion for students preparing for high-stakes competitive exams
(JEE, NEET, UPSC, Board exams). A student writes a short journal entry, picks how they
feel, and names the exam they're preparing for. MindCompanion responds with empathetic,
structured insights — and, most importantly, surfaces crisis support when it detects
serious distress.

## Chosen vertical

Mental wellness for competitive-exam students. These students face sustained,
high-pressure schedules where burnout and anxiety are common and often unspoken. The
assistant makes context-aware decisions from the journal text, mood score, and target
exam, and prioritizes user safety above everything else.

## Approach and logic

- **Type-safe monolith.** A Node.js + Express + TypeScript server exposes the API and
  serves a vanilla HTML / JavaScript / Tailwind frontend. No React, no bundler, single
  deployable unit.
- **Structured AI output.** `src/services/ai.service.ts` calls Gemini with a strict
  `responseSchema`, forcing the model to return exactly the
  `WellnessAnalysisResponse` shape. This makes the UI trivial and reliable to render.
- **Crisis safety.** The system prompt instructs the model to set `crisisAlert: true`
  and include helpline details when the entry shows self-harm or severe distress. The
  frontend shows an assertive alert banner, and helplines + a disclaimer are visible at
  all times regardless of input.
- **Offline mock fallback.** With no API key configured, a deterministic mock analyzer
  (including keyword-based crisis detection) drives the full experience, so the app runs
  instantly for reviewers.
- **No RAG.** Purely structured zero-shot prompting.

## How the solution works

1. The user submits the journal form (`/`).
2. `POST /api/analyze-journal` validates and sanitizes the inputs (`journalText`,
   `moodScore` 1-10, `targetExam`).
3. The route checks a short-lived in-memory cache for identical requests.
4. On a cache miss it calls the AI service (Gemini, or the offline mock).
5. The structured `WellnessAnalysisResponse` is returned and cached.
6. The frontend renders the empathetic message, detected emotions, hidden triggers,
   coping steps, and a mindfulness exercise — or, if `crisisAlert` is true, a prominent
   safety banner with helplines.

### Data contract

Request:

```json
{ "journalText": "string", "moodScore": 6, "targetExam": "JEE" }
```

Response (`WellnessAnalysisResponse`):

```json
{
  "detectedEmotions": ["string"],
  "hiddenTriggers": ["string"],
  "copingStrategy": { "title": "string", "actionableSteps": ["string"] },
  "mindfulnessExercise": "string",
  "empatheticMessage": "string",
  "crisisAlert": false
}
```

## Project structure

```
src/
  api/        Express routes + tests (analyze-journal, validation, cache, rate limit)
  services/   Gemini AI logic + offline mock fallback
  public/     Vanilla frontend (index.html, app.js) — MindCompanion design
  types/      Shared TypeScript interfaces (the frontend/backend contract)
  server.ts   Express app: helmet, cors, static serving, error handling
docs/         Phased build plan + progress tracker
```

## Setup and run

```bash
npm install
cp .env.example .env          # optional: add GEMINI_API_KEY for live Gemini calls
npm run dev                   # http://localhost:3000
```

The mood buttons (Calm / Okay / Anxious / Overwhelmed) map to a 1-10 score behind the
scenes to match the API contract.

Other commands:

```bash
npm test       # jest + supertest (AI service mocked)
npm run build  # TypeScript compile
npm start      # run the compiled server from dist/
```

Without `GEMINI_API_KEY`, the app uses the offline mock and is fully usable, including
the crisis path.

## Security

- `GEMINI_API_KEY` is loaded via `dotenv`, never hardcoded.
- `helmet` (with a tuned CSP) and `cors`.
- Input validation + sanitization (length caps, type/range checks) before the model.
- `express-rate-limit` on the API.
- All model/user content is rendered as text in the DOM (no `innerHTML`) to avoid XSS.

## Accessibility

Semantic landmarks, labelled inputs, a keyboard-operable mood radio group with visible
focus, `aria-live` result/loading regions, and a `role="alert"` crisis banner. Colors
follow the calming MindCompanion palette chosen for AA contrast. Note: automated and
manual checks cover most issues, but full WCAG conformance requires testing with real
assistive technologies and expert review.

## Assumptions

- Helplines are India-based (Sneha India, Vandrevala Foundation, emergency 112).
- Single-user demo: no authentication or accounts.
- The in-memory cache is per-process and not shared across instances.
- Gemini model: `gemini-2.5-flash` by default, overridable via the `GEMINI_MODEL`
  environment variable (update it if Google rotates the model).

## Future scope (designed, not built for this submission)

The MindCompanion design system also includes a wellness dashboard, a real-time chat
companion, and a resource library. These are intentionally out of scope for this
warmup, which focuses on doing the journal-analysis flow well.

## Disclaimer

MindCompanion offers supportive guidance and is **not** a substitute for professional
medical or psychological care. In an emergency, contact local emergency services.
