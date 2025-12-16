// backend/src/routes/search.js
import express from "express";
import { generateEmbedding } from "../lib/embeddings.js";
import STORE from "../lib/vectorStore.js";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js";
import Job from "../models/Job.js"; // optional - if you have a Job model
import News from "../models/News.js"; // optional - adjust to your models

const router = express.Router();

/**
 * POST /api/ai/index
 * body: { id, type, text, meta }
 * authRequired for indexing (recommended)
 */
router.post("/ai/index", authRequired, async (req, res) => {
  try {
    const { id, type, text, meta = {} } = req.body || {};
    if (!id || !type || !text) return res.status(400).json({ message: "id, type and text are required" });

    const vector = await generateEmbedding(text);
    STORE.index({ id, type, vector, meta });
    STORE.saveToDisk();

    return res.status(201).json({ ok: true, message: "Indexed", id, type });
  } catch (err) {
    console.error("POST /api/ai/index error", err);
    return res.status(500).json({ message: err?.message || "Index error" });
  }
});

/**
 * POST /api/ai/index-bulk
 * body: [{ id, type, text, meta }]
 */
router.post("/ai/index-bulk", authRequired, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    if (!items.length) return res.status(400).json({ message: "Array body required" });

    const toIndex = [];
    for (const it of items) {
      if (!it || !it.id || !it.type || !it.text) continue;
      const vector = await generateEmbedding(it.text);
      toIndex.push({ id: it.id, type: it.type, vector, meta: it.meta || {} });
    }
    STORE.bulkIndex(toIndex);
    STORE.saveToDisk();
    return res.json({ ok: true, indexed: toIndex.length });
  } catch (err) {
    console.error("POST /api/ai/index-bulk error", err);
    return res.status(500).json({ message: err?.message || "Bulk index error" });
  }
});

/**
 * GET /api/search/semantic?q=...&type=users|news|jobs&limit=10
 * public endpoint (optionally require auth)
 */
router.get("/search/semantic", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(400).json({ message: "q query required" });
    const type = req.query.type || null;
    const limit = Math.min(100, Number(req.query.limit || 10));

    const qvec = await generateEmbedding(q);
    const results = STORE.searchByVector(qvec, { topK: limit, filterType: type || null });

    // Enrich results with DB objects for display if possible
    const enriched = [];
    for (const r of results) {
      const { type: t, id } = r;
      let doc = null;
      if (t === "user") {
        try { doc = await User.findById(id).lean(); } catch (e) {}
      } else if (t === "job") {
        try { doc = await Job.findById(id).lean(); } catch (e) {}
      } else if (t === "news") {
        try { doc = await News.findById(id).lean(); } catch (e) {}
      }
      enriched.push({ id, type: t, score: r.score, meta: r.meta || {}, doc });
    }

    return res.json({ results: enriched });
  } catch (err) {
    console.error("GET /api/search/semantic error", err);
    return res.status(500).json({ message: err?.message || "Search error" });
  }
});

/**
 * GET /api/recommendations/jobs
 * uses current user profile to recommend jobs
 */
router.get("/recommendations/jobs", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Build a simple profile text to embed — customize as you like
    const profileText = [
      user.name || "",
      user.title || "",
      user.company || "",
      (user.skills || []).join(", "),
      user.bio || "",
      (user.location || ""),
      (user.department || ""),
    ].filter(Boolean).join(" • ");

    const qvec = await generateEmbedding(profileText);

    // search in store for jobs
    const hits = STORE.searchByVector(qvec, { topK: 12, filterType: "job" });

    // simple enrichment
    const results = [];
    for (const h of hits) {
      let jobDoc = null;
      try { jobDoc = await Job.findById(h.id).lean(); } catch (e) {}
      results.push({ id: h.id, score: h.score, doc: jobDoc || null, meta: h.meta || {} });
    }

    return res.json({ jobs: results });
  } catch (err) {
    console.error("GET /api/recommendations/jobs error", err);
    return res.status(500).json({ message: err?.message || "Recommend error" });
  }
});

export default router;
