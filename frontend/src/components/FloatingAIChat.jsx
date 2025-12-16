import React, { useEffect, useRef, useState } from "react";

/**
 * FloatingAIChat.jsx
 *
 * Notes:
 * - Set VITE_API_BASE in your .env (e.g. VITE_API_BASE=http://localhost:5000)
 * - Optionally set VITE_AI_CHAT_PATH to override the chat endpoint (default: /api/chat/ask).
 *   Example: VITE_AI_CHAT_PATH=/api/ai/chat
 */

// Vite-safe env
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// Developer-provided local debug image path (will be transformed to URL in your environment)
const DEBUG_IMG = "/mnt/data/ca2ef488-5f17-4c14-8759-b95a4b441584.png";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function callApi(path, opts = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(opts.headers || {}),
  };

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (networkErr) {
    const err = new Error("Network error: " + (networkErr.message || networkErr));
    err.status = 0;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<non-text-response>");
    // try to parse json error
    try {
      const json = JSON.parse(text);
      const err = new Error(json?.message ? json.message : JSON.stringify(json));
      err.status = res.status;
      err.body = json;
      throw err;
    } catch {
      const err = new Error(text || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }
  }

  // attempt to parse json but handle non-json safely
  try {
    return await res.json();
  } catch {
    return { data: await res.text() };
  }
}

