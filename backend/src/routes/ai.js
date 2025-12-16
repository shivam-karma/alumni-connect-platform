// backend/src/controllers/aiController.js
import axios from "axios";

/**
 * chatWithAI - Express handler to proxy chat requests to a local Ollama server.
 * Expects body: { message: string, model?: string }
 *
 * Successful response shape:
 *  { ok: true, reply: "<text>", data: { raw: <ollama-response> } }
 *
 * Error response shape:
 *  { ok: false, error: "<short message>", details: "<low-level>", hint: "<how to fix>" }
 */
export async function chatWithAI(req, res) {
  try {
    const { message, model } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'message' in request body." });
    }

    // Host/URL config (allow either OLLAMA_HOST or OLLAMA_URL)
    const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const OLLAMA_GENERATE_PATH = `${OLLAMA_HOST.replace(/\/$/, "")}/api/generate`;
    const chosenModel = model || process.env.OLLAMA_MODEL || "llama3.1";

    // timeout (ms)
    const timeoutMs = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || 15000);

    // Build payload expected by Ollama (non-streaming)
    const payload = {
      model: chosenModel,
      prompt: message,
      stream: false,
    };

    let resp;
    try {
      resp = await axios.post(OLLAMA_GENERATE_PATH, payload, { timeout: timeoutMs });
    } catch (err) {
      // network-level errors (ECONNREFUSED, ETIMEDOUT, etc.)
      const code = err?.code || "";
      const status = err?.response?.status;
      const body = err?.response?.data;

      if (code === "ECONNREFUSED" || (err.message && err.message.includes("ECONNREFUSED"))) {
        const hint = `Could not connect to Ollama at ${OLLAMA_HOST}. Is Ollama running? Try: 'ollama serve' and ensure it binds to the configured address/port.`;
        console.error("Ollama connection refused:", err.message || err);
        return res.status(500).json({
          ok: false,
          error: "Failed to get response from Ollama",
          details: String(err.message || err),
          hint,
        });
      }

      if (err.code === "ECONNABORTED" || (err.message && err.message.includes("timeout"))) {
        const hint = `Request to Ollama timed out at ${OLLAMA_GENERATE_PATH}. You can increase OLLAMA_REQUEST_TIMEOUT_MS env var (ms).`;
        console.error("Ollama request timed out:", err.message || err);
        return res.status(504).json({
          ok: false,
          error: "Timeout calling Ollama",
          details: String(err.message || err),
          hint,
        });
      }

      // Ollama returned an HTTP error
      if (status) {
        console.error("Ollama HTTP error:", status, body);
        return res.status(502).json({
          ok: false,
          error: "Ollama HTTP error",
          status,
          details: body ?? String(err.message || err),
          hint: `Check Ollama logs or visit ${OLLAMA_HOST} to verify the model and server status.`,
        });
      }

      // Generic network error fallback
      console.error("Network error calling Ollama:", err);
      return res.status(500).json({
        ok: false,
        error: "Failed to call Ollama",
        details: String(err.message || err),
        hint: `Ensure Ollama is running and reachable at ${OLLAMA_HOST}`,
      });
    }

    // Extract text reply from common response shapes
    const raw = resp.data;
    let reply = "";

    try {
      // Common simple shapes
      if (typeof raw === "string") {
        reply = raw;
      } else if (raw && typeof raw.response === "string") {
        reply = raw.response;
      } else if (raw && typeof raw.output === "string") {
        reply = raw.output;
      } else if (raw && Array.isArray(raw.output) && raw.output.length > 0) {
        // output array might contain objects with `.content` (string or array)
        const out0 = raw.output[0];
        if (typeof out0 === "string") {
          reply = out0;
        } else if (out0 && typeof out0.content === "string") {
          reply = out0.content;
        } else if (out0 && Array.isArray(out0.content)) {
          // e.g. [{ type: "message", text: "..." }, ...] or [{ text: "..." }]
          reply = out0.content.map((c) => {
            if (!c) return "";
            if (typeof c === "string") return c;
            return (c.text ?? c.message ?? "").toString();
          }).join(" ").trim();
        }
      } else if (raw && raw.choices && Array.isArray(raw.choices) && raw.choices[0]) {
        // compatibility with several LLM shapes
        const ch0 = raw.choices[0];
        if (ch0.message && typeof ch0.message.content === "string") {
          reply = ch0.message.content;
        } else if (typeof ch0.text === "string") {
          reply = ch0.text;
        }
      } else if (raw && raw.result && typeof raw.result === "string") {
        reply = raw.result;
      } else {
        // last resort: stringify a short excerpt
        try {
          reply = JSON.stringify(raw);
        } catch (e) {
          reply = String(raw);
        }
      }

      reply = String(reply || "").trim();
    } catch (parseErr) {
      console.warn("Error extracting reply from Ollama response:", parseErr, "raw:", raw);
      reply = "";
    }

    if (!reply) {
      console.warn("Ollama returned no usable text. Raw response:", raw);
      return res.status(502).json({
        ok: false,
        error: "No text reply from Ollama",
        data: { raw },
        hint: "Check the Ollama model response shape or server logs.",
      });
    }

    // Return shape compatible with frontend expectations
    return res.json({
      ok: true,
      reply,
      data: { reply, raw },
    });
  } catch (err) {
    console.error("chatWithAI unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error in AI proxy",
      details: String(err?.message || err),
    });
  }
}

// Optional additional handlers you can implement later
export async function jobRecommend(req, res) {
  // simple placeholder implementation (frontend has fallbacks too)
  return res.json({
    ok: true,
    data: [
      { title: "Junior Data Analyst", reason: "SQL/Python basics", seniority: "Entry" },
      { title: "Frontend Developer (React)", reason: "JS/React interest", seniority: "Entry" },
      { title: "QA Engineer", reason: "Attention to detail", seniority: "Entry" },
    ],
  });
}

export default { chatWithAI, jobRecommend };
