const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Candidate } = require("../models");

const router = express.Router();

// ensure upload dir
const uploadDir = path.join(__dirname, "..", "uploads", "candidates");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]/g, "_");
    const name = `${Date.now()}-${safe}`;
    cb(null, name);
  },
});
const fileFilter = (_req, file, cb) => {
  if (/^image\//.test(file.mimetype)) return cb(null, true);
  cb(new Error("Only image uploads are allowed"));
};
const upload = multer({ storage, fileFilter });

// Create
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

    const candidate = await Candidate.create({
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

    // Attach absolute photoUrl for convenience
    const json = candidate.toJSON();
    if (photoPath) json.photoUrl = `${req.protocol}://${req.get("host")}${photoPath}`;
    res.status(201).json(json);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to create candidate" });
  }
});

// List (optional filter by level)
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (req.query.level) where.level = req.query.level;
    const rows = await Candidate.findAll({ where, order: [["created_at", "DESC"]] });
    const data = rows.map((c) => {
      const o = c.toJSON();
      if (o.photoPath) o.photoUrl = `${req.protocol}://${req.get("host")}${o.photoPath}`;
      return o;
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// Get one
router.get("/:id", async (req, res) => {
  try {
    const c = await Candidate.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    const o = c.toJSON();
    if (o.photoPath) o.photoUrl = `${req.protocol}://${req.get("host")}${o.photoPath}`;
    res.json(o);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// Update (photo optional)
router.put("/:id", upload.single("photo"), async (req, res) => {
  try {
    const c = await Candidate.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });

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

    // handle new photo
    if (req.file) {
      // delete old file if exists
      if (c.photoPath) {
        try {
          fs.unlinkSync(path.join(__dirname, "..", c.photoPath));
        } catch (_) {}
      }
      c.photoPath = `/uploads/candidates/${req.file.filename}`;
    }

    c.level = level ?? c.level;
    c.position = position ?? c.position;
    c.partyList = partyList ?? c.partyList;
    c.firstName = firstName ?? c.firstName;
    c.middleName = middleName ?? c.middleName;
    c.lastName = lastName ?? c.lastName;
    c.gender = gender ?? c.gender;
    c.year = year ?? c.year;

    await c.save();

    const o = c.toJSON();
    if (o.photoPath) o.photoUrl = `${req.protocol}://${req.get("host")}${o.photoPath}`;
    res.json(o);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to update candidate" });
  }
});

// Delete
router.delete("/:id", async (req, res) => {
  try {
    const c = await Candidate.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });

    if (c.photoPath) {
      try {
        fs.unlinkSync(path.join(__dirname, "..", c.photoPath));
      } catch (_) {}
    }

    await c.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

module.exports = router;