export default function FloatingAIChat({ parsedPreview = null, onOpenParser = null }) {
  const STORAGE_KEY = "ai_chat_v2";

  // UI state
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw
        ? JSON.parse(raw)
        : [
            {
              from: "ai",
              text: "Hello — I'm your AI assistant. Ask me to recommend jobs, summarize your resume or run a mock interview.",
            },
          ];
    } catch {
      return [
        {
          from: "ai",
          text: "Hello — I'm your AI assistant. Ask me to recommend jobs, summarize your resume or run a mock interview.",
        },
      ];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const bottomRef = useRef(null);

  // draggable position
  const [pos, setPos] = useState({ x: 20, y: 20 }); // distance from bottom-right
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const panelRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // speech synthesis
  function speakText(text) {
    if (!window.speechSynthesis) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) utter.voice = voices.find((v) => v.lang?.startsWith(navigator.language)) || voices[0];
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) {
      /* ignore */
    }
  }

  // speech recognition (voice input)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : "";
      setInput((prev) => (prev ? prev + " " + t : t));
    };
    r.onend = () => setRecognizing(false);
    r.onerror = () => setRecognizing(false);
    recognitionRef.current = r;
  }, []);

  function toggleRecognition() {
    const r = recognitionRef.current;
    if (!r) {
      setMessages((m) => [...m, { from: "ai", text: "Voice input not supported in this browser." }]);
      return;
    }
    if (recognizing) {
      r.stop();
      setRecognizing(false);
    } else {
      try {
        r.start();
        setRecognizing(true);
      } catch (e) {
        setRecognizing(false);
      }
    }
  }

  // helper to get parsed resume
  function getParsedResume() {
    if (parsedPreview) return parsedPreview;
    try {
      const raw = localStorage.getItem("lastParsedResume");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  async function sendMessage(text) {
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text, id: Date.now() }]);
    setInput("");
    setLoading(true);

    // optimistic typing bubble
    setMessages((m) => [...m, { from: "typing", text: "…" }]);

    try {
      const body = { message: text };
      const parsed = getParsedResume();
      if (parsed) {
        body.parsed = parsed;
        body.resume = parsed;
      }

      let reply = "No backend response (fallback).";

      // Allow overriding the chat path via env. Try the configured path first, then fallback to common alternatives.
      const configuredPath = import.meta.env.VITE_AI_CHAT_PATH || "/api/chat/ask";
      const altPath = configuredPath === "/api/chat/ask" ? "/api/ai/chat" : "/api/chat/ask";

      async function tryPath(path) {
        try {
          const res = await callApi(path, { method: "POST", body: JSON.stringify(body) });
          return res;
        } catch (e) {
          // rethrow so caller can inspect status/message
          throw e;
        }
      }

      try {
        // first try configured path
        const res = await tryPath(configuredPath);
        reply = res?.reply ?? res?.data?.reply ?? (typeof res === "string" ? res : reply);
      } catch (e) {
        const status = e?.status;
        const msg = (e?.message || "").toLowerCase();

        if (status === 404 || msg.includes("404")) {
          // try alternate common path
          try {
            const res2 = await tryPath(altPath);
            reply = res2?.reply ?? res2?.data?.reply ?? (typeof res2 === "string" ? res2 : reply);
          } catch (e2) {
            // both failed — give actionable guidance
            console.error("Both chat endpoints failed:", configuredPath, altPath, e2 || e);
            reply = `AI route not found (404). Tried ${configuredPath} and ${altPath}.\nMake sure your backend exposes one of these POST routes and the server is running.\n\nIf your backend's route is different, set VITE_AI_CHAT_PATH in your .env (for example: VITE_AI_CHAT_PATH=/api/ai/chat) and restart the frontend. Check the browser console for more details.`;
          }
        } else if (msg.includes("quota") || msg.includes("429") || msg.includes("insufficient_quota")) {
          reply =
            "AI service currently unavailable (quota). I can still help with built-in suggestions like: 'tips for resume', 'mock interview question', 'project ideas', 'job recommendations'. Try one of those.";
        } else if (status === 0) {
          // network error
          reply = "Network error contacting AI backend. Is the backend running and accessible at the configured VITE_API_BASE? Check the terminal running your server.";
        } else {
          console.error("AI backend error:", e);
          // try to surface useful server-side detail when available
          const details = e?.body ? `\nServer response: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}` : "";
          reply = `Sorry — AI backend error. ${details}\nTry again later or use the built-in buttons (Jobs, Mock Interview, Cover Letter).`;
        }
      }

      // remove typing bubble then add reply
      setMessages((m) => [...m.filter((x) => x.from !== "typing"), { from: "ai", text: reply, id: Date.now() }]);
      speakText(reply);

      if (/parse resume|analyz|summariz|cover letter|job match/i.test(text)) onOpenParser && onOpenParser();
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    sendMessage(t);
  }

  // fallback push helper
  function pushAiText(text) {
    setMessages((m) => [...m, { from: "ai", text }]);
  }

  // Feature: Recommend jobs (tries backend, falls back to local list)
  async function handleRecommendJobs() {
    setLoading(true);
    try {
      const parsed = getParsedResume();
      const res = await callApi("/api/ai/job-recommend", { method: "POST", body: JSON.stringify({ resume: parsed }) });
      if (res?.data) {
        if (Array.isArray(res.data)) {
          const list = res.data.map((it, i) => `${i + 1}. ${it.title} — ${it.reason || ""}`).join("\n");
          pushAiText(`Job recommendations:\n${list}`);
        } else if (typeof res.data === "string") {
          pushAiText(res.data);
        } else {
          pushAiText(JSON.stringify(res.data));
        }
      } else {
        pushAiText("No recommendations returned.");
      }
    } catch (e) {
      console.warn(e);
      // local fallback recommendations
      pushAiText(
        "Fallback jobs:\n1. Junior Data Analyst — Good for SQL/Python beginners\n2. Frontend Developer (React) — If you like UI work\n3. QA Engineer — Entry level testing roles\n4. Customer Success Associate — Good for communication-focused roles\n5. Technical Support Engineer — If you have troubleshooting skills"
      );
    } finally {
      setLoading(false);
    }
  }

  // Feature: Cover letter (backend, fallback message)
  async function handleCoverLetter() {
    const parsed = getParsedResume();
    if (!parsed) {
      pushAiText("No parsed resume found — upload and parse your resume first to generate a tailored cover letter.");
      return;
    }
    const jobTitle = window.prompt("Target job title:", "Data Analyst") || "Data Analyst";
    setLoading(true);
    try {
      const res = await callApi("/api/ai/cover-letter", { method: "POST", body: JSON.stringify({ resume: parsed, jobTitle }) });
      const letter = res?.data?.coverLetter || res?.data?.reply || "Cover letter generated.";
      pushAiText(letter);
    } catch (e) {
      console.warn(e);
      pushAiText("Failed to generate cover letter (backend). Try creating one manually or use the sample templates.");
    } finally {
      setLoading(false);
    }
  }

  // Feature: Mock interview (backend, fallback suggestion)
  async function handleMockInterview() {
    setLoading(true);
    try {
      const res = await callApi("/api/ai/mock-interview/start", { method: "POST", body: JSON.stringify({ resume: getParsedResume() }) });
      const { question, sessionId } = res?.data || {};
      if (question) {
        pushAiText(`Mock interview started. Q: ${question}`);
        if (sessionId) localStorage.setItem("mockInterviewSession", sessionId);
      } else {
        pushAiText(res?.data?.reply || "No mock interview question returned.");
      }
    } catch (e) {
      console.warn(e);
      pushAiText("Could not start mock interview (backend). Try asking: 'Give me a mock interview question for a junior data analyst'.");
    } finally {
      setLoading(false);
    }
  }

  // Dragging handlers
  function onDragStart(e) {
    dragRef.current.dragging = true;
    const clientX = (e && e.clientX) || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    const clientY = (e && e.clientY) || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    dragRef.current.startX = clientX;
    dragRef.current.startY = clientY;
    let rect = null;
    if (panelRef.current && typeof panelRef.current.getBoundingClientRect === "function") rect = panelRef.current.getBoundingClientRect();
    dragRef.current.startLeft = rect ? rect.left : 0;
    dragRef.current.startTop = rect ? rect.top : 0;
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove);
    document.addEventListener("touchend", onDragEnd);
  }
  function onDragMove(e) {
    if (!dragRef.current.dragging) return;
    const clientX = (e && e.clientX) || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    const clientY = (e && e.clientY) || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    const newLeft = dragRef.current.startLeft + dx;
    const newTop = dragRef.current.startTop + dy;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const right = Math.max(8, window.innerWidth - (newLeft + width));
    const bottom = Math.max(8, window.innerHeight - (newTop + height));
    setPos({ x: right, y: bottom });
  }
  function onDragEnd() {
    dragRef.current.dragging = false;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
  }

  function clearChat() {
    if (confirm("Clear chat history?")) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // styles (switch with dark mode)
  const theme = dark
    ? {
        panelBg: "#0b1220",
        messagesBg: "#071226",
        text: "#e6eef8",
        subText: "#9fb3d8",
        bubbleAi: "#0f172a",
        bubbleUser: "linear-gradient(135deg,#1d4ed8,#2563eb)",
      }
    : {
        panelBg: "#ffffff",
        messagesBg: "#f8fafc",
        text: "#0f172a",
        subText: "#64748b",
        bubbleAi: "#ffffff",
        bubbleUser: "linear-gradient(135deg,#2563eb,#1d4ed8)",
      };

  const panelStyle = {
    position: "fixed",
    right: pos.x,
    bottom: pos.y,
    width: 420,
    maxWidth: "94vw",
    height: "72vh",
    zIndex: 2147483647,
    borderRadius: 12,
    boxShadow: "0 30px 80px rgba(2,6,23,0.16)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: theme.panelBg,
    color: theme.text,
    transition: "box-shadow .2s ease, transform .12s ease",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "#eef2f6"}`,
    cursor: "grab",
  };

  const avatarStyle = { width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center", background: "#2563eb", color: "#fff", fontWeight: 800 };
  const messagesStyle = { flex: 1, padding: 14, overflowY: "auto", background: theme.messagesBg };
  const formStyle = { display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.03)" : "#eef2f6"}`, background: theme.panelBg };

  return (
    <div style={{ position: "fixed", right: pos.x, bottom: pos.y, zIndex: 2147483647 }}>
      {!open && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            title="Open AI"
            onClick={() => setOpen(true)}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              border: "none",
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              color: "#fff",
              boxShadow: "0 10px 30px rgba(37,99,235,0.25)",
              cursor: "pointer",
            }}
          >
            AI
          </button>
        </div>
      )}

      {open && (
        <div ref={panelRef} style={panelStyle} role="dialog" aria-label="AI assistant">
          <div style={headerStyle} onMouseDown={onDragStart} onTouchStart={onDragStart}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={avatarStyle}>AI</div>
              <div>
                <div style={{ fontWeight: 700 }}>AI Career Assistant</div>
                <div style={{ fontSize: 12, color: theme.subText }}>Resume parsing · Jobs · Mock interviews</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setDark((d) => !d)}
                style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: dark ? "#1f2937" : "#f1f5f9", color: dark ? "#fff" : "#0f172a" }}
              >
                {dark ? "Dark" : "Light"}
              </button>
              <button onClick={clearChat} title="Clear" style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#fff", color: "#0f172a" }}>
                Clear
              </button>
              <button onClick={() => setOpen(false)} title="Close" style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#ef4444", color: "#fff" }}>
                Close
              </button>
            </div>
          </div>

          <div style={messagesStyle}>
            {DEBUG_IMG && <img src={DEBUG_IMG} alt="debug" style={{ maxWidth: 220, borderRadius: 8, marginBottom: 12, opacity: 0.95 }} />}

            {messages.map((m, i) => (
              <div key={m.id ?? i} style={{ display: "flex", justifyContent: m.from === "ai" ? "flex-start" : "flex-end", marginBottom: 10, animation: "ai-msg-appear .18s ease" }}>
                <div
                  style={{
                    background: m.from === "ai" ? theme.bubbleAi : theme.bubbleUser,
                    color: m.from === "ai" ? theme.text : "#fff",
                    padding: "10px 12px",
                    borderRadius: 10,
                    maxWidth: "78%",
                    boxShadow: m.from === "ai" ? "0 2px 8px rgba(2,6,23,0.04)" : "0 6px 18px rgba(2,6,23,0.12)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} style={formStyle}>
            <button type="button" onClick={toggleRecognition} title="Voice input" style={{ width: 44, borderRadius: 8, border: "none", background: recognizing ? "#ef4444" : "#e6eefc", cursor: "pointer" }}>
              {recognizing ? "🎙" : "🎤"}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message — e.g. 'Recommend jobs for me'" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e6e6e6" }} />
            <button type="button" onClick={handleRecommendJobs} title="Recommend jobs" style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", cursor: "pointer" }}>
              Jobs
            </button>
            <button type="submit" disabled={!input || loading} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>
              {loading ? "..." : "Send"}
            </button>
          </form>

          <style>{`@keyframes ai-msg-appear { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}
