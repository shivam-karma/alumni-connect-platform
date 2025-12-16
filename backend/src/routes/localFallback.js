// backend/src/routes/localFallback.js
import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

// load FAQ once
const FAQ_PATH = path.join(process.cwd(), "backend", "data", "job_chat_faq.json");
let faq = [];
try {
  const raw = fs.readFileSync(FAQ_PATH, "utf8");
  faq = JSON.parse(raw);
} catch (e) {
  console.warn("Local FAQ not loaded:", e.message);
}

// simple scoring: match by keywords in user's message
function findBestAnswer(message) {
  if (!message || typeof message !== "string") return null;
  const msg = message.toLowerCase();
  // exact question match first
  const exact = faq.find(q => q.question.toLowerCase() === msg);
  if (exact) return exact.answer;

  // score by token matches on question text and id/keywords
  let best = null;
  let bestScore = 0;
  for (const item of faq) {
    const text = (item.question + " " + (item.answer || "")).toLowerCase();
    let score = 0;
    // count matching words
    for (const w of msg.split(/\W+/).filter(Boolean)) {
      if (text.includes(w)) score += 1;
    }
    // small boost for short question substring
    if (text.includes(msg)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  // threshold to avoid bad matches
  if (bestScore >= 1) return best.answer;
  return null;
}

router.post("/local-fallback", express.json(), (req, res) => {
  const { message, resumeUrl } = req.body || {};
  // if resumeUrl present, you can include a custom message
  const resumeNote = resumeUrl ? ` (found resume at ${resumeUrl})` : "";
  const answer = findBestAnswer(message);
  if (answer) {
    return res.json({ ok: true, data: { reply: `${answer}${resumeNote}` } });
  } else {
    // generic fallback suggestions
    return res.json({
      ok: true,
      data: {
        reply:
          `Sorry, I couldn't find a canned answer. Try asking: "How do I upload my resume?", "Recommend jobs", or "Generate cover letter".${resumeNote}`
      }
    });
  }
});

export default router;
