// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { fn, col, where } = require('sequelize');
const { Admin } = require('../../models'); // ← fixed: one level up from routes/

// ---- helpers ----
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [type, token] = auth.split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT secret not set');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function cleanStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// ---- REGISTER ----
// Body: { "admin_username":"admin", "admin_password":"codeastro" }
router.post('/register', async (req, res) => {
  try {
    const admin_username_raw = cleanStr(req.body?.admin_username);
    const admin_password = cleanStr(req.body?.admin_password);

    if (!admin_username_raw || !admin_password) {
      return res.status(400).json({ error: 'admin_username and admin_password are required' });
    }
    if (admin_password.length < 4) {
      return res.status(400).json({ error: 'Password too short' });
    }

    // Normalize username (store as provided, check case-insensitively)
    const admin_username = admin_username_raw;

    // case-insensitive username check
    const exists = await Admin.findOne({
      where: where(fn('LOWER', col('admin_username')), admin_username.toLowerCase()),
    });
    if (exists) return res.status(409).json({ error: 'Username already exists' });

    // If your model has a beforeCreate hook that hashes, don't hash here
    const hasBeforeCreateHook =
      Admin?.options?.hooks?.beforeCreate && Admin.options.hooks.beforeCreate.length > 0;

    const payload = {
      admin_username,
      admin_password: hasBeforeCreateHook ? admin_password : await bcrypt.hash(admin_password, 10),
    };

    const admin = await Admin.create(payload);
    return res.status(201).json({ id: admin.id, admin_username: admin.admin_username });
  } catch (e) {
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('[AUTH /register]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ---- LOGIN ----
// Body: { "admin_username":"admin", "admin_password":"codeastro" }
router.post('/login', async (req, res) => {
  try {
    const admin_username_raw = cleanStr(req.body?.admin_username);
    const admin_password = cleanStr(req.body?.admin_password);

    if (!admin_username_raw || !admin_password) {
      return res.status(400).json({ error: 'admin_username and admin_password are required' });
    }

    // case-insensitive lookup
    const admin = await Admin.findOne({
      where: where(fn('LOWER', col('admin_username')), admin_username_raw.toLowerCase()),
    });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = admin.checkPassword
      ? await admin.checkPassword(admin_password)
      : await bcrypt.compare(admin_password, admin.admin_password);

    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT secret not configured' });
    }

    const token = jwt.sign(
      { sub: admin.id, role: 'admin', username: admin.admin_username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token });
  } catch (e) {
    console.error('[AUTH /login]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ---- Who am I (test) ----
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Optional quick ping for testing
router.get('/ping', (_req, res) => res.json({ ok: true, scope: 'auth' }));

module.exports = router;
