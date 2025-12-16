// backend/src/routes/ai-local.js
import express from "express";
import crypto from "crypto";

const router = express.Router();

/**
 * Utilities
 */
function summarizeResume(parsed) {
  if (!parsed || typeof parsed !== "object") return "No resume data provided.";
  const name = parsed.name || parsed.fullName || parsed.personal?.name || "";
  const title = parsed.title || parsed.headline || parsed.profession || "";
  const skills = parsed.skills || parsed.tech || parsed.skills_list || [];
  const education = parsed.education || parsed.degree || parsed.school || null;
  const experience = parsed.experience || parsed.work || parsed.jobs || null;
  const skillStr = Array.isArray(skills) ? skills.slice(0,8).join(", ") : String(skills || "-");
  const lines = [];
  if (name) lines.push(`${name}${title ? ` — ${title}` : ""}`);
  else if (title) lines.push(title);
  lines.push(`Skills: ${skillStr || "-"}`);
  if (education) lines.push(`Education: ${Array.isArray(education) ? education[0] : education}`);
  // estimate experience years naive
  let expYears = null;
  if (Array.isArray(experience)) {
    let total = 0;
    experience.forEach((e) => {
      if (e?.years) total += Number(e.years) || 0;
      else if (e?.duration && typeof e.duration === "string") {
        const m = e.duration.match(/(\\d+)\\s*yr/);
        if (m) total += Number(m[1]);
      }
    });
    if (total) expYears = `${total} yrs`;
  } else if (typeof experience === "string") {
    const m = experience.match(/(\\d+)\\s*(?:years|yrs|y)/i);
    if (m) expYears = `${m[1]} yrs`;
  }
  if (expYears) lines.push(`Experience: approx ${expYears}`);
  return lines.join(" · ");
}

const SKILL_ROLE_MAP = [
  { skills: ["python","pandas","numpy","sql","scikit","sklearn"], roles: ["Data Analyst", "Data Engineer", "ML Engineer"] },
  { skills: ["javascript","react","html","css","node","express"], roles: ["Frontend Developer", "Full Stack Developer", "Web Developer"] },
  { skills: ["java","spring","hibernate"], roles: ["Java Backend Engineer", "Software Engineer"] },
  { skills: ["c++","algorithms","data structures"], roles: ["Systems Engineer", "Algorithm Engineer"] },
  { skills: ["sql","etl","redshift","bigquery"], roles: ["Data Engineer", "ETL Developer"] },
];

function recommendJobsFromSkills(skills = []) {
  if (!Array.isArray(skills)) {
    if (typeof skills === "string") skills = skills.split(/[,;]+/).map(s=>s.trim().toLowerCase());
    else skills = [];
  }
  const normalized = new Set(skills.map(s => String(s).toLowerCase()));
  const score = new Map();
  SKILL_ROLE_MAP.forEach(bucket => {
    const matches = bucket.skills.reduce((c, sk) => c + (normalized.has(sk) ? 1 : 0), 0);
    if (matches > 0) {
      bucket.roles.forEach(role => score.set(role, (score.get(role) || 0) + matches));
    }
  });
  if (score.size === 0) {
    return [
      { title: "Software Engineer (General)", reason: "Good general software engineering role for building skills." },
      { title: "Junior QA Engineer", reason: "Entry role focusing on testing and quality." },
      { title: "Intern / Trainee Developer", reason: "Good for gaining practical experience." },
    ];
  }
  return Array.from(score.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([title, sc]) => ({ title, reason: `Matches ${sc} skill keyword(s) from your profile.` }));
}

function scoreJobMatch(resume, jobDescription) {
  // simple overlap scoring: match keywords vs skills/title
  const text = `${jobDescription || ""}`.toLowerCase();
  const skills = (resume?.skills || resume?.tech || []).map(s => String(s).toLowerCase());
  const title = (resume?.title || resume?.headline || "").toLowerCase();
  let matches = 0;
  const matched = [];
  skills.forEach(sk => {
    if (text.includes(sk)) { matches += 1; matched.push(sk); }
  });
  // check title keywords
  if (title) {
    title.split(/\W+/).forEach(w => {
      if (w && text.includes(w)) { matches += 0.5; if (!matched.includes(w)) matched.push(w); }
    });
  }
  // normalize to percentage (naive)
  const possible = Math.max(skills.length, 3);
  const score = Math.min(100, Math.round((matches / possible) * 100));
  return { score, matches: matched, explanation: `Matched ${matched.length} keywords` };
}

