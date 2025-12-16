// backend/src/routes/admin.js
import { Router } from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import { isAdmin } from "../middleware/isAdmin.js";

import User from "../models/User.js";
import Message from "../models/Message.js";
import Event from "../models/Event.js";
import Job from "../models/Job.js";
import News from "../models/News.js";
import Mentorship from "../models/Mentorship.js";

const router = Router();

/*
 * ==========================================
 *  USERS MANAGEMENT
 * ==========================================
 */

// GET ALL USERS
router.get("/users", authRequired, isAdmin, async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (q) {
      const rx = new RegExp(q, "i");
      filter.$or = [
        { name: rx },
        { email: rx },
        { title: rx },
        { company: rx },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const users = await User.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(filter);

    return res.json({ users, total });
  } catch (err) {
    console.error("ADMIN GET /users error:", err);
    return res.status(500).json({ message: "Server error listing users" });
  }
});

// GET USER BY ID
router.get("/users/:id", authRequired, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("ADMIN GET /users/:id error:", err);
    return res.status(500).json({ message: "Server error fetching user" });
  }
});

// UPDATE USER (role / details)
router.patch("/users/:id", authRequired, isAdmin, async (req, res) => {
  try {
    const update = { ...req.body };

    // Ensure valid role
    if (update.role) {
      const validRoles = ["user", "moderator", "admin"];
      if (!validRoles.includes(update.role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
    }

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "User not found" });

    return res.json({ user: updated });
  } catch (err) {
    console.error("ADMIN PATCH /users/:id error:", err);
    return res.status(500).json({ message: "Server error updating user" });
  }
});

// DELETE USER (cascade deletes)
router.delete("/users/:id", authRequired, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // cascade cleanup
    await Message.deleteMany({ $or: [{ from: id }, { to: id }] });
    await Event.deleteMany({ hostId: id });
    await Job.deleteMany({ postedBy: id });
    await News.deleteMany({ authorId: id });
    await Mentorship.deleteMany({ mentorId: id });

    return res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error("ADMIN DELETE /users/:id error:", err);
    return res.status(500).json({ message: "Server error deleting user" });
  }
});

/*
 * ==========================================
 *  CONTENT MODERATION
 * ==========================================
 */

function createDeleteRoute(model, name) {
  return async (req, res) => {
    try {
      const id = req.params.id;

      const deleted = await model.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: `${name} not found` });

      return res.json({ ok: true, deleted: id });
    } catch (err) {
      console.error(`ADMIN DELETE /${name}/:id error:`, err);
      return res.status(500).json({ message: `Server error deleting ${name}` });
    }
  };
}

router.delete("/events/:id", authRequired, isAdmin, createDeleteRoute(Event, "Event"));
router.delete("/jobs/:id", authRequired, isAdmin, createDeleteRoute(Job, "Job"));
router.delete("/news/:id", authRequired, isAdmin, createDeleteRoute(News, "News"));
router.delete("/mentorship/:id", authRequired, isAdmin, createDeleteRoute(Mentorship, "Mentorship"));
router.delete("/messages/:id", authRequired, isAdmin, createDeleteRoute(Message, "Message"));

export default router;
