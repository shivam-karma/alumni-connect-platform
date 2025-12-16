// backend/src/models/Mentorship.js
import mongoose from "mongoose";

const MentorshipSchema = new mongoose.Schema(
  {
    mentorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topics: [{ type: String }],
    mode: { type: String }, // e.g. 'Online', 'Offline'
    slots: { type: Number, default: 1 },
    bio: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.models.Mentorship || mongoose.model("Mentorship", MentorshipSchema);
