// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDatabase, saveDatabase } = require("../config/database");

const SALT_ROUNDS = 10;

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

function getAll(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

function run(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDatabase();

  const result = db.exec("SELECT last_insert_rowid() AS id;");
  const lastInsertId = result?.[0]?.values?.[0]?.[0] ?? null;

  return { lastInsertRowid: lastInsertId };
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = getOne(
      `
      SELECT u.*, r.name AS role_name, r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
      `,
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Account disabled. Contact IT support." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    console.log(`✅ Login: ${user.email} (${user.role_name} / level ${user.role_level})`);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        role_level: user.role_level,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "name, email, password, and role are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = getOne(
      `
      SELECT u.*, r.name AS role_name, r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
      `,
      [normalizedEmail]
    );

    if (existing) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const roleRecord = getOne(`SELECT id FROM roles WHERE name = ?`, [role]);

    if (!roleRecord) {
      const validRoles = getAll(`SELECT name FROM roles`).map((r) => r.name);
      return res.status(400).json({
        error: `Invalid role "${role}".`,
        valid_roles: validRoles,
      });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = run(
      `
      INSERT INTO users (name, email, password_hash, role_id)
      VALUES (?, ?, ?, ?)
      `,
      [name, normalizedEmail, password_hash, roleRecord.id]
    );

    res.status(201).json({
      message: "User created successfully.",
      user_id: result.lastInsertRowid,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
}

function verifyToken(req, res) {
  res.json({
    valid: true,
    user: req.user,
  });
}

module.exports = { login, register, verifyToken };