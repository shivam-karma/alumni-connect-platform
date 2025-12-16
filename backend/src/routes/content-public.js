// backend/src/routes/content-public.js
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

// helper to get model safely (avoid require order issues)
function getModel(name) {
  try {
    return mongoose.model(name);
  } catch (e) {
    try {
      // try loading from src/models (if you use default exports)
      // eslint-disable-next-line global-require, import/no-dynamic-require
      // return require(`../models/${name}`).default;
      return null;
    } catch (err) {
      return null;
    }
  }
}

// GET /api/mentorship  -> list mentorship items
router.get("/mentorship", async (req, res) => {
  try {
    const Mentorship = getModel("Mentorship") || getModel("mentorship");
    if (!Mentorship) return res.status(404).json({ message: "Mentorship model not found" });
    const items = await Mentorship.find().sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ mentorship: items, total: items.length });
  } catch (e) {
    console.error("GET /api/mentorship error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/messages (public list) - note: may be auth-protected in your app
router.get("/messages", async (req, res) => {
  try {
    const Message = getModel("Message");
    if (!Message) return res.status(404).json({ message: "Message model not found" });
    const items = await Message.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ messages: items, total: items.length });
  } catch (e) {
    console.error("GET /api/messages error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
