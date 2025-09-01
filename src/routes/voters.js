// src/routes/voters.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");

const router = express.Router();

const ROOT_DIR = process.cwd();
const db = require(path.join(ROOT_DIR, "models"));
const { Voter } = db;

// ⬇️ auth middlewares (admin-only)
const { requireAuth, requireRole } = require(path.join(ROOT_DIR, "src", "middleware", "auth"));

/* ---------- Level/Year validation ---------- */
function normalizeSchoolId(id) {
  return String(id || "").trim().toLowerCase();
}

function normalizeYearForLevel(level, raw) {
  const s0 = String(raw || "").trim();
  const s = s0.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");

  const res = { ok: false, norm: null, reason: "" };

  const g = (n) => `Grade ${n}`;

  if (level === "Elementary") {
    // Accept Grade 1-6
    const m = s.match(/^(grade )?(1|2|3|4|5|6)(st|nd|rd|th)?$/);
    if (m) return { ok: true, norm: g(Number(m[2])) };
    res.reason = `Invalid for Elementary. Use Grade 1–6 (got “${s0}”).`;
    return res;
  }

  if (level === "JHS") {
    // Accept Grade 7-10
    const m = s.match(/^(grade )?(7|8|9|10)(st|nd|rd|th)?$/);
    if (m) return { ok: true, norm: g(Number(m[2])) };
    res.reason = `Invalid for JHS. Use Grade 7–10 (got “${s0}”).`;
    return res;
  }

  if (level === "SHS") {
    // Accept Grade 11/12 (G11/G12/11th/12th)
    if (/(^| )g?11(th)?( |$)/.test(s) || /grade 11/.test(s)) return { ok: true, norm: g(11) };
    if (/(^| )g?12(th)?( |$)/.test(s) || /grade 12/.test(s)) return { ok: true, norm: g(12) };
    res.reason = `Invalid for SHS. Use Grade 11 or Grade 12 (got “${s0}”).`;
    return res;
  }

  if (level === "College") {
    // Accept 1st–5th Year + synonyms
    if (/(^| )(1|1st|first|freshman)( |year|$)/.test(s)) return { ok: true, norm: "1st Year" };
    if (/(^| )(2|2nd|second|sophomore)( |year|$)/.test(s)) return { ok: true, norm: "2nd Year" };
    if (/(^| )(3|3rd|third|junior)( |year|$)/.test(s)) return { ok: true, norm: "3rd Year" };
    if (/(^| )(4|4th|fourth|senior)( |year|$)/.test(s)) return { ok: true, norm: "4th Year" };
    if (/(^| )(5|5th|fifth)( |year|$)/.test(s)) return { ok: true, norm: "5th Year" };

    // Common mistake: SHS values on College
    if (/grade 1[12]|(^| )g?1[12]( |$)/.test(s)) {
      res.reason = `This record is not valid for College (got “${s0}”, looks like SHS).`;
      return res;
    }
    res.reason = `Invalid for College. Use 1st–4th/5th Year (got “${s0}”).`;
    return res;
  }

  res.reason = `Unknown level “${level}”.`;
  return res;
}

/* ---------- Upload setup ---------- */
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads", "voters");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "voters").replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe.slice(-100)}`);
  },
});
const fileFilter = (_req, file, cb) => {
  const ok =
    file?.mimetype === "text/csv" ||
    file?.mimetype === "application/vnd.ms-excel" ||
    file?.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    /\.csv$/i.test(file?.originalname || "") ||
    /\.xlsx?$/i.test(file?.originalname || "");
  if (ok) return cb(null, true);
  cb(new Error("Only .csv, .xls, .xlsx files are allowed"));
};
const upload = multer({ storage, fileFilter });

function cleanup(filepath) {
  try { if (filepath) fs.unlinkSync(filepath); } catch {}
}

/* ---------- Helpers ---------- */
function pick(row, names) {
  for (const name of names) {
    const k = Object.keys(row).find(
      (h) => h?.toString().trim().toLowerCase() === name.toLowerCase()
    );
    if (k) {
      const v = row[k];
      if (v === undefined || v === null) return "";
      const s = String(v).trim();
      return s === "NaN" ? "" : s;
    }
  }
  return "";
}
function toStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "y" || s === "voted") return 1;
  return 0; // default not voted
}

