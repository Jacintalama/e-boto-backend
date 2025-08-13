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

    let inserted = 0, updated = 0, skipped = 0;

    await db.sequelize.transaction(async (t) => {
      for (const r of rows) {
        const schoolId = pick(r, ["school id", "schoolid", "id number", "student id", "sid", "id"]);
        const fullName = pick(r, ["full name", "fullname", "name"]);
        const course   = pick(r, ["course", "strand", "program"]);
        const year     = pick(r, ["year", "year level", "grade level", "grade"]);
        const status   = toStatus(pick(r, ["status", "voted", "has voted"]));
        const passwordRaw = pick(r, ["password", "pass", "pwd"]); // optional

        if (!schoolId || !fullName || !year) { skipped++; continue; }

        const values = {
          schoolId, fullName, course: course || null, year, status, department: level,
        };

        if (passwordRaw) values.passwordHash = await bcrypt.hash(passwordRaw, 10);

        // Upsert WITHOUT overwriting password when not provided
        const [row, created] = await Voter.upsert(values, { transaction: t, returning: true });
        if (created) inserted++; else updated++;
      }
    });

    cleanup(filePath);
    return res.json({ ok: true, message: `Imported as ${level}`, inserted, updated, skipped });
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
