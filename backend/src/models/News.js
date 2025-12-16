// backend/src/models/News.js
import mongoose from "mongoose";

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, index: true },
  summary: { type: String, default: "" },
  body: { type: String, default: "" },
  category: { type: String, default: "General" }, // Latest News | Announcements | Success Story
  tags: { type: [String], default: [] },
  imageUrl: { type: String, default: "" },
  featured: { type: Boolean, default: false },

  author: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { timestamps: true });

export default mongoose.model("News", NewsSchema);
