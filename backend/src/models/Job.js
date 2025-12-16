// backend/src/models/Job.js
import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, default: "" },
  location: { type: String, default: "" }, // "Bengaluru, Remote"
  jobType: { type: String, default: "Full-time" }, // Full-time / Part-time / Internship / Contract
  experienceLevel: { type: String, default: "" }, // e.g. "3-5 years"
  category: { type: String, default: "" }, // e.g. "Engineering"
  salaryRange: { type: String, default: "" },
  description: { type: String, default: "" },
  requirements: { type: [String], default: [] },
  skills: { type: [String], default: [] },
  benefits: { type: [String], default: [] },
  applicationUrl: { type: String, default: "" }, // optional external link
  contactEmail: { type: String, default: "" },    // optional
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  featured: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { timestamps: true });

export default mongoose.model("Job", JobSchema);
