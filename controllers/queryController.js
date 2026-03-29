// controllers/queryController.js
const { getAIResponse } = require("../services/aiServices");
const { writeAuditLog } = require("../middleware/auditLogger");
const { getDatabase } = require("../config/database");

/**
 * Handle Query - AI Governed RBAC
 */
async function handleQuery(req, res) {
  const { query } = req.body;
  const user = req.user;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({
      error: "query field is required and must be a non-empty string.",
    });
  }

  const queryText = query.trim();

  try {
    // 🔥 MAIN AI CALL (single source of truth)
    const aiResponse = await getAIResponse({
      query: queryText,
      user,
    });

    const { permission, answer, sources } = aiResponse;

    // Normalize decision for database safely
    let dbDecision = "NOT_FOUND";
    if (permission === "allowed" || permission === "ALLOW") {
      dbDecision = "ALLOW";
    } else if (permission === "denied" || permission === "DENY") {
      dbDecision = "DENY";
    } else if (permission === "not_found" || permission === "NOT_FOUND") {
      dbDecision = "NOT_FOUND";
    }

    // Write audit log with safe decision
    writeAuditLog({
      user,
      queryText,
      decision: dbDecision,
      answer: answer || null,
      denyReason: permission === "denied" ? "Insufficient role level" : null,
      ipAddress: req.ip,
    });

    console.log(`✅ Audit log written: ${dbDecision} | Query: "${queryText.substring(0, 60)}..."`);

    // 🚫 DENIED
    if (permission === "denied") {
      return res.status(403).json({
        decision: "DENY",
        message: answer,
        user_role: user.role_name,
        user_level: user.role_level,
      });
    }

    // 🤷 NOT FOUND
    if (permission === "not_found") {
      return res.json({
        decision: "NOT_FOUND",
        answer: answer || "Sorry, I couldn't find any relevant information for your query.",
      });
    }

    // ✅ ALLOWED
    return res.json({
      decision: "ALLOW",
      answer,
      sources: sources?.map((doc) => ({
        text: doc.text,
        role: doc.role,
        level: doc.level,
      })),
    });

  } catch (err) {
    console.error("❌ Query handling failed:", err.message);

    // Log error case safely
    writeAuditLog({
      user,
      queryText,
      decision: "NOT_FOUND",
      answer: "Internal server error",
      sources: [],
      denyReason: "System error",
      ipAddress: req.ip,
    });

    return res.status(500).json({
      error: "Something went wrong while processing your request.",
    });
  }
}

/**
 * Get current user's permission profile (unchanged)
 */
function getMyAccess(req, res) {
  const db = getDatabase();
  const user = req.user;

  const stmt = db.prepare(`
    SELECT r.name, r.display_name, r.min_level, r.description, p.can_access
    FROM permissions p
    JOIN resources r ON p.resource_id = r.id
    WHERE p.role_id = ?
    ORDER BY r.min_level, r.name
  `);

  stmt.bind([user.role_id]);

  const permissions = [];
  while (stmt.step()) {
    permissions.push(stmt.getAsObject());
  }

  stmt.free();

  res.json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role_name,
      level: user.role_level,
    },
    permissions: permissions.map((p) => ({
      resource: p.name,
      display_name: p.display_name,
      access: Number(p.can_access) === 1 ? "ALLOWED" : "DENIED",
    })),
  });
}

module.exports = { handleQuery, getMyAccess };