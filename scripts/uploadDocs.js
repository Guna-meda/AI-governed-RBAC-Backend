require("dotenv").config();

const { Pinecone } = require("@pinecone-database/pinecone");
const OpenAI = require("openai");
const docs = require("../data/docs");

// 🔹 Init clients
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pc.index(process.env.PINECONE_INDEX);

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
});

// 🔹 Convert text → embedding
async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

async function uploadDocs() {
  console.log("🚀 Uploading documents...");

  const vectors = [];

  for (const doc of docs) {
    const embedding = await getEmbedding(doc.text);

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        text: doc.text,
        role: doc.role,
        level: doc.level,
      },
    });

    console.log(`✅ Embedded: ${doc.id}`);
  }

  console.log(`Vectors length: ${vectors.length}`);

  if (vectors.length === 0) {
    console.log("⚠️ No vectors to upload.");
    return;
  }

  // ✅ Correct upsert for Pinecone SDK v7
  const ns = index.namespace("");        // empty string = default namespace

  await ns.upsert({
    records: vectors
  });

  console.log(`🎉 All ${vectors.length} documents uploaded to Pinecone!`);
}

uploadDocs().catch(console.error);