// backend/src/server.js
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config(); // load .env as early as possible
import { connectDB } from './config/db.js';
import chatRoutes from "./routes/chat.js";
import contentPublic from "./routes/content-public.js";
// import chatRoutes from "./routes/chat.js";
import http from 'http';
import { Server as IOServer } from 'socket.io';

import OpenAI from 'openai';
import fs from 'fs/promises';
import multer from 'multer';

import aiRoutes from "./routes/ai.js";
import localFallback from "./routes/localFallback.js";
// route imports
import resumeParseRoutes from "./routes/resume-parse.js";
import aiLocalRoutes from "./routes/ai-local.js";
import newsRoutes from "./routes/news.js";
import uploadsRoutes from "./routes/uploads.js";
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import connectionsRoutes from './routes/connections.js';
import messagesRoutes from './routes/messages.js';
import requestsRoutes from './routes/requests.js';
import eventsRoutes from "./routes/events.js";
import mentorshipRoutes from './routes/mentorship.js';
import jobsRoutes from './routes/jobs.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from "./routes/search.js";
import resumeRoutes from "./routes/resume.js";

const app = express();

// Configure helmet but allow cross-origin resource loading (so /uploads images can be fetched by the frontend)
app.use(
  helmet({
    // allow cross-origin resources (images/scripts/etc) to be fetched from other origins
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // keep other helmet defaults
  })
);

// Body parsing & cookies
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// CORS — must be registered BEFORE static '/uploads' so static files carry CORS headers
const FRONTEND_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

// If user supplied a single '*' allow all origins
const allowAll = Array.isArray(FRONTEND_ORIGINS) && FRONTEND_ORIGINS.length === 1 && FRONTEND_ORIGINS[0] === '*';

app.use(
  cors({
    origin: allowAll ? true : FRONTEND_ORIGINS,
    credentials: true,
  })
);

// Small middleware for /uploads to ensure Access-Control-Allow-Origin is set for allowed origins
app.use('/uploads', (req, res, next) => {
  const origin = req.get('origin');
  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && FRONTEND_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});








const AI_MODE = (process.env.AI_MODE || "local").toLowerCase();

if (AI_MODE === "openai") {
  // only enable if you want to call OpenAI
  try {
    const aiRoutes = await import("./routes/ai.js");
    app.use("/api/ai", aiRoutes.default || aiRoutes);
    console.log("Mounted OpenAI-based ai routes (AI_MODE=openai)");
  } catch (e) {
    console.warn("Could not mount openai ai route:", e?.message || e);
    // fallback to local
    app.use("/api/ai", aiLocalRoutes);
    console.log("Fell back to ai-local routes");
  }
} else {
  // default: local rule-based assistant
  app.use("/api/ai", aiLocalRoutes);
  console.log("Mounted ai-local (rule-based) routes (AI_MODE=local)");
}


// serve optional public API content
app.use("/api", contentPublic);

// serve uploaded files (static) — CORS + Helmet crossOriginResourcePolicy now allow cross-origin image fetches
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// mount resume/search *after* uploads static so resume endpoints can reference uploads if needed
app.use('/api/resume', resumeRoutes);
app.use("/api", searchRoutes);

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
});
app.use('/api/auth', authLimiter);

// ===== openai key availability (non-fatal) =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
app.locals.openaiKey = OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY missing — resume parsing + job matching AI features will not work.");
} else {
  console.log("✅ OPENAI_API_KEY loaded successfully.");
}

// instantiate OpenAI client if key available
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

// --- create HTTP server & Socket.IO ---
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: allowAll ? "*" : FRONTEND_ORIGINS,
    methods: ["GET","POST"],
    credentials: true
  }
});

// Helpful engine-level connection error logging
io.engine.on('connection_error', (err) => {
  console.error('⚠️ Socket.IO engine connection_error:', err);
});

// In-memory map userId -> socketId
const activeUsers = new Map();

// expose socket objects for route handlers and debugging
app.locals.io = io;
app.locals.activeUsers = activeUsers;

