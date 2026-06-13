import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./api/routes.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve public directory path
const publicPath = path.resolve("src/public");

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: ["'self'"],
      },
    },
  }),
);

app.use(cors());
app.use(express.json());

// Register API Routes
app.use("/api", routes);

// Lightweight health check (kept out of the way of the static frontend)
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "Wellness API Online" });
});

// Serve frontend static assets from public folder (index.html served at "/").
// Cache fingerprint-free assets briefly, but always revalidate index.html so the
// latest UI is served after a deploy.
app.use(
  express.static(publicPath, {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Fallback to index.html for single page layout
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(publicPath, "index.html"));
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Express Unhandled Error Details:", err);
  res.status(500).json({
    status: "error",
    message: "An internal server error occurred while processing your request.",
  });
});

// Avoid binding port in test environment for supertest compliance
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
