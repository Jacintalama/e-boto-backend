// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();

/* ---- Trust proxy (for secure cookies on prod) ---- */
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* ---- DB ---- */
const db = require(path.join(process.cwd(), "models"));
const { sequelize } = db;

/* ---- CORS ---- */
const allowlist = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // allow SSR / same-origin / tools with no Origin header
    if (!origin) return cb(null, true);
    if (allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

// Core CORS (most cases this is enough)
app.use(cors(corsOptions));
// ✅ Express 5 preflight handlers (use RegExp; avoid "*" or ":path*")
app.options(/^\/api\/.*$/, cors(corsOptions));
app.options(/^\/auth\/.*$/, cors(corsOptions));
// app.options(/^\/uploads\/.*$/, cors(corsOptions)); // enable only if you truly need cross-origin for uploads

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

/* ---- Static uploads ---- */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ---- Auth middleware (single source of truth) ---- */
const { requireAuth, requireRole } = require(path.join(process.cwd(), "src", "middleware", "auth"));

/* ---- Routers ---- */
const candidateRouter = require(path.join(process.cwd(), "src", "routes", "candidate"));
const authRouter = require(path.join(process.cwd(), "src", "routes", "auth"));
const votersRouter = require(path.join(process.cwd(), "src", "routes", "voters"));

/* ---- Mount routes ---- */
// Admin-only groups (avoid duplicate guards inside the routers)
app.use("/api/candidates", requireAuth, requireRole("admin"), candidateRouter);
app.use("/api/voters", requireAuth, requireRole("admin"), votersRouter);

// Auth routes (login/register/me)
app.use("/auth", authRouter);
app.use("/api/auth", authRouter);
app.use("/api", authRouter); // allows /api/login, /api/register, /api/auth/me

/* ---- Health ---- */
app.get("/", (_req, res) => {
  res.send("🚀 Backend API is running. Use /api/... endpoints.");
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

/* ---- Debug (remove in prod) ---- */
app.get("/api/_debug/whoami", (req, res) => {
  res.json({
    cookieNames: Object.keys(req.cookies || {}),
    hasAuthHeader: Boolean(req.headers.authorization),
    origin: req.headers.origin || null,
  });
});
app.get("/api/_debug/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/* ---- Error handler ---- */
app.use((err, _req, res, _next) => {
  console.error(err);
  const isCORS = String(err?.message || "").startsWith("Not allowed by CORS");
  const status = isCORS ? 403 : 500;
  res.status(status).json({ error: err.message || "Server error" });
});

/* ---- Start ---- */
const PORT = process.env.PORT || 4000;
sequelize
  .authenticate()
  .then(() => console.log("✅ DB connected"))
  .catch((err) => console.error("❌ DB connection failed:", err.message));

app.listen(PORT, () => console.log(`✅ Server listening on :${PORT}`));
