// backend/src/controllers/aiController.js
import axios from "axios";

/**
 * chatWithAI - Express handler to proxy chat requests to a local Ollama server.
 * Expects body: { message: string, model?: string }
 *
 * Env:
 *  - OLLAMA_HOST (default: http://127.0.0.1:11434)
 *  - OLLAMA_MODEL (default: llama3.1)
 *  - OLLAMA_REQUEST_TIMEOUT_MS (default: 30000)
 */
export async function chatWithAI(req, res) {
  try {
    const { message, model } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'message' in request body." });
    }

    // Prefer IPv4 address to avoid IPv6 (::1) resolution issues
    const host = process.env.OLLAMA_HOST || process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    // ensure host has protocol
    const normalizedHost = host.startsWith("http") ? host : `http://${host}`;
    const generatePath = `${normalizedHost.replace(/\/$/, "")}/api/generate`;

    const chosenModel = model || process.env.OLLAMA_MODEL || "llama3.1";
    const timeoutMs = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || 30000);

    const payload = {
      model: chosenModel,
      prompt: message,
      stream: false,
    };

    const client = axios.create({
      baseURL: normalizedHost,
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    let resp;
    try {
      resp = await client.post("/api/generate", payload);
    } catch (err) {
      // Network / timeout / connection refused handling
      const code = err?.code || "";
      const status = err?.response?.status;
      const body = err?.response?.data;

      // Timeout
      if (err?.message && err.message.toLowerCase().includes("timeout")) {
        const hint = `Request to Ollama timed out at ${normalizedHost}/api/generate. Increase timeout by setting OLLAMA_REQUEST_TIMEOUT_MS (ms).`;
        console.error("Ollama timeout:", err.message);
        return res.status(504).json({
          ok: false,
          error: "Timeout calling Ollama",
          details: String(err.message),
          hint,
        });
      }

      // Connection refused (no server listening)
      if (code === "ECONNREFUSED" || (err.message && err.message.includes("ECONNREFUSED"))) {
        const hint = `Could not connect to Ollama at ${normalizedHost}. Is Ollama running? Try: 'netstat -ano | findstr :11434' and restart the Ollama process.`;
        console.error("Ollama connection refused:", err.message || err);
        return res.status(502).json({
          ok: false,
          error: "Failed to get response from Ollama",
          details: String(err.message || err),
          hint,
        });
      }

      // Ollama returned HTTP error (4xx/5xx)
      if (status) {
        console.error("Ollama HTTP error:", status, body);
        return res.status(502).json({
          ok: false,
          error: "Ollama HTTP error",
          status,
          details: body ?? String(err.message || err),
          hint: `Check Ollama logs and ensure the model "${chosenModel}" is available.`,
        });
      }

      // Generic network error
      console.error("Network error calling Ollama:", err);
      return res.status(502).json({
        ok: false,
        error: "Failed to call Ollama",
        details: String(err.message || err),
        hint: `Ensure Ollama is running and reachable at ${normalizedHost}`,
      });
    }

    // Try to extract text from common response shapes
    const raw = resp?.data;
    let reply = "";

    try {
      if (typeof raw === "string") {
        reply = raw;
      } else if (raw && typeof raw.response === "string") {
        reply = raw.response;
      } else if (raw && typeof raw.output === "string") {
        reply = raw.output;
      } else if (raw && Array.isArray(raw.output) && raw.output[0]) {
        // output[0] may have `content` which can be string or array of chunks
        const o0 = raw.output[0];
        if (typeof o0.content === "string") {
          reply = o0.content;
        } else if (Array.isArray(o0.content)) {
          // content array items may be objects with text fields or strings
          reply = o0.content.map((c) => (c && (c.text || c.content || c)).toString()).join(" ");
        } else {
          reply = JSON.stringify(o0).slice(0, 2000);
        }
      } else if (raw && Array.isArray(raw.choices) && raw.choices[0]) {
        // choices[0].message.content or choices[0].text
        reply = raw.choices[0].message?.content ?? raw.choices[0].text ?? "";
      } else if (raw && raw.result && typeof raw.result === "string") {
        reply = raw.result;
      } else {
        // last resort
        reply = JSON.stringify(raw).slice(0, 2000);
      }
    } catch (parseErr) {
      console.warn("Error parsing Ollama response shape:", parseErr);
      reply = JSON.stringify(raw).slice(0, 2000);
    }

    reply = String(reply || "").trim();

    if (!reply) {
      console.warn("Ollama returned no text reply. Raw:", raw);
      return res.status(502).json({
        ok: false,
        error: "No text reply from Ollama",
        data: { raw },
        hint: "Check the Ollama model response shape or server logs.",
      });
    }

    // Return consistent shape (frontend supports res.reply or res.data.reply)
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

export default { chatWithAI };