io.on('connection', (socket) => {
  console.log('✅ socket connected', socket.id, 'transport:', socket.conn.transport?.name);

  socket.on('auth:handshake', ({ userId } = {}) => {
    if (userId) {
      try {
        activeUsers.set(String(userId), socket.id);
        socket.userId = String(userId);
        socket.join(`user:${String(userId)}`);
        console.log('[sockets] user online', userId, '->', socket.id);
      } catch (e) {
        console.warn('auth:handshake error', e);
      }
    }
  });

  socket.on('join', (room) => {
    try { socket.join(room); console.log(`${socket.id} joined room ${room}`); } catch (e) { /* ignore */ }
  });

  socket.on('message:send', async (payload) => {
    try {
      // echo to sender
      socket.emit('message:sent', payload);
      // send to recipient if known
      const toSid = activeUsers.get(String(payload.to));
      if (toSid) io.to(toSid).emit('message:receive', payload);
      // also emit to conversation room
      if (payload.conversationId) io.to(`conv:${payload.conversationId}`).emit('message:receive', payload);
    } catch (err) {
      console.warn('socket message:send error', err);
    }
  });

  socket.on('disconnect', (reason) => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      console.log('🔌 socket disconnected', socket.userId, 'reason:', reason);
    } else {
      console.log('🔌 socket disconnected (unknown user)', socket.id, 'reason:', reason);
    }
  });
});

/* ===========================================================
   AI Endpoints (OpenAI integration)
   - POST /api/ai/chat
   - POST /api/ai/parse-resume   (multipart: resume file under 'resume')
   - POST /api/ai/job-recommend
   - POST /api/ai/skill-gap
   - POST /api/ai/auto-reply
   - POST /api/ai/summary
   - POST /api/ai/score-resume
   NOTE: endpoints are non-fatal when OPENAI_API_KEY missing; they return helpful errors.
   =========================================================== */

