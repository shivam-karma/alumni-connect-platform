// backend/src/routes/news.js
import { Router } from "express";
import News from "../models/News.js";
import { authRequired } from "../middleware/auth.js";
import mongoose from "mongoose";
import { awardPoints } from "../services/pointsService.js"; // optional helper
import User from "../models/User.js";

const router = Router();

/**
 * GET /api/news
 * Query: q, category, tag, featured, page, limit
 */
router.get("/", async (req, res) => {
  try {
    const { q, category, tag, featured, page = 1, limit = 12 } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;
    const filter = {};

    if (q) filter.$or = [
      { title: new RegExp(q, "i") },
      { summary: new RegExp(q, "i") },
      { body: new RegExp(q, "i") }
    ];
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (featured) filter.featured = true;

    const [items, total] = await Promise.all([
      News.find(filter).sort({ featured: -1, createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      News.countDocuments(filter)
    ]);

    res.json({ news: items, total });
  } catch (err) {
    console.error("GET /api/news error", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/news
 * Protected: create news (author = req.userId)
 * Body: { title, summary, body, category, tags, imageUrl, featured }
 */
router.post("/", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    // store author metadata for convenience
    payload.author = {
      id: req.userId,
      // if you set these in auth middleware, attach them; otherwise skip
      name: req.userName || undefined,
      email: req.userEmail || undefined
    };

    const news = await News.create(payload);

    // --- Gamification: award points & badge (best-effort) ---
    (async () => {
      try {
        if (typeof awardPoints === "function") {
          await awardPoints(req.userId, "news_post", 15, {
            meta: { newsId: news._id },
            updateStats: { field: "newsPosts", inc: 1 },
            badge: { key: "news_poster", name: "First News Post", description: "Posted your first news" }
          });
        } else {
          // fallback: direct user update
          const user = await User.findById(req.userId);
          if (user) {
            user.points = (user.points || 0) + 15;
            user.stats = user.stats || {};
            user.stats.newsPosts = (user.stats.newsPosts || 0) + 1;
            if (!user.badges?.some(b => b.key === "news_poster")) {
              user.badges = user.badges || [];
              user.badges.push({
                key: "news_poster",
                name: "First News Post",
                description: "Posted your first news",
                awardedAt: new Date()
              });
            }
            await user.save();
          }
        }
      } catch (gerr) {
        console.warn("Gamification (news) failed:", gerr);
        // do not throw — keep the main request successful
      }
    })();

    return res.status(201).json({ news });
  } catch (err) {
    console.error("POST /api/news", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/news/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const n = await News.findById(id).lean();
    if (!n) return res.status(404).json({ message: "News not found" });
    res.json({ news: n });
  } catch (err) {
    console.error("GET /api/news/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/news/:id
 * Protected; author (or admin) can edit
 */
router.put("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });

    const n = await News.findById(id);
    if (!n) return res.status(404).json({ message: "News not found" });

    // allow only author or admin — adjust as needed (admin check not implemented)
    if (n.author?.id?.toString() !== req.userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    Object.assign(n, req.body, { updatedAt: new Date() });
    await n.save();
    res.json({ news: n });
  } catch (err) {
    console.error("PUT /api/news/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/news/:id
 */
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });

    const n = await News.findById(id);
    if (!n) return res.status(404).json({ message: "News not found" });

    if (n.author?.id?.toString() !== req.userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await n.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/news/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
