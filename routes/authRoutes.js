// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { login, register, verifyToken } = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");

// POST /api/auth/login
// Body: { email, password }
// Returns: { token, user }
router.post("/login", login);

// POST /api/auth/register  (admin/demo only — protect this in production)
// Body: { name, email, password, role }
router.post("/register", register);

// GET /api/auth/me  (requires token)
// Returns: { valid: true, user: { id, name, email, role_name, role_level } }
router.get("/me", authenticate, verifyToken);

module.exports = router;
