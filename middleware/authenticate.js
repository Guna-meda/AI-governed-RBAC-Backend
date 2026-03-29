// middleware/authenticate.js
const jwt = require("jsonwebtoken");
const { getDatabase } = require("../config/database");

function getOne(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }

  stmt.free();
  return row;
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No token provided",
        hint: "Include header: Authorization: Bearer <your_token>",
      });
    }

    const token = authHeader.split(" ")[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired. Please log in again." });
      }
      return res.status(401).json({ error: "Invalid token." });
    }

    const user = getOne(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.is_active,
        r.id AS role_id,
        r.name AS role_name,
        r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      `,
      [payload.userId]
    );

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Your account has been disabled. Contact IT." });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      role_level: user.role_level,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication error." });
  }
}

module.exports = authenticate;