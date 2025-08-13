// src/routes/candidate.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

/** ---------- Resolve project root + models ---------- */
const ROOT_DIR = path.join(__dirname, "..", ".."); // project root
const db = require(path.join(ROOT_DIR, "models")); // models/index.js must export Candidate
const { Candidate } = db;

/** ---------- Uploads setup ---------- */
// Save files under PROJECT_ROOT/uploads/candidates
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads", "candidates");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "photo").replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe.slice(-100)}`);
  },
});
const fileFilter = (_req, file, cb) => {
  if (file?.mimetype?.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image uploads are allowed"));
};
const upload = multer({ storage, fileFilter });

// Wrap multer so errors return JSON (not HTML)
function runUpload(req, res, next) {
  upload.single("photo")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

/** Helper to attach absolute photoUrl */
function withPhotoUrl(req, row) {
  const obj = row?.toJSON ? row.toJSON() : row;
  if (obj?.photoPath) obj.photoUrl = `${req.protocol}://${req.get("host")}${obj.photoPath}`;
  return obj;
}

/** Safe unlink (handles leading slash on stored path) */
function safeUnlink(relPath) {
  try {
    if (!relPath) return;
    const cleaned = String(relPath).replace(/^[\\/]/, "");
    const abs = path.join(ROOT_DIR, cleaned);
    fs.unlinkSync(abs);
  } catch (_) {}
}

/** Coerce any input into a clean string (never "NaN") */
function toYearString(v) {
  const s = (typeof v === "string" ? v : String(v ?? "")).trim();
  return s === "NaN" ? "" : s;
}

/** Prefer createdAt; fall back to created_at; else id */
const createdField =
  Candidate?.rawAttributes?.createdAt
    ? "createdAt"
    : Candidate?.rawAttributes?.created_at
    ? "created_at"
    : "id";

/** ---------- Routes ---------- */

// LIST (optional ?level=College)
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (req.query.level) where.level = req.query.level;

    const rows = await Candidate.findAll({
      where,
      order: [[createdField, "DESC"]],
    });

    res.json(rows.map((r) => withPhotoUrl(req, r)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// GET ONE
router.get("/:id", async (req, res) => {
  try {
    const row = await Candidate.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(withPhotoUrl(req, row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// CREATE
router.post("/", runUpload, async (req, res) => {
  try {
    const {
      level,
      position,
      partyList,
      firstName,
      middleName,
      lastName,
      gender,
      year,
    } = req.body;

    const yearStr = toYearString(year);
    if (!yearStr) return res.status(400).json({ error: "Year is required." });
    if (/^\d+$/.test(yearStr)) {
      return res
        .status(400)
        .json({ error: 'Year must be descriptive (e.g., "1st Year", "Grade 11"), not just digits.' });
    }

    const photoPath = req.file ? `/uploads/candidates/${req.file.filename}` : null;

    const created = await Candidate.create({
      level: level || null,
      position,
      partyList,
      firstName,
      middleName: middleName || null,
      lastName,
      gender,
      year: yearStr, // store as words (TEXT)
      photoPath,
    });

    res.status(201).json(withPhotoUrl(req, created));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create candidate" });
  }
});

// UPDATE (photo optional)
router.put("/:id", runUpload, async (req, res) => {
  try {
    const row = await Candidate.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    const {
      level,
      position,
      partyList,
      firstName,
      middleName,
      lastName,
      gender,
      year,
    } = req.body;

    if (req.file) {
      safeUnlink(row.photoPath);
      row.photoPath = `/uploads/candidates/${req.file.filename}`;
    }

    if (level !== undefined) row.level = level || null;
    if (position !== undefined) row.position = position;
    if (partyList !== undefined) row.partyList = partyList;
    if (firstName !== undefined) row.firstName = firstName;
    if (middleName !== undefined) row.middleName = middleName || null;
    if (lastName !== undefined) row.lastName = lastName;
    if (gender !== undefined) row.gender = gender;
    if (year !== undefined) {
      const yearStr = toYearString(year);
      if (!yearStr) return res.status(400).json({ error: "Year cannot be empty." });
      if (/^\d+$/.test(yearStr)) {
        return res
          .status(400)
          .json({ error: 'Year must be descriptive (e.g., "1st Year", "Grade 11"), not just digits.' });
      }
      row.year = yearStr;
    }

    await row.save();
    res.json(withPhotoUrl(req, row));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to update candidate" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const row = await Candidate.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    safeUnlink(row.photoPath);
    await row.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

module.exports = router;
