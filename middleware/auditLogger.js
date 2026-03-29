// middleware/auditLogger.js
const { getDatabase, saveDatabase } = require("../config/database");

function writeAuditLog({
  user,
  queryText,
  decision,
  answer,
  sources,
  denyReason,
  ipAddress,
}) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO audit_logs
      (
        user_id,
        user_email,
        role_name,
        role_level,
        query_text,
        resource_tags,
        decision,
        deny_reason,
        answer,
        sources,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      user.id,
      user.email,
      user.role_name || user.role || "Unknown",
      user.role_level || user.level || 1,
      queryText,
      JSON.stringify([]),
      (decision || "NOT_FOUND").toUpperCase(),
      denyReason || null,
      answer || null,
      JSON.stringify(sources || []),
      ipAddress || null,
    ]);

    stmt.free();
    saveDatabase();

    console.log(`✅ Audit log saved: ${decision} - "${queryText.substring(0, 60)}..."`);
  } catch (err) {
    console.error("⚠️ Audit log write failed:", err.message);
  }
}

module.exports = { writeAuditLog };