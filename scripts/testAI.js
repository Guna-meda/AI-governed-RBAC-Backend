// test.js
const { getAIResponse } = require("../services/aiServices");

async function runTests() {
  console.log("🚀 RBAC AI Governance Test - Using getAIResponse\n");

  const testCases = [
    {
      name: "1. Employee asking for company revenue (Should be DENIED)",
      query: "What is company revenue?",
      user: { role_name: "Employee", role_level: 2 },
    },
    {
      name: "2. Employee asking for project deadline (Should be ALLOWED)",
      query: "What is the deadline for Project Phoenix?",
      user: { role_name: "Employee", role_level: 2 },
    },
    {
      name: "3. Public user asking about townhall",
      query: "When is the company townhall meeting?",
      user: { role_name: "Public", role_level: 1 },
    },
    {
      name: "4. HR asking for John Doe's salary",
      query: "What is John Doe's salary?",
      user: { role_name: "HR", role_level: 3 },
    },
    {
      name: "5. Executive asking for company revenue",
      query: "What is the company revenue for Q2?",
      user: { role_name: "Executive", role_level: 4 },
    },
    {
      name: "6. Unrelated query",
      query: "How to bake a chocolate cake?",
      user: { role_name: "Employee", role_level: 2 },
    },
  ];

  for (const test of testCases) {
    console.log(`\n📋 ${test.name}`);
    console.log(`Query : "${test.query}"`);
    console.log(`Role  : ${test.user.role_name} (Level ${test.user.role_level})`);

    const response = await getAIResponse({ 
      query: test.query, 
      user: test.user 
    });

    console.log(`Permission : ${response.permission}`);
    console.log(`Answer     : ${response.answer}`);

    if (response.sources && response.sources.length > 0) {
      console.log(`Sources    : ${response.sources.length} document(s)`);
      response.sources.forEach((doc, i) => {
        console.log(`   ${i + 1}. [${doc.role} | L${doc.level}] ${doc.text}`);
      });
    } else {
      console.log(`Sources    : None`);
    }

    console.log("-".repeat(90));
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err.message);
});