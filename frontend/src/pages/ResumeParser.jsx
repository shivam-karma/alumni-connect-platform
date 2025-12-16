// frontend/src/pages/ResumeParser.jsx
import React, { useState } from "react";

/**
 * Tiny ResumeParser placeholder that is always visible in Profile
 * - default dev file path is the history-uploaded image (developer-provided)
 * - calls POST /api/resume/parse with { url }
 * - stores parsed result to localStorage.lastParsedResume on success
 * - calls onAutofillSuccess(updatedUser, parsed) if provided
 */

const DEV_LOCAL_PATH = "/mnt/data/ca2ef488-5f17-4c14-8759-b95a4b441584.png"; // developer history path (dev only)

async function callApi(path, opts = {}) {
  const base = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text().catch(() => "");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const bodyMsg = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
    const err = new Error(bodyMsg);
    err.status = res.status;
    err.body = json ?? text;
    throw err;
  }
  // return parsed JSON or raw text fallback
  return json ?? {};
}

export default function ResumeParser({ onAutofillSuccess = null }) {
  const [url, setUrl] = useState(DEV_LOCAL_PATH);
  const [status, setStatus] = useState("idle"); // 'idle' | 'parsing' | 'done' | 'error'
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);

  async function handleParse() {
    setStatus("parsing");
    setError(null);

    try {
      const res = await callApi("/api/resume/parse", {
        method: "POST",
        body: JSON.stringify({ url }),
      });

      // Backend response shapes vary. Try several common locations:
      let p = null;
      if (res && typeof res === "object") {
        if (res.parsed) p = res.parsed;
        else if (res.data && res.data.parsed) p = res.data.parsed;
        else if (res.data && (res.data.name || res.data.skills)) p = res.data;
        else if (res.name || res.skills || res.education) p = res;
        else if (res.result && (res.result.name || res.result.skills)) p = res.result;
      }

      // Fallback: if nothing found but res contains keys, try to use res itself
      if (!p && res && Object.keys(res).length) {
        p = res;
      }

      if (!p) {
        throw new Error("No parsed data returned from server");
      }

      setParsed(p);
      setStatus("done");

      // persist so other components (FloatingAIChat, Profile) can read it
      try {
        localStorage.setItem("lastParsedResume", JSON.stringify(p));
      } catch (e) {
        // ignore localStorage errors
      }

      // call autofill callback if provided
      if (typeof onAutofillSuccess === "function") {
        const updatedUser = {
          name: p.name || p.fullName || "Candidate",
          email: p.email || "",
          skills: p.skills || p.skillsList || [],
        };
        try {
          onAutofillSuccess(updatedUser, p);
        } catch (cbErr) {
          console.warn("onAutofillSuccess callback threw:", cbErr);
        }
      }
    } catch (err) {
      console.error("ResumeParser error:", err);
      setError(String(err?.message || err));
      setStatus("error");
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Resume Parser (dev)</h2>

      <div className="mb-2 text-sm text-gray-600">
        Parse a local resume file (development helper). Default file is the dev history file.
      </div>

      <div className="flex gap-2 items-center mb-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input"
          placeholder="Path or URL to resume (pdf or image)"
        />
        <button
          onClick={handleParse}
          className="btn btn-primary"
          disabled={status === "parsing"}
        >
          {status === "parsing" ? "Parsing…" : "Parse Resume"}
        </button>
      </div>

      {status === "done" && parsed && (
        <div className="mt-3 text-sm">
          <div><b>Name:</b> {parsed.name || parsed.fullName || "-"}</div>
          <div><b>Skills:</b> {Array.isArray(parsed.skills) ? parsed.skills.join(", ") : (parsed.skills || "-")}</div>
          <div><b>Education:</b> {Array.isArray(parsed.education) ? parsed.education.join(", ") : (parsed.education || "-")}</div>
          {parsed.rawText && (
            <div className="mt-2">
              <b>Raw (truncated):</b>
              <pre style={{ maxHeight: 120, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {(parsed.rawText || "").slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 text-sm text-red-600">Error: {error}</div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        After successful parse the parsed JSON is stored in <code>localStorage.lastParsedResume</code>.
      </div>
    </div>
  );
}
