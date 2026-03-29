const express = require("express");
const router = express.Router();

const { handleQuery, getMyAccess } = require("../controllers/queryController");
const authenticate = require("../middleware/authenticate");

/**
 * 🔐 All routes here require authentication
 */
router.use(authenticate);

/**
 * 🧠 Main AI Query Route
 * POST /api/query
 */
router.post("/", handleQuery);

/**
 * 👤 Get current user's access/permissions
 * GET /api/query/access
 */
router.get("/access", getMyAccess);

module.exports = router;