// backend/src/routes/events.js
import { Router } from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import EventModel from "../models/Event.js";
import UserModel from "../models/User.js";

const router = Router();

// Ensure Event model exists
const Event = EventModel || (() => {
  try { return mongoose.model("Event"); } catch (e) { return null; }
})();

// GET /api/events  (list)
router.get("/", async (req, res) => {
  try {
    const { q, tag, type, featured, page = 1, limit = 12, location } = req.query;
    const skip = (Math.max(1, page) - 1) * Number(limit);
    const filter = {};

    if (q) filter.$text = { $search: q };
    if (tag) filter.tags = tag;
    if (type) filter.eventType = type;
    if (featured) filter.featured = true;

    if (location) {
      const locRegex = new RegExp(location, "i");
      filter.$or = [
        { "location.venue": locRegex },
        { "location.address": locRegex },
        { "location.url": locRegex },
      ].concat(filter.$or || []);
    }

    const [items, total] = await Promise.all([
      Event.find(filter)
        .sort({ featured: -1, startDate: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "name email title company")
        .lean(),
      Event.countDocuments(filter)
    ]);

    res.json({ events: items, total });
  } catch (err) {
    console.error("GET /api/events error", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events  (create)
router.post("/", authRequired, async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    payload.createdBy = req.userId;

    // normalize tags
    if (typeof payload.tags === "string") payload.tags = payload.tags.split(",").map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(payload.tags)) payload.tags = payload.tags || [];

    if (payload.capacity) payload.capacity = Number(payload.capacity) || 0;

    const ev = await Event.create(payload);

    // award points/badge (best-effort)
    try {
      const user = await UserModel.findById(req.userId);
      if (user) {
        user.points = (user.points || 0) + 25;
        user.stats = user.stats || {};
        user.stats.eventsCreated = (user.stats.eventsCreated || 0) + 1;
        if (!user.badges?.some(b => b.key === "event_creator")) {
          user.badges = user.badges || [];
          user.badges.push({ key: "event_creator", name: "Event Creator", awardedAt: new Date() });
        }
        await user.save();
      }
    } catch (gerr) {
      console.warn("Gamification failed:", gerr?.message || gerr);
    }

    const populated = await Event.findById(ev._id).populate("createdBy", "name email title company").lean();
    res.status(201).json({ event: populated || ev });
  } catch (err) {
    console.error("POST /api/events", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/events/:id  (single)
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const ev = await Event.findById(id).populate("createdBy", "name email title company").lean();
    if (!ev) return res.status(404).json({ message: "Event not found" });
    res.json({ event: ev });
  } catch (err) {
    console.error("GET /api/events/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/events/:id  (update; creator or admin)
router.put("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const ev = await Event.findById(id);
    if (!ev) return res.status(404).json({ message: "Event not found" });

    const user = await UserModel.findById(req.userId).lean();
    const isAdmin = user?.role === "admin";
    if (String(ev.createdBy) !== String(req.userId) && !isAdmin) return res.status(403).json({ message: "Not allowed" });

    // sanitize tags
    if (req.body.tags) {
      if (Array.isArray(req.body.tags)) req.body.tags = req.body.tags.map(s => String(s).trim()).filter(Boolean);
      else if (typeof req.body.tags === "string") req.body.tags = req.body.tags.split(",").map(s => s.trim()).filter(Boolean);
      else req.body.tags = [];
    }

    Object.assign(ev, req.body, { updatedAt: new Date() });
    await ev.save();
    const populated = await Event.findById(ev._id).populate("createdBy", "name email title company").lean();
    res.json({ event: populated });
  } catch (err) {
    console.error("PUT /api/events/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/events/:id  (delete; creator or admin)
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const ev = await Event.findById(id);
    if (!ev) return res.status(404).json({ message: "Event not found" });

    const user = await UserModel.findById(req.userId).lean();
    const isAdmin = user?.role === "admin";
    if (String(ev.createdBy) !== String(req.userId) && !isAdmin) return res.status(403).json({ message: "Not allowed" });

    await ev.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/events/:id", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events/:id/rsvp  (RSVP)
router.post("/:id/rsvp", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const rawStatus = req.body?.status ?? "";
    const status = String(rawStatus).toLowerCase();
    const allowed = ["going", "interested", "cancel", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const ev = await Event.findById(id);
    if (!ev) return res.status(404).json({ message: "Event not found" });

    const userId = req.userId;
    ev.rsvps = (ev.rsvps || []).filter(r => String(r.userId) !== String(userId));

    if (status !== "cancel" && status !== "cancelled") {
      ev.rsvps.push({ userId, status, createdAt: new Date() });
    }

    await ev.save();
    const populated = await Event.findById(ev._id).populate("createdBy", "name email title company").lean();
    res.json({ event: populated });
  } catch (err) {
    console.error("POST /api/events/:id/rsvp", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/events/:id/follow  (toggle follow)
router.post("/:id/follow", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const action = (req.body?.action || "toggle").toString();
    const ev = await Event.findById(id);
    if (!ev) return res.status(404).json({ message: "Event not found" });

    const userId = String(req.userId);
    const current = (ev.followers || []).map(f => String(f));
    const isFollowing = current.includes(userId);

    if (action === "follow") {
      if (!isFollowing) ev.followers.push(userId);
    } else if (action === "unfollow") {
      ev.followers = (ev.followers || []).filter(f => String(f) !== userId);
    } else { // toggle
      if (isFollowing) ev.followers = (ev.followers || []).filter(f => String(f) !== userId);
      else ev.followers.push(userId);
    }

    await ev.save();
    const populated = await Event.findById(ev._id).populate("createdBy", "name email title company").lean();
    res.json({ event: populated });
  } catch (err) {
    console.error("POST /api/events/:id/follow", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
