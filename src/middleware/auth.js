// src/middleware/auth.js
const jwt = require("jsonwebtoken");

/** Extract JWT from cookie or Authorization header */
function getToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;

  const auth = req.headers.authorization || "";
  // Matches "Bearer <token>" (case-insensitive)
  const m = auth.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (m) return m[1];

  return null;
}

/** Normalize whatever your login put in the token into a consistent req.user */
function normalizeUser(payload) {
  // Some apps sign { user: {...} }, others sign {...} directly.
  const raw = payload?.user ? payload.user : payload || {};

  // Prefer explicit role; fall back to isAdmin boolean.
  const roleRaw =
    raw.role ??
    raw.roleName ??
    (raw.isAdmin === true ? "admin" : undefined) ??
    "";

  const role = String(roleRaw).trim().toLowerCase();

  return {
    ...raw,
    role,
    isAdmin: role === "admin" || raw.isAdmin === true,
  };
}

/** Require a valid JWT (401 if missing/invalid) */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Unauthenticated: no token" });

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret" // ⚠️ set JWT_SECRET in production
      // You can add verify options here (issuer, audience, etc.)
    );

    req.user = normalizeUser(payload);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Require specific role(s) (403 if role mismatch).
 * Usage:
 *   router.get('/admin', requireAuth, requireRole('admin'), handler)
 *   router.get('/staff', requireAuth, requireRole(['admin','staff']), handler)
 */
function requireRole(required) {
  const needs = Array.isArray(required)
    ? required.map((r) => String(r).toLowerCase())
    : [String(required).toLowerCase()];

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });

    const role = String(req.user.role || "").toLowerCase();
    if (!needs.includes(role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: role mismatch", need: needs, got: role || null });
    }
    next();
  };
}

/** Convenience: admin-only */
const requireAdmin = (req, res, next) =>
  requireRole("admin")(req, res, next);

module.exports = { requireAuth, requireRole, requireAdmin };