function generateCoverLetter({ resume, jobTitle, company, jobDesc }) {
  // use short template and fill blanks
  const name = resume?.name || resume?.fullName || resume?.personal?.name || "Candidate";
  const topSkills = (resume?.skills || []).slice(0,5).join(", ") || "relevant skills";
  const opening = `Dear ${company || "Hiring Manager"},\n\nI am writing to express my interest in the ${jobTitle || "position"} at ${company || "your company"}. With experience in ${topSkills} and a background in ${resume?.title || resume?.profession || "software development"}, I believe I can contribute immediately to your team.`;
  const body = `\n\nIn my previous experience, I have ${Array.isArray(resume?.experience) ? resume.experience.slice(0,1).map(e=>e.title || e.position || e.role || e.company || "").join(", ") : resume?.experience || "worked on relevant projects"}. I am particularly excited about this role because ${jobDesc ? jobDesc.split(".")[0] : "it matches my skills and interests"}.\n\nI would welcome the opportunity to discuss how my experience and skills can benefit ${company || "your team"}.\n\nSincerely,\n${name}`;
  return `${opening}${body}`;
}

/**
 * Chat endpoint (existing local chat)
 */
router.post("/chat", (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ ok:false, error: "message required" });
    const text = message.trim().toLowerCase();

    if (/^(hi|hello|hey|hii)\\b/.test(text)) return res.json({ ok:true, data: { reply: "Hello! I can summarize resumes, recommend jobs, generate cover letters, and run mock interviews. Try: 'Recommend jobs' or 'Summarize my resume'." }});
    if (/(tip|interview|prepare|advice)/i.test(text)) return res.json({ ok:true, data: { reply: "Interview tips: Understand your projects, practice system design and algorithms, prepare STAR stories for behavioural questions." }});
    if (/summariz|analyz|parse.*resume|resume summary/i.test(text)) {
      const parsed = req.body.parsed || req.body.resume || null;
      if (parsed) return res.json({ ok:true, data: { reply: `Resume summary: ${summarizeResume(parsed)}`, summary: summarizeResume(parsed) }});
      return res.json({ ok:true, data: { reply: "To summarize your resume, include the parsed JSON in 'parsed' or 'resume' field in the request." }});
    }
    if (/recommend|jobs|job suggestions|job recommend/i.test(text)) {
      const parsed = req.body.parsed || req.body.resume || null;
      let skills = [];
      if (parsed) skills = parsed.skills || parsed.tech || parsed.skills_list || [];
      else {
        const candidates = ["python","java","javascript","react","node","sql","pandas","numpy","c++","spring","html","css"];
        candidates.forEach(s => { if (text.includes(s)) skills.push(s); });
      }
      const recs = recommendJobsFromSkills(skills);
      const short = recs.slice(0,3).map((r,i)=>`${i+1}. ${r.title} — ${r.reason}`).join("\\n");
      return res.json({ ok:true, data: { reply: `Job recommendations:\\n${short}`, recommendations: recs }});
    }

    // fallback
    if (text.length < 40) return res.json({ ok:true, data: { reply: `You said: \"${message}\". Try: 'Recommend jobs', 'Summarize my resume', 'Generate cover letter'` }});
    return res.json({ ok:true, data: { reply: "I can help with resume summaries, job recommendations, cover letters, mock interviews, portfolio generation, exam plans and project ideas. Use the specific tool endpoints or ask here." }});
  } catch (err) {
    console.error("ai-local /chat error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * job-recommend (existing)
 */
router.post("/job-recommend", (req, res) => {
  try {
    const { resume } = req.body || {};
    if (!resume || typeof resume !== "object") {
      const generic = recommendJobsFromSkills([]);
      return res.json({ ok:true, data: { parsed: generic, reply: "No resume provided — returning generic role suggestions." }});
    }
    const skills = resume.skills || resume.tech || resume.skills_list || [];
    const recs = recommendJobsFromSkills(skills);
    const summary = summarizeResume(resume);
    const imageHint = "/mnt/data/ca2ef488-5f17-4c14-8759-b95a4b441584.png";
    return res.json({ ok:true, data: { parsed: recs, summary, image: imageHint, reply: `Found ${recs.length} recommended roles. Summary: ${summary}` }});
  } catch (err) {
    console.error("ai-local /job-recommend error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Cover letter generator
 * POST /api/ai/cover-letter
 * body: { resume: {...}, jobTitle, company, jobDesc }
 */
router.post("/cover-letter", (req, res) => {
  try {
    const { resume, jobTitle, company, jobDesc } = req.body || {};
    if (!resume || !jobTitle) {
      return res.status(400).json({ ok:false, error: "resume and jobTitle required" });
    }
    const letter = generateCoverLetter({ resume, jobTitle, company, jobDesc });
    return res.json({ ok:true, data: { reply: letter, coverLetter: letter }});
  } catch (err) {
    console.error("ai-local /cover-letter error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Job-match scoring
 * POST /api/ai/job-match
 * body: { resume: {...}, jobDescription: "..." }
 */
router.post("/job-match", (req, res) => {
  try {
    const { resume, jobDescription } = req.body || {};
    if (!resume || !jobDescription) return res.status(400).json({ ok:false, error: "resume and jobDescription required" });
    const result = scoreJobMatch(resume, jobDescription);
    return res.json({ ok:true, data: { match: result }});
  } catch (err) {
    console.error("ai-local /job-match error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Portfolio builder
 * POST /api/ai/portfolio
 * body: { resume: {...}, projects: [...optional] }
 */
router.post("/portfolio", (req, res) => {
  try {
    const { resume, projects } = req.body || {};
    const name = resume?.name || "Candidate";
    const headline = resume?.title || resume?.headline || "Software Developer";
    const skills = (resume?.skills || []).slice(0,12).join(", ");
    // build a simple README-like portfolio
    const readme = `# ${name}\n\n**${headline}**\n\n**Skills:** ${skills}\n\n## Projects\n${(projects && projects.length) ? projects.map((p,i)=>`### ${i+1}. ${p.title || 'Project'}\n${p.summary || p.desc || '-'}\n`).join("\\n") : "- Add your projects here -\\n" }\n\n## About\n${resume?.summary || 'Passionate developer with interest in building impactful software.'}\n`;
    return res.json({ ok:true, data: { reply: "Generated portfolio README", readme, preview: readme }});
  } catch (err) {
    console.error("ai-local /portfolio error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Exam plan
 * POST /api/ai/exam-plan
 * body: { topic: "NumPy Pandas", durationDays: 7, level: "beginner" }
 */
router.post("/exam-plan", (req, res) => {
  try {
    const { topic, durationDays = 7, level = "beginner" } = req.body || {};
    if (!topic) return res.status(400).json({ ok:false, error: "topic required" });
    const days = Math.max(1, Math.min(30, Number(durationDays) || 7));
    const plan = [];
    const parts = `${topic}`.split(/,|and|&/).map(s=>s.trim()).filter(Boolean);
    for (let i=0;i<days;i++){
      const todayFocus = parts[i % parts.length] || topic;
      plan.push({ day: i+1, task: `Study ${todayFocus} — theory + practice (1-2 exercises)` });
    }
    return res.json({ ok:true, data: { reply: `Created ${days}-day study plan for ${topic}`, plan }});
  } catch (err) {
    console.error("ai-local /exam-plan error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Project ideas generator
 * POST /api/ai/project-ideas
 * body: { domain: "data science", skills: ["python","pandas"], count: 5 }
 */
router.post("/project-ideas", (req, res) => {
  try {
    const { domain = "web", skills = [], count = 5 } = req.body || {};
    const s = (Array.isArray(skills) ? skills : String(skills).split(/[,;]+/)).map(x=>x.trim()).filter(Boolean);
    const ideas = [];
    for (let i=1;i<=Number(count||5);i++){
      ideas.push({
        title: `${domain} Project ${i}`,
        summary: `Build a ${domain} project using ${s.join(", ") || "relevant tools"}. Deliverables: README, code, sample dataset, deployment instructions.`,
        difficulty: i<=2? "Easy": (i===3? "Medium": "Hard")
      });
    }
    return res.json({ ok:true, data: { reply: `Generated ${ideas.length} project ideas for ${domain}`, ideas }});
  } catch (err) {
    console.error("ai-local /project-ideas error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

/**
 * Simple Mock Interview state (in-memory). Lightweight: sessionId -> { questions, index, resume }
 * NOTE: This is ephemeral and resets when server restarts.
 */
const mockSessions = new Map();
const MOCK_QS = [
  { q: "Tell me about yourself.", type: "behavioral" },
  { q: "Describe a challenging bug you fixed.", type: "behavioral" },
  { q: "Explain the difference between SQL and NoSQL databases.", type: "technical" },
  { q: "Design a simple URL shortener (high level).", type: "design" },
  { q: "How would you optimize a slow SQL query?", type: "technical" },
];

router.post("/mock-interview/start", (req, res) => {
  try {
    const { resume } = req.body || {};
    const id = crypto.randomBytes(8).toString("hex");
    mockSessions.set(id, { idx: 0, resume });
    const first = MOCK_QS[0];
    return res.json({ ok:true, data: { sessionId: id, question: first.q, questionIndex: 0 }});
  } catch (err) {
    console.error("ai-local /mock-interview/start error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

router.post("/mock-interview/answer", (req, res) => {
  try {
    const { sessionId, answer } = req.body || {};
    if (!sessionId || !mockSessions.has(sessionId)) return res.status(400).json({ ok:false, error: "invalid sessionId" });
    const s = mockSessions.get(sessionId);
    const idx = s.idx;
    // very simple evaluation heuristics
    let score = 5;
    if (!answer || answer.trim().length < 30) score = 2;
    else if (answer.toLowerCase().includes("i") && answer.length > 80) score = 4;
    // feedback text
    let feedback = score >=4 ? "Good answer — you covered key points." : "Short answer — add more detail and examples (STAR).";
    // advance
    s.idx = idx + 1;
    mockSessions.set(sessionId, s);
    if (s.idx >= MOCK_QS.length) {
      mockSessions.delete(sessionId);
      return res.json({ ok:true, data: { finished: true, feedback, score }});
    } else {
      const next = MOCK_QS[s.idx];
      return res.json({ ok:true, data: { finished: false, nextQuestion: next.q, feedback, score, questionIndex: s.idx }});
    }
  } catch (err) {
    console.error("ai-local /mock-interview/answer error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
});

export default router;
