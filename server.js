// server.js
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const { initDatabase } = require("./config/database");

const authRoutes  = require("./routes/authRoutes");
const queryRoutes = require("./routes/queryRoutes");
const auditRoutes = require("./routes/auditRoutes"); // ← NEW


const app  = express();
const PORT = process.env.PORT || 3000;

// Allow requests from the Vite dev server (port 5173) and any other origin
app.use(cors({
  origin: [
    "http://localhost:5173",   // Vite default
    "http://localhost:5174",   // Vite fallback
    "http://localhost:3001",   // alternate
    process.env.FRONTEND_URL,
    "*",
  ].filter(Boolean),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.path}`);
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "RBAC Governance Backend" });
});

app.use("/api/auth",  authRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/audit", auditRoutes); // ← NEW: GET /api/audit/logs

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

(async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║   RBAC Governance Backend — Running          ║
╠══════════════════════════════════════════════╣
║   http://localhost:${PORT}                       ║
║                                              ║
║   POST /api/auth/login                       ║
║   GET  /api/auth/me                          ║
║   POST /api/query          ← AI gateway      ║
║   GET  /api/query/access                     ║
║   GET  /api/audit/logs     ← NEW             ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
})();
