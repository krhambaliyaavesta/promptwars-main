import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import routes from "./api/routes.js";
import { PORT, PUBLIC_DIR, IS_TEST } from "./config.js";

const app = express();

// Security middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", routes);

// Lightweight health check (kept out of the way of the static frontend).
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Wellness API Online" });
});

// Serve frontend static assets (index.html served at "/"). Cache fingerprint-free
// assets briefly, but always revalidate index.html so the latest UI is served.
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Single-page fallback to index.html for any non-API route.
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Global error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Express unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "An internal server error occurred while processing your request.",
  });
});

// Avoid binding the port under test so supertest can import the app cleanly.
if (!IS_TEST) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
