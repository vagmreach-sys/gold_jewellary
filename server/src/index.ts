import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { openApiSpec } from "./openapi.js";
import { ok, fail } from "./lib/response.js";
import { v1Router } from "./routes/v1/index.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");
const port = parseInt(process.env.PORT ?? "4000", 10);
const clientOrigin = process.env.CLIENT_ORIGIN ?? `http://localhost:${port}`;

const app = express();

app.use(
  cors({
    origin: [clientOrigin, `http://localhost:${port}`, "http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/v1/cart", limiter);
app.use("/api/v1/payments", limiter);
app.use("/api/v1/auth", rateLimit({ windowMs: 60 * 1000, max: 30 }));

app.get("/health", (_req, res) => ok(res, { status: "ok" }));
app.get("/openapi.json", (_req, res) => res.json(openApiSpec));

app.use("/api/v1", v1Router);

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.originalUrl.startsWith("/api") && !res.headersSent) {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large. Photos max 5MB each; video max 50MB."
          : err.message;
      return fail(res, 400, message, "VALIDATION_ERROR");
    }
    if (err instanceof Error) {
      return fail(res, 500, err.message, "INTERNAL_ERROR");
    }
  }
  next(err);
});

app.use(
  express.static(publicDir, {
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  }),
);

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"));
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/admin")) {
    return res.sendFile(path.join(publicDir, "admin", "index.html"));
  }
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`VAGMREACH API + storefront: http://localhost:${port}`);
});
