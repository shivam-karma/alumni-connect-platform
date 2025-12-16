// backend/src/models/MentorshipRequest.js
import mongoose from "mongoose";

const MentorshipRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // mentor user id
  title: { type: String, default: "" }, // short subject
  message: { type: String, default: "" },
  status: { type: String, enum: ["pending","accepted","rejected","cancelled"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { timestamps: true });

export const MentorshipRequest = mongoose.model("MentorshipRequest", MentorshipRequestSchema);