/* ---------- Public debug (token only, no role gate) ---------- */
/* Use this while debugging cookies/JWT. Remove in prod. */
router.get("/_debug/whoami", requireAuth, (req, res) => {
  // requireAuth sets req.user (normalized by our middleware)
  res.json({ user: req.user || null });
});

/* ---------- 🔒 Protect ALL voters endpoints (admin-only) ---------- */
/* If server.js already does: app.use('/api/voters', requireAuth, requireRole('admin'), router)
   you can comment this next line to avoid double guards.
*/



/* ---------- POST /api/voters/import ---------- */
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    const level = String(req.body?.level || "").trim();
    if (!["Elementary", "JHS", "SHS", "College"].includes(level)) {
      cleanup(filePath);
      return res.status(400).json({ error: "Invalid or missing level" });
    }
    if (!filePath) return res.status(400).json({ error: "No file uploaded" });

    const wb = XLSX.readFile(filePath, { cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    let inserted = 0;
    let skippedMissing = 0;
    let invalid = 0;
    let duplicatesDb = 0;
    let duplicatesFile = 0;

    const invalidSamples = [];
    const duplicateSamples = [];

    await db.sequelize.transaction(async (t) => {
      // Preload existing schoolIds for this department for O(1) duplicate checks
      const existing = await Voter.findAll({
        where: { department: level },
        attributes: ["schoolId"],
        transaction: t,
      });
      const existingSet = new Set(
        existing.map((r) => normalizeSchoolId(r.schoolId))
      );

      const seenInFile = new Set(); // de-dupe within same upload

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];

        const schoolId = pick(r, ["school id", "schoolid", "id number", "student id", "sid", "id"]);
        const fullName = pick(r, ["full name", "fullname", "name"]);
        const course   = pick(r, ["course", "strand", "program"]);
        const yearRaw  = pick(r, ["year", "year level", "grade level", "grade"]);
        const status   = toStatus(pick(r, ["status", "voted", "has voted"]));
        const passwordRaw = pick(r, ["password", "pass", "pwd"]); // optional

        if (!schoolId || !fullName || !yearRaw) {
          skippedMissing++;
          continue;
        }

        // Validate YEAR against selected LEVEL (department)
        const val = normalizeYearForLevel(level, yearRaw);
        if (!val.ok) {
          invalid++;
          if (invalidSamples.length < 20) {
            invalidSamples.push({
              row: idx + 2, // +2 to account for header row (usually row 1)
              schoolId,
              fullName,
              reason: val.reason,
            });
          }
          continue;
        }
        const year = val.norm;

        const idKey = `${level}:${normalizeSchoolId(schoolId)}`;

        // file-level duplicate?
        if (seenInFile.has(idKey)) {
          duplicatesFile++;
          if (duplicateSamples.length < 20) {
            duplicateSamples.push({
              row: idx + 2,
              schoolId,
              fullName,
              reason: "Duplicate in file",
            });
          }
          continue;
        }

        // db-level duplicate? (already exists in this department) → SKIP (do not overwrite)
        if (existingSet.has(normalizeSchoolId(schoolId))) {
          duplicatesDb++;
          if (duplicateSamples.length < 20) {
            duplicateSamples.push({
              row: idx + 2,
              schoolId,
              fullName,
              reason: "Already exists in database for this department",
            });
          }
          continue;
        }

        // Create new record (no overwrite behavior)
        const values = {
          schoolId: String(schoolId).trim(),
          fullName: String(fullName).trim(),
          course: course ? String(course).trim() : null,
          year,
          status,
          department: level,
          ...(passwordRaw ? { passwordHash: await bcrypt.hash(passwordRaw, 10) } : {}),
        };

        await Voter.create(values, { transaction: t });
        inserted++;
        seenInFile.add(idKey);
        existingSet.add(normalizeSchoolId(schoolId)); // avoid second insert for same id
      }
    });

    cleanup(filePath);
    return res.json({
      ok: true,
      message: `Imported as ${level}`,
      inserted,
      skippedMissing,
      invalid,
      duplicatesDb,
      duplicatesFile,
      invalidSamples,   // up to 20 sample rows
      duplicateSamples, // up to 20 sample rows
    });
  } catch (e) {
    cleanup(filePath);
    console.error("[VOTERS /import]", e);
    return res.status(500).json({ error: "Failed to import voters" });
  }
});


