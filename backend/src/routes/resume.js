// backend/src/routes/resume.js
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js";
import { embedText, cosine, readJobIndex, saveJobIndex } from "../services/embeddings.js";

const router = express.Router();

// storage for uploads (tmp)
const tmpDir = path.join(process.cwd(), "tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only PDF files are allowed"));
    cb(null, true);
  },
});

// Helper to attempt multer.single('resume') then fallback to single('file')
function multerSingleEither(fieldA = "resume", fieldB = "file") {
  return (req, res, next) => {
    const primary = upload.single(fieldA);
    primary(req, res, (err) => {
      if (!err) return next();
      // If multer rejected because field name unexpected, try alternate field
      const isUnexpected = err && (err.code === "LIMIT_UNEXPECTED_FILE" || /Unexpected field/i.test(err.message));
      if (isUnexpected) {
        const alt = upload.single(fieldB);
        return alt(req, res, (err2) => {
          // if still error, pass that error
          return next(err2 || null);
        });
      }
      // other error (file too large, invalid type, etc.)
      return next(err);
    });
  };
}

// small utilities
function safeReadFile(p) {
  try {
    return fs.readFileSync(p);
  } catch (e) {
    return null;
  }
}
function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.warn("safeUnlink failed:", e && e.message ? e.message : e);
  }
}

/**
 * POST /api/resume/parse
 * field: resume (or file) (multipart/form-data)
 * returns: { parsed: {...}, rawText, message }
 */
router.post("/parse", authRequired, multerSingleEither("resume", "file"), async (req, res) => {
  // Accept either req.file (normal) or req.files depending on multer result
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file uploaded. Use field name 'resume' (or 'file')" });
  }

  const fullpath = file.path;
  try {
    // dynamic import of pdf-parse to avoid ESM/CommonJS issues
    let pdfParseModule;
    try {
      pdfParseModule = await import("pdf-parse");
    } catch (e) {
      // second attempt (some environments)
      try {
        pdfParseModule = (await import("pdf-parse")).default || (await import("pdf-parse"));
      } catch (e2) {
        console.error("pdf-parse import failed:", e2);
        return res.status(500).json({ message: "pdf-parse unavailable on server" });
      }
    }
    const pdfParse = pdfParseModule && (pdfParseModule.default || pdfParseModule);
    if (!pdfParse || typeof pdfParse !== "function") {
      return res.status(500).json({ message: "pdf-parse unavailable on server" });
    }

    const buffer = safeReadFile(fullpath);
    if (!buffer) {
      return res.status(500).json({ message: "Uploaded file not readable" });
    }

    let data;
    try {
      data = await pdfParse(buffer);
    } catch (err) {
      // common parsing errors: corrupted PDF / bad xref
      console.error("pdf-parse error:", err && err.message ? err.message : err);
      const msg = (err && err.message) || String(err);
      // return helpful message to frontend so user can re-upload a regenerated PDF
      return res.status(400).json({
        message: "Failed to parse PDF. The file may be corrupted or not a standard PDF.",
        error: msg,
        hint: "Try re-saving the PDF (Print -> Save as PDF), or upload a different PDF. If it's an image-only PDF, convert it to searchable PDF or provide a text PDF.",
      });
    }

    const text = (data && data.text) ? String(data.text) : "";

    // Simple extraction heuristics
    const parsed = {
      name: null,
      email: null,
      phone: null,
      skills: [],
      education: [],
      experience: [],
      text: text,
    };

    // Email
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) parsed.email = emailMatch[0].trim();

    // Phone
    const phoneMatch = text.match(/(\+?\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?[\d\s-]{6,12}\d/g);
    if (phoneMatch) {
      parsed.phone = phoneMatch.map(p => p.replace(/\s+/g, " ").trim()).find(p => p.replace(/\D/g, "").length >= 7) || phoneMatch[0];
    }

    // Name heuristic
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const black = ["email", "phone", "linkedin", "github", "resume", "objective"];
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const L = lines[i];
      if (!L) continue;
      const low = L.toLowerCase();
      if (black.some(b => low.includes(b))) continue;
      const words = L.split(/\s+/);
      const alphaWords = words.filter(w => /[a-zA-Z]/.test(w));
      if (alphaWords.length >= 1 && alphaWords.length <= 4 && L.length < 60) {
        if (!/ at |@|www|http/i.test(L)) {
          parsed.name = L;
          break;
        }
      }
    }

    // Skills matching
    const skillCandidates = [
      "python","java","javascript","typescript","react","angular","vue",
      "node","express","django","flask","sql","mysql","postgres","mongodb",
      "tableau","powerbi","excel","pandas","numpy","scikit-learn","tensorflow",
      "pytorch","nlp","openai","aws","azure","gcp","docker","kubernetes",
      "git","html","css","rest","api","linux","c++","c#","php","ruby"
    ];
    const lowText = text.toLowerCase();
    const foundSkills = new Set();
    for (const s of skillCandidates) {
      if (lowText.includes(s)) foundSkills.add(s);
    }
    parsed.skills = Array.from(foundSkills);

    // Education/Experience heuristics
    function captureSections(headerKeywords = ["education","qualification","qualifications","academic"], maxLines = 6) {
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i].toLowerCase();
        for (const h of headerKeywords) {
          if (L.includes(h)) {
            const list = [];
            for (let j = i + 1; j <= i + maxLines && j < lines.length; j++) {
              const s = lines[j].trim();
              if (!s) continue;
              if (s.length < 4) continue;
              list.push(s);
            }
            if (list.length) return list;
          }
        }
      }
      return [];
    }
    parsed.education = captureSections(["education","academic","qualifications","degree"], 8);
    parsed.experience = captureSections(["experience","work experience","employment","professional experience","projects"], 8);

    if (!parsed.experience.length) {
      const expLines = lines.filter(l => /\b(years?|yrs|months?)\b|\d{4}\s*-\s*\d{4}/i.test(l)).slice(0, 6);
      parsed.experience = expLines;
    }

    return res.json({ parsed, rawText: text, message: "Parsed successfully" });
  } catch (err) {
    console.error("POST /api/resume/parse error:", err);
    return res.status(500).json({ message: "Failed to parse resume", error: err?.message || String(err) });
  } finally {
    // always cleanup
    safeUnlink(fullpath);
  }
});

