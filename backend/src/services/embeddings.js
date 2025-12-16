// backend/src/services/embeddings.js
import fs from "fs";
import path from "path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn("OPENAI_API_KEY not set — embeddings endpoints will fail until key is provided.");
}

const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

// ----------------------
// CALL OPENAI EMBEDDINGS
// ----------------------
export async function embedText(text) {
  if (!OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const url = "https://api.openai.com/v1/embeddings";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_EMBED_MODEL,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${txt}`);
  }

  const json = await response.json();
  return json?.data?.[0]?.embedding || [];
}

// ----------------------
// COSINE SIMILARITY
// ----------------------
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;

  let dot = 0,
    na = 0,
    nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  if (na === 0 || nb === 0) return 0;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ----------------------
// JOB INDEX HANDLING
// ----------------------
const JOB_INDEX_PATH = path.join(process.cwd(), "data", "jobIndex.json");

export function readJobIndex() {
  try {
    if (!fs.existsSync(JOB_INDEX_PATH)) return [];
    const txt = fs.readFileSync(JOB_INDEX_PATH, "utf8");
    return JSON.parse(txt || "[]");
  } catch (e) {
    console.warn("readJobIndex failed:", e);
    return [];
  }
}

export function saveJobIndex(arr) {
  try {
    const dir = path.dirname(JOB_INDEX_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(JOB_INDEX_PATH, JSON.stringify(arr, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn("saveJobIndex failed:", e);
    return false;
  }
}
