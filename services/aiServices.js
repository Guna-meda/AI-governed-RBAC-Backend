// aiService.js
require("dotenv").config();

const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.AI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX);

const roleLevelMap = {
  Public: 1,
  Employee: 2,
  HR: 3,
  Executive: 4,
};

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

async function queryDocuments(query, userRole = "Public", userLevel = 1, topK = 10) {
  console.log(`🔍 Query: "${query}" | Role: ${userRole} (Level ${userLevel})`);

  const ns = index.namespace("");

  try {
    const queryEmbedding = await getEmbedding(query);

    const result = await ns.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });

    const matches = result.matches || [];

    if (matches.length === 0) {
      return { results: [] };
    }


    const docs = matches.map(match => ({
      id: match.id,
      score: parseFloat(match.score.toFixed(4)),
      text: match.metadata?.text || "",
      role: match.metadata?.role || "Public",
      level: match.metadata?.level || 1,
    }));

    return { results: docs };

  } catch (error) {
    console.error("❌ Error:", error.message);
    return { results: [] };
  }
}

/**
 * Main ask() function
 */
async function ask({ query, user }) {
  const userRole = user?.role_name || "Public";
  const userLevel = user?.role_level || roleLevelMap[userRole] || 1;

  return await queryDocuments(query, userRole, userLevel);
}


async function getAIResponse({ query, user }) {
  const userRole = user?.role_name || "Public";
  const userLevel = user?.role_level || roleLevelMap[userRole] || 1;

  const { results } = await queryDocuments(query, userRole, userLevel);

  // 🚫 No docs at all
  if (!results || results.length === 0) {
    return {
      permission: "not_found",
      answer: "Sorry, I couldn't find any relevant information for your query.",
      sources: []
    };
  }

  const context = results.map((d, i) => `
Document ${i + 1}:
Text: ${d.text}
Role Required: ${d.role}
Level Required: ${d.level}
`).join("\n");

  const prompt = `
You are an AI system with strict access control.

User:
Role = ${userRole}
Level = ${userLevel}

Your job:
1. Find if ANY document contains information relevant to the question.
2. If NO relevant info → return EXACTLY:
{
  "permission": "not_found",
  "answer": "No relevant information found."
}

3. If relevant info EXISTS:
   - Check if user's level >= document level

   IF YES:
   return:
   {
     "permission": "allowed",
     "answer": "<actual answer>"
   }

   IF NO:
   return:
   {
     "permission": "denied",
     "answer": "You do not have permission to access this information."
   }

IMPORTANT:
- ONLY use document content
- DO NOT hallucinate
- RETURN STRICT JSON ONLY

Documents:
${context}

Question: ${query}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  let aiResponse;

  try {
    aiResponse = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    // fallback safety
    return {
      permission: "not_found",
      answer: "Sorry, I couldn't process the response.",
      sources: []
    };
  }

  // 🔥 Final mapping
  if (aiResponse.permission === "not_found") {
    return {
      permission: "not_found",
      answer: "Sorry, I couldn't find any relevant information for your query.",
      sources: []
    };
  }

  if (aiResponse.permission === "denied") {
    return {
      permission: "denied",
      answer: aiResponse.answer,
      sources: []
    };
  }

  // ✅ allowed
  return {
    permission: "allowed",
    answer: aiResponse.answer,
    sources: results
  };
}
module.exports = {
  ask,
  getAIResponse
};