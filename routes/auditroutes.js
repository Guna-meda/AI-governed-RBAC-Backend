// routes/auditRoutes.js
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const { getDatabase } = require("../config/database");

router.use(authenticate);

router.get("/logs", (req, res) => {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT 
        a.id,
        a.timestamp,
        a.user_email,
        COALESCE(u.name, 'Unknown') AS name,
        a.role_name,
        a.role_level,
        a.query_text AS query,
        a.resource_tags AS category,
        a.decision,
        a.deny_reason AS action,
        a.answer,
        a.sources,
        a.ip_address
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
    `);

    const logs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        row.sources = row.sources ? JSON.parse(row.sources) : [];
      } catch (e) {
        row.sources = [];
      }
      logs.push(row);
    }
    stmt.free();

    res.json({ 
      logs, 
      total: logs.length,
      source: "backend" 
    });
  } catch (err) {
    console.error("❌ Audit logs error:", err.message);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

module.exports = router;