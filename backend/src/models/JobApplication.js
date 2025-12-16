// backend/src/models/JobApplication.js
import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // optional if anonymous applicant
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: "" },
  yearsExperience: { type: String, default: "" },
  coverLetter: { type: String, default: "" },
  resumeUrl: { type: String, default: "" }, // stored path like /uploads/resumes/xxx.pdf
  status: { type: String, enum: ["applied", "shortlisted", "rejected", "hired"], default: "applied" }
}, { timestamps: true });

export default mongoose.model("JobApplication", jobApplicationSchema);
