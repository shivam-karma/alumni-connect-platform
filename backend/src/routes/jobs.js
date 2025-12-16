// backend/src/routes/jobs.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Job from "../models/Job.js";
import JobApplication from "../models/JobApplication.js";
import { authRequired } from "../middleware/auth.js";
import { awardPoints } from "../services/pointsService.js";
import User from "../models/User.js";

const router = Router();

// ===== Multer setup for resume upload =====
const uploadDir = path.join(process.cwd(), "uploads", "resumes");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only PDF/DOC/DOCX allowed"));
    cb(null, true);
  }
});

// ===== Create a Job =====
router.post("/", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    payload.postedBy = req.userId;
    const job = await Job.create(payload);

    // Gamification (safe): award points if awardPoints service exists
    try {
      if (typeof awardPoints === "function") {
        await awardPoints(req.userId, "job_post", 20, {
          meta: { jobId: job._id },
          updateStats: { field: "jobPosts", inc: 1 },
          badge: { key: "job_poster", name: "Job Poster", description: "Posted your first job" }
        });
      } else {
        const user = await User.findById(req.userId);
        if (user) {
          user.points = (user.points || 0) + 20;
          user.stats = user.stats || {};
          user.stats.jobPosts = (user.stats.jobPosts || 0) + 1;
          if (!user.badges?.some(b => b.key === "job_poster")) {
            user.badges = user.badges || [];
            user.badges.push({
              key: "job_poster",
              name: "Job Poster",
              description: "Posted your first job",
              awardedAt: new Date()
            });
          }
          await user.save();
        }
      }
    } catch (gerr) {
      console.warn("Gamification (job_post) failed:", gerr);
    }

    res.status(201).json({ job });
  } catch (err) {
    console.error("POST /api/jobs error", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Get all jobs =====
router.get("/", async (req, res) => {
  try {
    const { q, location, type, company, page = 1, limit = 12 } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;

    const filter = {};
    if (q) filter.title = new RegExp(q, "i");
    if (location) filter.location = new RegExp(location, "i");
    if (type) filter.jobType = type;
    if (company) filter.company = new RegExp(company, "i");

    const [items, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Job.countDocuments(filter)
    ]);

    res.json({ jobs: items, total });
  } catch (err) {
    console.error("GET /api/jobs error", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Get single job =====
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ job });
  } catch (err) {
    console.error("GET /api/jobs/:id error", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Apply for job (upload resume) =====
// Expects multipart form data:
// fields: name, email, phone, yearsExperience, coverLetter
// file field: resume (optional)
router.post("/:id/apply", authRequired, upload.single("resume"), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Build resume path (serve via /uploads static)
    const resumePath = req.file ? `/uploads/resumes/${req.file.filename}` : "";

    // required fields: name + email (frontend enforces)
    const { name, email, phone, yearsExperience, coverLetter } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const application = await JobApplication.create({
      job: job._id,
      applicant: req.userId || null,
      name,
      email,
      phone: phone || "",
      yearsExperience: yearsExperience || "",
      coverLetter: coverLetter || "",
      resumeUrl: resumePath,
      status: "applied"
    });

    res.status(201).json({ application });
  } catch (err) {
    console.error("POST /api/jobs/:id/apply error", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Get all applications for a job =====
router.get("/:id/applications", authRequired, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // only job owner can fetch applications
    const ownerId = job.postedBy?.toString ? job.postedBy.toString() : job.postedBy;
    if (!ownerId) {
      return res.status(400).json({ message: "Job owner not set on the job record" });
    }
    if (ownerId !== req.userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // fetch applications and populate applicant (if linked)
    const applications = await JobApplication.find({ job: job._id })
      .sort({ createdAt: -1 })
      .populate("applicant", "name email title company")
      .lean();

    res.json({ applications });
  } catch (err) {
    console.error("GET /api/jobs/:id/applications error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== Delete job =====
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.postedBy?.toString() !== req.userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await job.deleteOne();
    res.json({ message: "Job deleted" });
  } catch (err) {
    console.error("DELETE /api/jobs/:id error", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