/* ---------- GET /api/voters?department=College ---------- */
router.get("/", async (req, res) => {
  try {
    const where = {};
    const dep = String(req.query.department || "").trim();
    if (dep) where.department = dep;

    const rows = await Voter.findAll({
      where,
      attributes: { exclude: ["passwordHash"] },
      order: [["createdAt", "DESC"]],
    });

    res.json(rows);
  } catch (e) {
    console.error("[VOTERS /]", e);
    res.status(500).json({ error: "Failed to fetch voters" });
  }
});

/* ---------- PATCH /api/voters/:id/status (quick toggle) ---------- */
router.patch("/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const next = Number(req.body?.status);
    if (![0, 1].includes(next)) return res.status(400).json({ error: "status must be 0 or 1" });

    const row = await Voter.findByPk(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    row.status = next;
    await row.save();
    res.json({ ok: true, id, status: row.status });
  } catch (e) {
    console.error("[VOTERS PATCH /:id/status]", e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* ---------- GET /api/voters/:id (single; hide hash) ---------- */
router.get("/:id", async (req, res) => {
  try {
    const row = await Voter.findByPk(req.params.id, {
      attributes: { exclude: ["passwordHash"] },
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) {
    console.error("[VOTERS /:id]", e);
    res.status(500).json({ error: "Failed to fetch voter" });
  }
});

/* ---------- PATCH /api/voters/:id (generic edit) ---------- */
router.patch("/:id", async (req, res) => {
  try {
    const row = await Voter.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    const { fullName, course, year, status, password } = req.body || {};

    if (fullName !== undefined) row.fullName = String(fullName).trim();
    if (course !== undefined)   row.course   = course ? String(course).trim() : null;
    if (year !== undefined)     row.year     = String(year).trim();
    if (status !== undefined) {
      const s = Number(status);
      if (![0, 1].includes(s)) return res.status(400).json({ error: "status must be 0 or 1" });
      row.status = s;
    }
    if (password) row.passwordHash = await bcrypt.hash(String(password), 10);

    await row.save();
    const json = row.toJSON();
    delete json.passwordHash;
    res.json(json);
  } catch (e) {
    console.error("[VOTERS PATCH /:id]", e);
    res.status(500).json({ error: "Failed to update voter" });
  }
});

/* ---------- POST /api/voters (manual insertion) ---------- */
router.post("/", async (req, res) => {
  try {
    const { schoolId, fullName, course, year, status, department, password } = req.body || {};
    if (!schoolId || !fullName || !year || !department) {
      return res.status(400).json({ error: "schoolId, fullName, year, department are required" });
    }
    if (!["Elementary", "JHS", "SHS", "College"].includes(String(department))) {
      return res.status(400).json({ error: "Invalid department" });
    }
    const st = Number(status ?? 0);
    if (![0, 1].includes(st)) return res.status(400).json({ error: "status must be 0 or 1" });
    if (!password) return res.status(400).json({ error: "password is required" });

    const values = {
      schoolId: String(schoolId).trim(),
      fullName: String(fullName).trim(),
      course: course ? String(course).trim() : null,
      year: String(year).trim(),
      status: st,
      department: String(department),
      passwordHash: await bcrypt.hash(String(password), 10),
    };

    const created = await Voter.create(values);
    const json = created.toJSON();
    delete json.passwordHash;
    return res.status(201).json(json);
  } catch (e) {
    if (e?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Voter already exists for this department" });
    }
    console.error("[VOTERS POST /]", e);
    return res.status(500).json({ error: "Failed to create voter" });
  }
});

/* ---------- DELETE /api/voters/:id ---------- */
router.delete("/:id", async (req, res) => {
  try {
    const row = await Voter.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    await row.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error("[VOTERS DELETE /:id]", e);
    res.status(500).json({ error: "Failed to delete voter" });
  }
});

module.exports = router;
