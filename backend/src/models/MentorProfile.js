// backend/src/models/MentorProfile.js
import mongoose from "mongoose";

const MentorProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  expertise: { type: [String], default: [] },
  bio: { type: String, default: "" },
  availability: { type: String, default: "" }, // e.g. "Weekends, Evenings"
  sessionTypes: { type: [String], default: [] }, // e.g. ["1-on-1","Portfolio Review"]
  languages: { type: [String], default: [] },
  maxMentees: { type: Number, default: 1 },
  preferredDurationMinutes: { type: Number, default: 60 },
  linkedin: String,
  website: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { timestamps: true });

export default mongoose.model("MentorProfile", MentorProfileSchema);
