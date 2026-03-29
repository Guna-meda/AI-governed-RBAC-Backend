// seed/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Populates the database with realistic mock data for testing.
// Run with: node seed/seed.js
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const bcrypt = require("bcryptjs");
const {
  initDatabase,
  getDatabase,
  saveDatabase,
} = require("../config/database");

const SALT_ROUNDS = 10;

function runStatement(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function getLastInsertId(db) {
  const result = db.exec("SELECT last_insert_rowid() AS id;");
  return result[0].values[0][0];
}

async function seed() {
  await initDatabase();
  const db = getDatabase();

  console.log("Seeding database...\n");

  db.run("BEGIN TRANSACTION;");

  try {
    // ── 1. Clear existing data ───────────────────────────────────────────────
    db.run(`
      DELETE FROM audit_logs;
      DELETE FROM permissions;
      DELETE FROM users;
      DELETE FROM resources;
      DELETE FROM roles;
    `);

    // Reset auto-increment counters
    db.run(`
      DELETE FROM sqlite_sequence WHERE name IN (
        'roles',
        'users',
        'resources',
        'permissions',
        'audit_logs'
      );
    `);

    // ── 2. Roles ─────────────────────────────────────────────────────────────
    const roles = [
      ["intern", 1, "Entry-level, read-only access to public documents only"],
      ["employee", 2, "Standard staff, access to internal project and HR documents"],
      ["manager", 3, "Team lead, access to reports, performance, and sensitive ops data"],
      ["executive", 4, "C-suite and directors, full access including financials and strategy"],
      ["hr_admin", 3, "HR department, access to all employee records and compensation data"],
    ];

    const roleMap = {};
    for (const [name, level, description] of roles) {
      runStatement(
        db,
        `INSERT INTO roles (name, level, description) VALUES (?, ?, ?)`,
        [name, level, description]
      );
      roleMap[name] = getLastInsertId(db);
      console.log(`  ✓ Role: ${name} (level ${level})`);
    }

    // ── 3. Resources ─────────────────────────────────────────────────────────
    const resources = [
      ["public_announcements", "Public Announcements", 1, "Company-wide news and general announcements"],
      ["onboarding_docs", "Onboarding & Training Documents", 1, "New hire guides, company policies, code of conduct"],
      ["project_reports", "Project & Team Reports", 2, "Sprint summaries, project status reports"],
      ["internal_hr_policies", "Internal HR Policies", 2, "Leave policy, expense claims, internal procedures"],
      ["performance_reviews", "Performance Review Data", 3, "Individual and team performance evaluations"],
      ["salary_data", "Salary & Compensation Data", 3, "Pay grades, compensation bands, bonus structures"],
      ["financial_reports", "Financial Reports", 4, "P&L, balance sheets, quarterly financials"],
      ["executive_strategy", "Executive Strategy Documents", 4, "Board minutes, M&A plans, strategic roadmaps"],
      ["employee_records", "Full Employee Records", 3, "HR admin only — complete employee files"],
    ];

    const resourceMap = {};
    for (const [name, display_name, min_level, description] of resources) {
      runStatement(
        db,
        `INSERT INTO resources (name, display_name, min_level, description) VALUES (?, ?, ?, ?)`,
        [name, display_name, min_level, description]
      );
      resourceMap[name] = getLastInsertId(db);
      console.log(`  ✓ Resource: ${name} (min level ${min_level})`);
    }

    // ── 4. Permissions ───────────────────────────────────────────────────────
    const permMatrix = [
      ["intern", "public_announcements", 1],
      ["intern", "onboarding_docs", 1],

      ["employee", "public_announcements", 1],
      ["employee", "onboarding_docs", 1],
      ["employee", "project_reports", 1],
      ["employee", "internal_hr_policies", 1],

      ["manager", "public_announcements", 1],
      ["manager", "onboarding_docs", 1],
      ["manager", "project_reports", 1],
      ["manager", "internal_hr_policies", 1],
      ["manager", "performance_reviews", 1],
      ["manager", "salary_data", 1],

      ["executive", "public_announcements", 1],
      ["executive", "onboarding_docs", 1],
      ["executive", "project_reports", 1],
      ["executive", "internal_hr_policies", 1],
      ["executive", "performance_reviews", 1],
      ["executive", "salary_data", 1],
      ["executive", "financial_reports", 1],
      ["executive", "executive_strategy", 1],
      ["executive", "employee_records", 1],

      ["hr_admin", "public_announcements", 1],
      ["hr_admin", "onboarding_docs", 1],
      ["hr_admin", "internal_hr_policies", 1],
      ["hr_admin", "performance_reviews", 1],
      ["hr_admin", "salary_data", 1],
      ["hr_admin", "employee_records", 1],
      ["hr_admin", "financial_reports", 0],
      ["hr_admin", "executive_strategy", 0],
    ];

    for (const [role, resource, can_access] of permMatrix) {
      runStatement(
        db,
        `INSERT OR REPLACE INTO permissions (role_id, resource_id, can_access)
         VALUES (?, ?, ?)`,
        [roleMap[role], resourceMap[resource], can_access]
      );
    }
    console.log(`\n  ✓ Permissions matrix created (${permMatrix.length} entries)`);

    // ── 5. Users ─────────────────────────────────────────────────────────────
    console.log("\n  Hashing passwords (this takes a moment)...");

    const users = [
      { name: "Alice Sharma", email: "alice@company.com", password: "password123", role: "intern" },
      { name: "Bob Mehta", email: "bob@company.com", password: "password123", role: "employee" },
      { name: "Carol Nair", email: "carol@company.com", password: "password123", role: "manager" },
      { name: "David Rao", email: "david@company.com", password: "password123", role: "executive" },
      { name: "Eva Krishnan", email: "eva@company.com", password: "password123", role: "hr_admin" },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
      runStatement(
        db,
        `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
        [u.name, u.email, hash, roleMap[u.role]]
      );
      console.log(`  ✓ User: ${u.name} (${u.role}) — ${u.email} / ${u.password}`);
    }

    db.run("COMMIT;");
    saveDatabase();

    console.log("\nSeeding complete!\n");
    console.log("─────────────────────────────────────");
    console.log("Test credentials (all passwords: password123):");
    users.forEach((u) => console.log(`  ${u.role.padEnd(10)} → ${u.email}`));
    console.log("─────────────────────────────────────\n");
  } catch (error) {
    db.run("ROLLBACK;");
    throw error;
  }
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
});