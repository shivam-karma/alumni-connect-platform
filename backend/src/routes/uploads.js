// backend/src/routes/uploads.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

// ensure root uploads dir exists
const rootUploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(rootUploadDir)) fs.mkdirSync(rootUploadDir, { recursive: true });

// ----- generic storage factory -----
function makeStorage(subdir) {
  const dir = path.join(rootUploadDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, safe);
    }
  });
}

// specific upload handlers
const newsStorage = makeStorage("news");
const resumeStorage = makeStorage("resumes");
const messagesStorage = makeStorage("messages");

// Common helpers
function buildFullUrl(req, relPath) {
  try {
    const proto = req.protocol || "http";
    const host = req.get("host") || "localhost";
    return `${proto}://${host}${relPath}`;
  } catch {
    return relPath;
  }
}

// File filters
function imageFileFilter(req, file, cb) {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
  if (!allowed.includes(file.mimetype)) {
    // Use MulterError so we can detect it specifically
    const merr = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    merr.message = "Only image files are allowed";
    return cb(merr);
  }
  cb(null, true);
}

function resumeFileFilter(req, file, cb) {
  const allowedExt = [".pdf", ".doc", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext)) {
    const merr = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    merr.message = "Only PDF/DOC/DOCX allowed";
    return cb(merr);
  }
  cb(null, true);
}

// multer instances
const newsUpload = multer({
  storage: newsStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter,
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: resumeFileFilter,
});

const messageUpload = multer({
  storage: messagesStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Wrapper to run multer middleware and handle errors inline (so we can respond JSON)
function runUpload(uploadMiddleware, fieldName) {
  return (req, res) => {
    uploadMiddleware.single(fieldName)(req, res, (err) => {
      if (err) {
        // Multer error (file too large, unexpected file, etc.)
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large. Max 10 MB." });
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            // err.message is set in our filters above
            return res.status(400).json({ message: err.message || "Unexpected file or invalid file type." });
          }
          return res.status(400).json({ message: `Upload error: ${err.code}` });
        }

        // Generic error
        console.error("Upload middleware error:", err);
        return res.status(500).json({ message: err?.message || "Upload failed" });
      }

      // No multer error — now check if file exists
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded. Ensure field name is correct." });
      }

      // Build public URL and respond
      const relPath = `/${path.relative(process.cwd(), req.file.path).replace(/\\/g, "/")}`;
      const url = buildFullUrl(req, relPath);
      return res.status(201).json({
        message: "Upload successful",
        url,
        path: relPath,
        filename: req.file.originalname,
        storedFilename: req.file.filename,
        size: req.file.size,
      });
    });
  };
}

// ---- routes ----

// POST /api/uploads/news  -> field "image"
router.post("/news", authRequired, runUpload(newsUpload, "image"));

// POST /api/uploads/resume -> field "resume"
router.post("/resume", authRequired, runUpload(resumeUpload, "resume"));

// POST /api/uploads/messages -> field "file"
router.post("/messages", authRequired, runUpload(messageUpload, "file"));

// generic: accept multipart file under "file" and return url (safe fallback)
router.post("/file", authRequired, runUpload(messageUpload, "file"));

export default router;