// multer for file uploads (temporary storage in 'uploads' directory)
const uploadDir = path.join(process.cwd(), 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}-${file.originalname}`;
    cb(null, unique);
  }
});
const upload = multer({ storage });

// helper wrapper for chat calls (returns { text, raw })
async function sendChat(messages = [], opts = {}) {
  if (!openai) throw new Error('OpenAI client not configured (OPENAI_API_KEY missing)');
  const model = opts.model || (process.env.OPENAI_MODEL || 'gpt-4o-mini');
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const max_tokens = opts.max_tokens || 800;

  const res = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });

  const text = res?.choices?.[0]?.message?.content ?? '';
  return { text, raw: res };
}

// Basic chat endpoint: sends the message + (optional) context to OpenAI and returns reply
app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });

    const { message = '', context = {} } = req.body || {};
    const systemPrompt = 'You are an AI career assistant. Keep replies concise, helpful, and actionable. When asked, trigger resume parsing or job recommendations as instructions.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    const out = await sendChat(messages, { temperature: 0.2, max_tokens: 800 });
    return res.json({ success: true, data: { reply: out.text, raw: out.raw } });
  } catch (err) {
    console.error('/api/ai/chat error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Parse resume: accepts multipart form file 'resume'. For reliability, prefer extracting text server-side (pdf-parse / mammoth).
// This implementation reads file bytes and sends base64 to model if present (demo fallback).
app.post('/api/ai/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded under field name `resume`' });

    // NOTE: For production, use pdf-parse/mammoth to extract text and send text chunks instead of base64
    const buffer = await fs.readFile(file.path);
    const base64 = buffer.toString('base64').slice(0, 1024 * 1000); // limit to first ~1MB to avoid huge tokens

    const prompt = `You are a resume parser. Extract these fields and return STRICT JSON only:
{
  "full_name": string or null,
  "email": string or null,
  "phone": string or null,
  "skills": [],
  "experience_years": number or null,
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "projects": []
}
Input: the resume file is provided as base64. If you cannot extract a field, return null or empty array.`;

    const messages = [
      { role: 'system', content: 'You are a precise resume extraction assistant; output valid JSON only.' },
      { role: 'user', content: `${prompt}\n\nBASE64_START\n${base64}\nBASE64_END` }
    ];

    const out = await sendChat(messages, { temperature: 0.0, max_tokens: 1200 });

    let parsed;
    try {
      parsed = JSON.parse(out.text);
    } catch (parseErr) {
      // fallback: return raw text under parsed_text so frontend can show it
      parsed = { parsed_text: out.text };
    }

    // cleanup uploaded file
    await fs.unlink(file.path).catch(() => {});

    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('/api/ai/parse-resume error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Job recommendation endpoint: expects resume JSON in body
app.post('/api/ai/job-recommend', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const { resume } = req.body || {};

    const messages = [
      { role: 'system', content: 'You are a job recommender. Output a JSON array of job suggestions.' },
      { role: 'user', content: `Given this resume JSON:\n${JSON.stringify(resume || {})}\n\nReturn: JSON array of objects [{ "title": "", "company": "", "match_score": 0-1, "reasons": [] }]` }
    ];

    const out = await sendChat(messages, { temperature: 0.0, max_tokens: 800 });

    let parsed;
    try { parsed = JSON.parse(out.text); } catch (e) { parsed = { raw: out.text }; }

    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('/api/ai/job-recommend error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Skill gap analyzer: accepts resume JSON and optional target_role
app.post('/api/ai/skill-gap', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const { resume, target_role } = req.body || {};

    const messages = [
      { role: 'system', content: 'You are a skill-gap analyzer. Output JSON: { missing: [], recommendations: [] }' },
      { role: 'user', content: `Resume:\n${JSON.stringify(resume || {})}\n\nTarget role: ${target_role || 'none'}\n\nReturn JSON only.` }
    ];

    const out = await sendChat(messages, { temperature: 0.0, max_tokens: 600 });

    let parsed;
    try { parsed = JSON.parse(out.text); } catch (e) { parsed = { raw: out.text }; }

    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('/api/ai/skill-gap error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Auto-reply generator: accepts message string
app.post('/api/ai/auto-reply', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const { message } = req.body || {};

    const messages = [
      { role: 'system', content: 'You are an assistant that writes short, professional replies (<=50 words).' },
      { role: 'user', content: `Incoming message:\n${message}\n\nReply concisely and politely.` }
    ];

    const out = await sendChat(messages, { temperature: 0.3, max_tokens: 200 });
    return res.json({ success: true, data: { reply: out.text } });
  } catch (err) {
    console.error('/api/ai/auto-reply error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Summary generator: produce 2-3 sentence LinkedIn-style summary from resume JSON
app.post('/api/ai/summary', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const { resume } = req.body || {};

    const messages = [
      { role: 'system', content: 'You are a profile writer. Produce a professional 2-3 sentence summary.' },
      { role: 'user', content: `Resume:\n${JSON.stringify(resume || {})}\n\nReturn only the summary text.` }
    ];

    const out = await sendChat(messages, { temperature: 0.2, max_tokens: 200 });
    return res.json({ success: true, data: { summary: out.text } });
  } catch (err) {
    console.error('/api/ai/summary error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Resume scoring endpoint: returns {score: number, feedback: []}
app.post('/api/ai/score-resume', async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI API key not configured on server.' });
    const { resume } = req.body || {};

    const messages = [
      { role: 'system', content: 'You are a resume reviewer. Output JSON: { score: number (0-100), feedback: [strings] }' },
      { role: 'user', content: `Resume:\n${JSON.stringify(resume || {})}\n\nReturn JSON only.` }
    ];

    const out = await sendChat(messages, { temperature: 0.0, max_tokens: 400 });

    let parsed;
    try { parsed = JSON.parse(out.text); } catch (e) { parsed = { raw: out.text }; }

    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('/api/ai/score-resume error', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

/* ===========================================================
   End AI endpoints
   =========================================================== */

// ===== API routes =====
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/requests', requestsRoutes);
app.use("/api/events", eventsRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/news', newsRoutes);
// app.use("/api/ai", aiRoutes);
app.use("/api/resume", resumeParseRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", localFallback);
app.use("/api", chatRoutes);
app.use("/api/ai", aiLocalRoutes);
// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Global process error handlers for visibility
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Start server after DB connect
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ MongoDB connected`);
      console.log(`🚀 Server + sockets running on http://localhost:${PORT}`);
      console.log('Allowed front-end origins:', FRONTEND_ORIGINS);
    });
  })
  .catch((err) => {
    console.error('❌ Mongo connection error:', err?.message || err);
    process.exit(1);
  });
