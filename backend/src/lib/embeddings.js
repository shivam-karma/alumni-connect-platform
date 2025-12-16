// backend/src/lib/embeddings.js
import fs from "fs";
import path from "path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_DEP || "";

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set — embeddings endpoints will fail until key is provided.");
}

async function generateEmbedding(text, model = "text-embedding-3-small") {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured on server");

  // Node 18+ has fetch. Fallback not required here.
  const url = "https://api.openai.com/v1/embeddings";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const e = new Error(`OpenAI embeddings error: ${resp.status} ${txt}`);
    e.status = resp.status;
    throw e;
  }

  const body = await resp.json();
  if (!body?.data?.[0]?.embedding) throw new Error("No embedding returned");
  return body.data[0].embedding;
}

// small util: cosine similarity
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s) || 1;
}
function cosineSim(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

export { generateEmbedding, cosineSim };
export default { generateEmbedding, cosineSim };
