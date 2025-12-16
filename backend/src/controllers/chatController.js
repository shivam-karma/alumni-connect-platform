import axios from "axios";

export const askOllama = async (req, res) => {
  try {
    // Validate incoming message
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Request to Ollama
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3.1", // Change to any model you installed (llama2, mistral, etc.)
      prompt: message,
      stream: false,
    });

    // Handle missing or malformed responses
    if (!response.data || !response.data.response) {
      return res.status(500).json({
        error: "Invalid response from Ollama",
      });
    }

    // Success → Send reply back to frontend
    return res.json({
      reply: response.data.response,
    });
  } catch (error) {
    console.error("🔥 Ollama error:", error?.response?.data || error.message);

    return res.status(500).json({
      error: "Failed to get response from Ollama",
      details: error?.response?.data || error.message,
    });
  }
};
