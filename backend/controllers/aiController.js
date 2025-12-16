// backend/src/controllers/aiController.js
import axios from "axios";

/**
 * POST /api/chat/ask
 * Body: { message: string, parsed?: object }
 *
 * This handler tries a few local Ollama endpoints (127.0.0.1, localhost, ::1)
 * because some environments bind only to IPv4 (127.0.0.1) and others may use IPv6 (::1).
 */
export async function chatWithAI(req, res) {
  try {
    const { message, parsed } = req.body ?? {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Missing or empty 'message' in request body" });
    }

    // Build prompt (you can customize how parsed resume or other metadata is injected)
    const prompt = typeof parsed === "object" && parsed !== null
      ? `Resume data: ${JSON.stringify(parsed)}\n\nUser: ${message}`
      : message;

    const payload = {
      model: "llama3.1",
      prompt,
      stream: false
    };

    // Try endpoints in a prioritized order to avoid IPv6/IPv4 bind problems
    const endpoints = [
      "http://127.0.0.1:11434/api/generate", // prefer IPv4 loopback
      "http://localhost:11434/api/generate",
      "http://[::1]:11434/api/generate" // explicit IPv6
    ];

    let lastErr = null;

    for (const url of endpoints) {
      try {
        const resp = await axios.post(url, payload, { timeout: 10000 });
        // Ollama's JSON shape can vary by version; adjust if your instance returns differently
        // Common shapes: { response: "text" } or { text: "...", ... }
        const data = resp?.data ?? {};
        const reply =
          data.response ??
          data.text ??
          data.output?.[0]?.content ??
          (typeof data === "string" ? data : null);

        if (reply) {
          return res.json({ reply, raw: data });
        }

        // If we get a 200 but no usable text, return the whole body as fallback
        return res.json({ reply: JSON.stringify(data), raw: data });
      } catch (err) {
        lastErr = err;
        // continue to next endpoint
      }
    }

    // If none of the endpoints worked, return helpful error details
    const details = lastErr ? (lastErr.message || String(lastErr)) : "No response";
    console.error("Ollama connection failed:", details);

    return res.status(500).json({
      error: "Failed to get response from Ollama",
      details,
      hint: "Could not connect to Ollama at http://localhost:11434 or 127.0.0.1:11434. Is Ollama running? Try: 'ollama status', ensure the daemon is running, and that Ollama listens on localhost. If Ollama is on another host/port, update the endpoint in aiController.js."
    });
  } catch (error) {
    console.error("chatWithAI unexpected error:", error);
    return res.status(500).json({ error: "Internal server error", details: String(error) });
  }
}

// optional alias if you used askOllama name earlier
export const askOllama = chatWithAI;
