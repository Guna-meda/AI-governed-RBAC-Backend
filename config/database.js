// config/database.js
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "../governance.db");

let SQL = null;
let db = null;

async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs({});

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      level       INTEGER NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role_id       INTEGER NOT NULL REFERENCES roles(id),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resources (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      display_name TEXT    NOT NULL,
      min_level    INTEGER NOT NULL,
      description  TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id     INTEGER NOT NULL REFERENCES roles(id),
      resource_id INTEGER NOT NULL REFERENCES resources(id),
      can_access  INTEGER NOT NULL DEFAULT 1,
      UNIQUE(role_id, resource_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id),
  user_email    TEXT,
  role_name     TEXT    NOT NULL,
  role_level    INTEGER NOT NULL,
  query_text    TEXT    NOT NULL,
  resource_tags TEXT,
  decision      TEXT    NOT NULL CHECK(decision IN ('ALLOW', 'DENY', 'NOT_FOUND')),
  deny_reason   TEXT,
  answer        TEXT,
  sources       TEXT,
  ip_address    TEXT,
  timestamp     TEXT    NOT NULL DEFAULT (datetime('now'))
);
  `);

  saveDatabase();

  // Seed demo data only if no roles exist
  const roleCount = db.exec("SELECT COUNT(*) FROM roles")[0].values[0][0];
  if (roleCount === 0) {
    console.log("🌱 Seeding demo data...");

    // Roles
    db.run(`
      INSERT INTO roles (name, level, description) VALUES
      ('Intern', 1, 'Basic access'),
      ('Employee', 2, 'Standard access'),
      ('Manager', 3, 'Manager level'),
      ('Executive', 4, 'Executive clearance'),
      ('HR Admin', 3, 'HR access'),
      ('Admin', 5, 'Full system access');
    `);

    // Resources + Permissions (simplified)
    db.run(`
      INSERT INTO resources (name, display_name, min_level) VALUES
      ('payroll', 'Payroll Summary', 3),
      ('hr_records', 'HR Records', 3),
      ('api_docs', 'API Architecture', 2),
      ('company_policy', 'Company Policies', 1);
    `);

    db.run(`
      INSERT INTO permissions (role_id, resource_id, can_access)
      SELECT r.id, res.id, CASE WHEN r.level >= res.min_level THEN 1 ELSE 0 END
      FROM roles r CROSS JOIN resources res;
    `);

    // Demo Users (password = password123 for all)
    const hash = bcrypt.hashSync("password123", 10);
    const users = [
      ["Alice Sharma", "alice@company.com", "Intern"],
      ["Bob Mehta", "bob@company.com", "Employee"],
      ["Carol Nair", "carol@company.com", "Manager"],
      ["David Rao", "david@company.com", "Executive"],
      ["Eva Krishnan", "eva@company.com", "HR Admin"],
    ];

    const roleMap = {};
    const roles = db.exec("SELECT id, name FROM roles")[0].values;
    roles.forEach(([id, name]) => { roleMap[name] = id; });

    const stmt = db.prepare("INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)");
    for (const [name, email, roleName] of users) {
      stmt.run([name, email, hash, roleMap[roleName]]);
    }
    stmt.free();

    saveDatabase();
    console.log("✅ Demo data seeded successfully!");
  }

  console.log("✅ Database ready:", DB_PATH);
  return db;
}

function getDatabase() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

function saveDatabase() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

module.exports = { initDatabase, getDatabase, saveDatabase };