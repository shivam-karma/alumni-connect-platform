// backend/src/services/resumeParser.js

import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// pdf-parse is CommonJS → import using require
const pdfParse = require("pdf-parse");

// -----------------------
// Regex utilities
// -----------------------
const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,15}/g;
const YEAR_RE = /\b(19|20)\d{2}\b/g;

const COMMON_SKILLS = [
  "python","java","javascript","react","node","express","django","flask",
  "sql","mysql","mongodb","postgres","aws","azure","gcp","docker","kubernetes",
  "machine learning","ml","data analysis","pandas","numpy","tensorflow","pytorch",
  "nlp","natural language processing","computer vision","html","css","git"
];

// -----------------------
// Helper functions
// -----------------------
function cleanText(text) {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}

function guessNameFromText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    if (!EMAIL_RE.test(line) && !PHONE_RE.test(line) && /^[A-Za-z .'-]{2,60}$/.test(line)) {
      return line;
    }
  }
  return null;
}

function extractContacts(text) {
  const emails = [...text.matchAll(EMAIL_RE)].map(m => m[1]);
  const phones = [...text.matchAll(PHONE_RE)].map(m => m[0]);
  return { emails: [...new Set(emails)], phones: [...new Set(phones)] };
}

function extractSkills(text) {
  const low = text.toLowerCase();
  return COMMON_SKILLS.filter(s => low.includes(s));
}

function extractEducation(text) {
  const lines = text.split("\n");
  const out = [];
  for (const l of lines) {
    const low = l.toLowerCase();
    if (low.includes("university") || low.includes("college") || low.includes("degree")) {
      out.push(l.trim());
    }
  }
  return out;
}

function extractExperience(text) {
  const lines = text.split("\n");
  const out = [];
  for (const l of lines) {
    const low = l.toLowerCase();
    if (low.includes("experience") || low.includes("intern") || low.includes("engineer") || YEAR_RE.test(l)) {
      out.push(l.trim());
    }
  }
  return out;
}

// -----------------------
// MAIN PARSER (BUFFER)
// -----------------------
export async function parseResumeBuffer(buffer) {
  const pdfData = await pdfParse(buffer);
  const text = cleanText(pdfData.text || "");

  const contacts = extractContacts(text);

  const parsed = {
    name: guessNameFromText(text),
    email: contacts.emails?.[0] || null,
    phone: contacts.phones?.[0] || null,
    skills: extractSkills(text),
    education: extractEducation(text),
    experience: extractExperience(text),
    text
  };

  return { parsed, rawText: text };
}

// -----------------------
// PARSE FILE PATH
// -----------------------
export async function parseResumeFile(filePath) {
  const full = path.resolve(filePath);
  const buffer = fs.readFileSync(full);
  return parseResumeBuffer(buffer);
}

// -----------------------
// SIMPLE JOB SUGGESTION
// -----------------------
export function suggestJobsFromParsed(parsed) {
  const skills = (parsed?.skills || []).map(s => s.toLowerCase());
  const out = [];

  if (skills.includes("react") || skills.includes("javascript")) {
    out.push({ title: "Frontend Developer", matchScore: 85 });
  }
  if (skills.includes("python") || skills.includes("machine learning")) {
    out.push({ title: "Machine Learning Engineer", matchScore: 92 });
  }
  if (skills.includes("sql") || skills.includes("data analysis")) {
    out.push({ title: "Data Analyst", matchScore: 88 });
  }

  if (out.length === 0) {
    out.push({ title: "Software Engineer", matchScore: 60 });
  }

  return out;
}

export default {
  parseResumeBuffer,
  parseResumeFile,
  suggestJobsFromParsed
};
