// backend/src/routes/mentorship.js
import { Router } from "express";
import MentorProfile from "../models/MentorProfile.js";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import User from "../models/User.js";
import { authRequired } from "../middleware/auth.js";
import mongoose from "mongoose";

const router = Router();

/**
 * GET /api/mentorship/mentors
 * Query: q, expertise, location (optional), page, limit
 * Returns public mentor profiles populated with user info.
 */
router.get("/mentors", async (req, res) => {
  try {
    const { q, expertise, page = 1, limit = 20 } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;
    const filter = {};
    if (expertise) filter.expertise = expertise;
    if (q) {
      const re = new RegExp(q, "i");
      filter.$or = [{ bio: re }, { expertise: re }];
    }

    const items = await MentorProfile.find(filter).skip(skip).limit(Number(limit)).lean();
    // attach basic user info
    const userIds = items.map(it => it.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("name email title company location").lean();
    const usersMap = {};
    users.forEach(u => usersMap[u._id.toString()] = u);

    const result = items.map(it => ({ ...it, user: usersMap[it.userId.toString()] || null }));

    res.json({ mentors: result });
  } catch (err) {
    console.error("GET /api/mentorship/mentors", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/mentorship/apply
 * Body: profile fields
 * Auth required: create/update MentorProfile
 */
router.post("/apply", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const payload = req.body || {};
    payload.updatedAt = new Date();
    let profile = await MentorProfile.findOne({ userId });
    if (profile) {
      Object.assign(profile, payload);
      await profile.save();
    } else {
      profile = await MentorProfile.create({ userId, ...payload });
    }
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("POST /api/mentorship/apply", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/mentorship/profile/me
 */
router.get("/profile/me", authRequired, async (req, res) => {
  try {
    const profile = await MentorProfile.findOne({ userId: req.userId }).lean();
    res.json({ profile });
  } catch (err) {
    console.error("GET /api/mentorship/profile/me", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/mentorship/request
 * Body: { toId, title, message } (from = auth user)
 */
router.post("/request", authRequired, async (req, res) => {
  try {
    const from = req.userId;
    const { toId, title = "", message = "" } = req.body;
    if (!toId) return res.status(400).json({ message: "toId required" });
    if (!mongoose.Types.ObjectId.isValid(toId)) return res.status(400).json({ message: "Invalid toId" });
    if (toId === from) return res.status(400).json({ message: "Cannot request yourself" });

    const mentorUser = await User.findById(toId);
    if (!mentorUser) return res.status(404).json({ message: "Mentor not found" });

    const existing = await MentorshipRequest.findOne({ from, to: toId, status: "pending" });
    if (existing) return res.status(409).json({ message: "Request already pending" });

    const reqDoc = await MentorshipRequest.create({ from, to: toId, title, message });
    return res.status(201).json({ ok: true, request: reqDoc });
  } catch (err) {
    console.error("POST /api/mentorship/request", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/mentorship/requests?box=incoming|outgoing
 */
router.get("/requests", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const box = req.query.box || "incoming";
    let filter;
    if (box === "outgoing") filter = { from: userId };
    else if (box === "all") filter = { $or: [{ from: userId }, { to: userId }] };
    else filter = { to: userId }; // incoming

    const docs = await MentorshipRequest.find(filter).sort({ createdAt: -1 })
      .populate("from", "name title email")
      .populate("to", "name title email")
      .lean();

    res.json({ requests: docs });
  } catch (err) {
    console.error("GET /api/mentorship/requests", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/mentorship/:id/accept  (mentor accepts)
 */
router.post("/:id/accept", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await MentorshipRequest.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.to.toString() !== userId) return res.status(403).json({ message: "Not allowed" });
    if (doc.status !== "pending") return res.status(400).json({ message: "Request is not pending" });
    doc.status = "accepted";
    await doc.save();
    return res.json({ ok: true, request: doc });
  } catch (err) {
    console.error("POST accept mentorship", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/mentorship/:id/reject  (mentor rejects)
 */
router.post("/:id/reject", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await MentorshipRequest.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.to.toString() !== userId) return res.status(403).json({ message: "Not allowed" });
    if (doc.status !== "pending") return res.status(400).json({ message: "Request is not pending" });
    doc.status = "rejected";
    await doc.save();
    return res.json({ ok: true, request: doc });
  } catch (err) {
    console.error("POST reject mentorship", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/mentorship/:id/cancel  (requester cancels)
 */
router.post("/:id/cancel", authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await MentorshipRequest.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.from.toString() !== userId) return res.status(403).json({ message: "Not allowed" });
    if (doc.status !== "pending") return res.status(400).json({ message: "Request is not pending" });
    doc.status = "cancelled";
    await doc.save();
    return res.json({ ok: true, request: doc });
  } catch (err) {
    console.error("POST cancel mentorship", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
