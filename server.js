const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Candidate } = require("../../models"); // adjust if your models path is different

const router = express.Router();

/** ---------- Uploads setup ---------- */
// Save files under PROJECT_ROOT/uploads/candidates
const ROOT_DIR = path.join(__dirname, "..", "..");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads", "candidates");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const fileFilter = (_req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image uploads are allowed"));
};
const upload = multer({ storage, fileFilter });

/** Helper to attach absolute photoUrl */
function withPhotoUrl(req, row) {
  const obj = row.toJSON ? row.toJSON() : row;
  if (obj.photoPath) obj.photoUrl = `${req.protocol}://${req.get("host")}${obj.photoPath}`;
  return obj;
}

/** Safe unlink (handles leading slash on stored path) */
function safeUnlink(relPath) {
  try {
    if (!relPath) return;
    const cleaned = String(relPath).replace(/^[\\/]/, ""); // remove leading / or \
    const abs = path.join(ROOT_DIR, cleaned);
    fs.unlinkSync(abs);
  } catch (_) {}
}

/** ---------- Routes ---------- */

// LIST (optional ?level=College)
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (req.query.level) where.level = req.query.level;
    const rows = await Candidate.findAll({
      where,
      order: [["created_at", "DESC"]],
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
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// CREATE
router.post("/", upload.single("photo"), async (req, res) => {
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

    const photoPath = req.file ? `/uploads/candidates/${req.file.filename}` : null;

    const created = await Candidate.create({
      level: level || null,
      position,
      partyList,
      firstName,
      middleName: middleName || null,
      lastName,
      gender,
      year,
      photoPath,
    });

    res.status(201).json(withPhotoUrl(req, created));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create candidate" });
  }
});

// UPDATE (photo optional)
router.put("/:id", upload.single("photo"), async (req, res) => {
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
      // replace existing photo
      safeUnlink(row.photoPath);
      row.photoPath = `/uploads/candidates/${req.file.filename}`;
    }

    // update fields if provided
    if (level !== undefined) row.level = level || null;
    if (position !== undefined) row.position = position;
    if (partyList !== undefined) row.partyList = partyList;
    if (firstName !== undefined) row.firstName = firstName;
    if (middleName !== undefined) row.middleName = middleName || null;
    if (lastName !== undefined) row.lastName = lastName;
    if (gender !== undefined) row.gender = gender;
    if (year !== undefined) row.year = year;

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
