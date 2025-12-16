import express from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// ✅ Lightweight search endpoint (returns small payload, paginated)
// GET /api/users/search?q=...&limit=20&page=1
router.get("/search", authRequired, async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "20", 10)));
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const skip = (page - 1) * limit;

    if (!q) return res.json({ users: [], total: 0, page, limit });

    // search name, email, company, skills (simple case-insensitive substring)
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const filter = {
      $or: [
        { name: re },
        { email: re },
        { company: re },
        { skills: re },
      ],
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email title company department batch isMentor")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(u => ({
        id: u._id?.toString?.() ?? u._id,
        name: u.name,
        email: u.email,
        title: u.title || "",
        company: u.company || "",
        department: u.department || "",
        batch: u.batch || "",
        isMentor: !!u.isMentor,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /api/users/search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET all users (with filters)
router.get("/", authRequired, async (req, res) => {
  try {
    const query = {};
    const { q, role, department, year, mentorsOnly } = req.query;

    if (q) {
      query.$or = [
        { name: new RegExp(q, "i") },
        { company: new RegExp(q, "i") },
        { skills: new RegExp(q, "i") },
      ];
    }
    if (role) query.role = role;
    if (department) query.department = department;
    if (year) query.batch = year;
    if (mentorsOnly) query.isMentor = true;

    const users = await User.find(query).lean();

    res.json({
      users: users.map(u => ({
        id: u._1d?.toString?.() ?? u._id?.toString?.() ?? u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        batch: u.batch,
        title: u.title,
        company: u.company,
        location: u.location,
        skills: u.skills || [],
        isMentor: u.isMentor || false,
        connections: Array.isArray(u.connectionsList)
          ? u.connectionsList.length
          : u.connections || 0,
        points: u.points || 0,
        badges: u.badges || [],
      })),
    });
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🏆 GET leaderboard (sorted by points)
// NOTE: placed before the `/:id` route so "leaderboard" won't be treated as an id
router.get("/leaderboard", async (req, res) => {
  try {
    const top = await User.find({})
      .sort({ points: -1 })
      .limit(20)
      .lean();

    res.json({
      users: top.map(u => ({
        id: u._id?.toString?.() ?? u._id,
        name: u.name,
        points: u.points || 0,
        badges: u.badges || [],
        title: u.title || "",
        company: u.company || "",
      })),
    });
  } catch (err) {
    console.error("GET /api/users/leaderboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET single user by ID (validate id first)
router.get("/:id", authRequired, async (req, res) => {
  try {
    const id = (req.params.id || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id)
      .populate("connectionsList", "name email title company")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        batch: user.batch,
        title: user.title,
        company: user.company,
        location: user.location,
        skills: user.skills || [],
        isMentor: user.isMentor || false,
        bio: user.bio || "",
        phone: user.phone || "",
        experience: user.experience || [],
        achievements: user.achievements || [],
        connections:
          Array.isArray(user.connectionsList) && user.connectionsList.length > 0
            ? user.connectionsList.length
            : user.connections || 0,
        connectionsList:
          user.connectionsList?.map(c => ({
            id: c._id?.toString(),
            name: c.name,
            email: c.email,
            title: c.title,
            company: c.company,
          })) || [],
        points: user.points || 0,
        badges: user.badges || [],
      },
    });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT /api/users/:id → Update user profile
router.put("/:id", authRequired, async (req, res) => {
  try {
    const id = (req.params.id || "").trim();
    const authUserId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (authUserId !== id) {
      return res
        .status(403)
        .json({ message: "You cannot edit another user's profile" });
    }

    const {
      name,
      title,
      company,
      location,
      phone,
      website,
      linkedin,
      github,
      bio,
      skills,
      department,
      batch,
      isMentor,
      achievements,
      experience,
    } = req.body;

    const updated = await User.findByIdAndUpdate(
      id,
      {
        name,
        title,
        company,
        location,
        phone,
        website,
        linkedin,
        github,
        bio,
        skills,
        department,
        batch,
        isMentor,
        achievements,
        experience,
      },
      { new: true }
    ).populate("connectionsList", "name email title company");

    if (!updated) return res.status(404).json({ message: "User not found" });

    // 🎯 Gamification: give +10 pts for first profile completion
    const profileFields = [updated.title, updated.company, (updated.skills || []).length];
    const isComplete = profileFields.every(Boolean);

    updated.badges = updated.badges || [];
    if (isComplete && !updated.badges.some(b => b.key === "profile_complete")) {
      updated.points = (updated.points || 0) + 10;
      updated.badges.push({
        key: "profile_complete",
        name: "Profile Completed",
        description: "Completed profile information",
        awardedAt: new Date(),
      });
      await updated.save();
    }

    res.json({ message: "Profile updated", user: updated });
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
