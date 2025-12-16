// backend/src/routes/resume-parse.js
// Simple resume parser endpoint that reads a local file path (PDF) or returns heuristics
import express from "express";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

const router = express.Router();

/**
 * Very small heuristics-based parser:
 * - If the provided url is a local file path and points to a PDF, extract text via pdf-parse.
 * - Attempt to pick a name from the first lines, and extract skills by matching a small skills list.
 * - Returns parsed JSON: { name, title, skills, education, experience, rawText }
 */

const SIMPLE_SKILLS = [
  "python","pandas","numpy","sql","excel","tableau","powerbi",
  "javascript","react","node","express","html","css",
  "java","spring","hibernate","c++","c","git",
  "machine learning","tensorflow","pytorch","scikit-learn","nlp",
];

function extractSkills(text) {
  const lower = (text || "").toLowerCase();
  const found = new Set();
  SIMPLE_SKILLS.forEach(s => {
    if (lower.includes(s)) found.add(s);
  });
  return Array.from(found);
}

function extractNameFromText(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Heuristic 1: first line if it contains letters and has <=4 words
  if (lines.length) {
    const first = lines[0];
    if (/^[A-Za-z .'-]{2,40}$/.test(first) && first.split(/\s+/).length <= 4) return first;
  }
  // Heuristic 2: look for lines that begin with 'Name' or 'Candidate'
  for (const l of lines.slice(0, 8)) {
    const m = l.match(/^(?:name[:\-]\s*)(.+)/i);
    if (m) return m[1].trim();
  }
  return null;
}

function extractEducation(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const edus = [];
  if (lower.includes("bachelor") || lower.includes("b.tech") || lower.includes("bca") || lower.includes("b.sc")) edus.push("Bachelor's degree (detected)");
  if (lower.includes("master") || lower.includes("m.tech") || lower.includes("m.sc") || lower.includes("mba")) edus.push("Master's degree (detected)");
  if (lower.includes("phd")) edus.push("PhD (detected)");
  return edus;
}

function extractExperienceSummary(text) {
  if (!text) return null;
  // quick attempt to find lines mentioning 'intern' or 'worked at' etc
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const exp = lines.find(l => /intern|engineer|developer|analyst|worked at|worked as|company/i.test(l));
  return exp || null;
}

// POST /api/resume/parse
// body: { url: "/mnt/data/..." }  (url can be a local path on the server)
router.post("/parse", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return res.status(400).json({ ok: false, error: "Missing 'url' in request body." });

    // Check if local file exists -> allow local file path or absolute path
    // For security you may want to restrict to certain directories; here we assume dev environment.
    const localPath = url;
    let rawText = "";
    let parsed = {};

    try {
      const abs = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) {
        // file not found: return heuristic JSON using filename
        const fallbackName = path.basename(localPath).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        parsed = {
          name: fallbackName,
          title: "",
          skills: [],
          education: [],
          experience: [],
          rawText: "",
          source: localPath,
        };
        return res.json({ ok: true, parsed });
      }

      // If it's a PDF — attempt to parse
      if (abs.toLowerCase().endsWith(".pdf")) {
        const data = await fs.readFile(abs);
        const pdf = await pdfParse(data);
        rawText = pdf.text || "";
      } else {
        // If not PDF (image or other), just set rawText to an empty string and fall back to filename heuristics
        try {
          const data = await fs.readFile(abs, { encoding: "utf8" });
          rawText = data;
        } catch {
          rawText = "";
        }
      }

      // run heuristics on rawText
      const name = extractNameFromText(rawText) || path.basename(localPath).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const skills = extractSkills(rawText);
      const education = extractEducation(rawText);
      const experience = [];
      const expSumm = extractExperienceSummary(rawText);
      if (expSumm) experience.push(expSumm);

      parsed = {
        name,
        title: "",
        skills,
        education,
        experience,
        rawText: rawText.slice(0, 10_000), // cap length
        source: localPath,
      };

      return res.json({ ok: true, parsed });
    } catch (err) {
      console.error("resume-parse error reading file:", err);
      // fallback: return heuristics based on filename
      const fallbackName = path.basename(localPath).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      parsed = {
        name: fallbackName,
        title: "",
        skills: [],
        education: [],
        experience: [],
        rawText: "",
        source: localPath,
      };
      return res.json({ ok: true, parsed, warning: "Failed to read file; returned heuristic parse from filename." });
    }
  } catch (err) {
    console.error("resume-parse general error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