/**
 * POST /api/resume/suggest
 * (unchanged logic, same as your original)
 */
router.post("/suggest", authRequired, async (req, res) => {
  try {
    const text = (req.body && (req.body.text || req.body.parsed && (req.body.parsed.text || req.body.parsed.skills && req.body.parsed.skills.join(" ")))) || "";
    if (!text || String(text).trim().length < 20) {
      return res.status(400).json({ message: "No resume text provided for suggestions" });
    }

    // create embedding for the resume text
    let resumeEmbedding;
    try {
      resumeEmbedding = await embedText(String(text));
    } catch (e) {
      console.error("embedText error:", e);
      return res.status(500).json({ message: "Failed to create embedding", error: e?.message || String(e) });
    }

    // read job index
    let jobs = readJobIndex(); // array of { id, title, company, description, url, embedding }
    // compute embeddings for any jobs that lack them
    const needCompute = jobs.filter(j => !Array.isArray(j.embedding) || j.embedding.length === 0);
    if (needCompute.length) {
      try {
        for (const job of needCompute) {
          const emb = await embedText(String((job.description || job.title || job.company || "")));
          job.embedding = emb;
        }
        saveJobIndex(jobs);
      } catch (e) {
        console.warn("Failed to compute job embeddings:", e);
      }
    }

    const scored = jobs.map(job => {
      const score = (Array.isArray(job.embedding) && job.embedding.length === resumeEmbedding.length) ? cosine(resumeEmbedding, job.embedding) : 0;
      return { job, score };
    });

    scored.sort((a,b) => b.score - a.score);
    const top = scored.slice(0, 10).filter(s => s.score > 0).map(s => ({
      id: s.job.id || s.job._id || s.job.title,
      title: s.job.title,
      company: s.job.company,
      description: s.job.description,
      url: s.job.url,
      matchScore: Math.round((s.score || 0) * 100)
    }));

    return res.json({ jobs: top });
  } catch (err) {
    console.error("POST /api/resume/suggest error:", err);
    return res.status(500).json({ message: "Server error suggesting jobs", error: err?.message || String(err) });
  }
});

/**
 * POST /api/resume/autofill
 */
router.post("/autofill", authRequired, async (req, res) => {
  try {
    const { userId, parsed } = req.body || {};
    if (!userId || !parsed) return res.status(400).json({ message: "userId and parsed data required" });

    const update = {};
    if (parsed.name) update.name = parsed.name;
    if (parsed.email) update.email = parsed.email;
    if (parsed.phone) update.phone = parsed.phone;
    if (Array.isArray(parsed.skills) && parsed.skills.length) update.skills = Array.from(new Set([...(parsed.skills || [])]));
    if (Array.isArray(parsed.experience) && parsed.experience.length) update.experience = parsed.experience;
    if (Array.isArray(parsed.education) && parsed.education.length) update.education = parsed.education;
    if (parsed.text && !update.bio) update.bio = parsed.text.split("\n").slice(0,6).join(" ").slice(0,800);

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("POST /api/resume/autofill error:", err);
    return res.status(500).json({ message: "Server error autofilling profile", error: err?.message || String(err) });
  }
});

export default router;
