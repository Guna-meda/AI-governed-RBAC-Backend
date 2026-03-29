<<<<<<< HEAD
# RBAC Governance Backend
### AI-Based Governance & Role-Based Access Intelligence Platform — Part 2

---

## What this is

This is the **security/governance layer** that sits in front of an AI chatbot.
Every query from the frontend passes through this backend, which:

1. Verifies the user's identity (JWT authentication)
2. Looks up their role and access level (NRL)
3. Decides whether they can ask that kind of question (policy engine)
4. Logs the decision to the database (audit trail)
5. Forwards allowed queries to the AI with a role-aware system prompt

---

## Project Structure

```
rbac-backend/
├── server.js                  ← Entry point, starts Express server
├── .env.example               ← Copy to .env and fill in your values
│
├── config/
│   └── database.js            ← SQLite setup, creates all 5 tables
│
├── seed/
│   └── seed.js                ← Fills DB with mock users, roles, resources
│
├── middleware/
│   ├── authenticate.js        ← Verifies JWT on every protected request
│   └── auditLogger.js         ← Writes every query decision to audit_logs
│
├── policies/
│   └── policyEngine.js        ← CORE: decides ALLOW or DENY for every query
│
├── controllers/
│   ├── authController.js      ← Login, register, token verify
│   └── queryController.js     ← Main /api/query handler, AI call
│
└── routes/
    ├── authRoutes.js
    └── queryRoutes.js
```

---

## Setup (step by step)

### 1. Install Node.js
Download from https://nodejs.org (version 18 or higher)

### 2. Clone / copy this folder, then install packages
```bash
cd rbac-backend
npm install
```

### 3. Create your .env file
```bash
cp .env.example .env
```
Open `.env` and set:
- `JWT_SECRET` — any long random string (e.g. `mySuperSecretKey2024`)
- `AI_API_KEY` — your OpenAI API key OR your teammate's AI endpoint key
- `AI_BASE_URL` — `https://api.openai.com/v1` (or your teammate's server URL)

### 4. Seed the database with test data
```bash
node seed/seed.js
```
This creates `governance.db` and fills it with 5 test users:
| Email                | Password    | Role      | Level |
|----------------------|-------------|-----------|-------|
| alice@company.com    | password123 | intern    | 1     |
| bob@company.com      | password123 | employee  | 2     |
| carol@company.com    | password123 | manager   | 3     |
| david@company.com    | password123 | executive | 4     |
| eva@company.com      | password123 | hr_admin  | 3     |

### 5. Start the server
```bash
node server.js
# or for auto-restart during development:
npm run dev
```

Server runs at http://localhost:3000

---

## API Reference

### POST /api/auth/login
```json
// Request
{ "email": "alice@company.com", "password": "password123" }

// Response
{
  "token": "eyJhbGci...",
  "user": { "name": "Alice Sharma", "role": "intern", "role_level": 1 }
}
```

### POST /api/query  ← your teammate calls this
```
Headers: Authorization: Bearer <token>
```
```json
// Request
{
  "query": "What is the salary band for engineers?",
  "conversation_history": []
}

// Response (ALLOWED)
{
  "decision": "ALLOW",
  "answer": "...(AI response)...",
  "resource_tags": ["salary_data"],
  "user_role": "manager"
}

// Response (DENIED)
{
  "decision": "DENY",
  "message": "Access denied.",
  "reason": "Access to 'Salary & Compensation Data' requires level 3. Your role (intern) is level 1.",
  "your_role": "intern",
  "your_level": 1
}
```

### GET /api/query/my-access
```
Headers: Authorization: Bearer <token>
```
Returns list of what the current user can and cannot access.

### GET /api/auth/me
Verifies token is still valid, returns user info.

---

## How to test quickly (using curl)

```bash
# 1. Login as intern
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@company.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Try a restricted query (should be DENIED)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"What is the salary for software engineers?"}'

# 3. Try an allowed query (should be ALLOWED)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"What is the company holiday policy?"}'
```

---

## How your teammate integrates this

Their frontend should:
1. Call `POST /api/auth/login` → store the token (localStorage or cookie)
2. For every AI chat message, call `POST /api/query` with the token in the header
3. If response `decision === "DENY"`, show the `message` to the user
4. If response `decision === "ALLOW"`, display the `answer`

---

## Database Tables (visible in governance.db)

Use any SQLite viewer (e.g. DB Browser for SQLite — free download) to inspect:
- `roles` — 5 roles with levels 1–4
- `users` — test users linked to roles
- `resources` — 9 document categories with minimum levels
- `permissions` — explicit allow/deny matrix
- `audit_logs` — every query ever made, decision, and reason
=======
# AI-Based-Governance-Role-Based-Access-Intelligence-Platform
>>>>>>> 17dfdd45cf3fe13857e79adc9c85293318e8fa8e
