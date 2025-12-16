// backend/utils/ai_fallback.js
// Simple local Q&A fallback. Expand this list as needed.

const qaList = [
  { q: "how to write a resume", a: "Keep it concise (1 page if early career). Focus on achievements (quantified), use bullet points, tailor to the job description, and include skills and contact details." },
  { q: "how to prepare for interviews", a: "Understand the job description, review common questions, practice STAR stories for behavioral questions, revise fundamentals for the role, and do mock interviews." },
  { q: "how to follow up after interview", a: "Send a short thank-you email within 24 hours, reiterate interest and one key point you discussed." },
  { q: "what is a good format for cover letter", a: "1) Short intro, 2) one paragraph matching your skills to the job, 3) closing with call-to-action. Keep it ~3-4 short paragraphs." },
  { q: "how to improve my linkedin profile", a: "Use a professional photo, headline with role + skills, concise summary, list experience with outcomes, add skills, and request recommendations." },
  { q: "what to include in an objective statement", a: "Briefly state your role target, top skills, and what you aim to deliver to employer — 1 sentence." },
  { q: "how to get job recommendations", a: "Use skills + location + preferred roles. Apply filters on platforms like LinkedIn, Naukri; enable job alerts; network and apply directly on company sites." },
  { q: "what is STAR method", a: "Situation, Task, Action, Result — use it to structure behavioral interview answers." },
  { q: "how to negotiate salary", a: "Research market rates, state a target range, emphasize value, and be ready to discuss benefits and flexibility." },
  { q: "how to write achievements on resume", a: "Use action verb + what you did + numeric outcome (e.g., 'Improved query speed by 40% using indexing')." },
  { q: "what skills do recruiters look for for entry level", a: "Problem solving, communication, basic domain tools (SQL/Python/React depending on role), eagerness to learn." },
  { q: "how to make a portfolio", a: "Show 3–6 projects with short descriptions, your role, tech used, and a link to repo/demo." },
  { q: "how to prepare for coding interviews", a: "Practice DS & algorithms (arrays, strings, trees, graphs), solve problems on LeetCode, and practice explaining your approach." },
  { q: "what is ATS", a: "Applicant Tracking System — format resumes simply: no images, clear headings, keywords from job descriptions." },
  { q: "how to write a gist in resume", a: "Start with a 2–3 line summary: role, years, top skills, and major impact." },
  { q: "how to ask for referrals", a: "Message contact politely, mention where you applied, why you're a fit, and ask if they'd refer you." },
  { q: "how to switch careers", a: "Build transferable skills, showcase projects, get certificates, network, and target entry-level roles in the new domain." },
  { q: "how to prepare for behavioral questions", a: "Collect examples for teamwork, conflict, leadership, failure, and learning; practice STAR answers." },
  { q: "what to put in skills section", a: "List technical skills (languages, frameworks, tools) and soft skills — keep most relevant first." },
  { q: "how to write LinkedIn headline", a: "Role + key skills + (optional) value: 'Data Analyst • SQL | Python • Turn data into insights'." },
  { q: "how to request informational interview", a: "Short message: introduce yourself, say you admire their work, request 15 min to learn about their role." },
  { q: "what interview questions to ask interviewer", a: "Ask about team priorities, success metrics, day-to-day tasks, and career growth." },
  { q: "how long should resume be", a: "1 page for early career, 2 pages for senior roles with lots of experience." },
  { q: "how to prepare for system design", a: "Learn fundamentals, practice large-scale design patterns, discuss tradeoffs, sketch architecture diagrams." },
  { q: "how to learn data structures", a: "Study definitions, implement them, solve problems using them; focus on arrays, stacks, queues, trees, graphs, hash maps." },
  { q: "how to list internships", a: "Give title, company, dates, bullets showing responsibility and results." },
  { q: "how to improve coding speed", a: "Practice common patterns, learn shortcuts, and timebox practice sessions." },
  { q: "how to ask for salary increase", a: "Prepare evidence of impact, propose range, choose right time (post-success review)." },
  { q: "how to start freelancing", a: "Build portfolio, join marketplaces, do smaller projects, collect testimonials." },
  { q: "how to prepare for remote interviews", a: "Test camera/mic, ensure quiet place, stable internet, and have resume/site ready." }
];

export function findAnswer(message) {
  if (!message || typeof message !== "string") return null;
  const m = message.toLowerCase().trim();
  // Exact or contains match
  for (const item of qaList) {
    if (m === item.q.toLowerCase() || m.includes(item.q.toLowerCase())) return item.a;
  }
  // fuzzy: match by keywords
  const keywords = m.split(/\s+/).slice(0, 6);
  for (const item of qaList) {
    const itemText = (item.q + " " + item.a).toLowerCase();
    if (keywords.every(k => itemText.includes(k))) return item.a;
  }
  // no match
  return null;
}
