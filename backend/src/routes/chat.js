// backend/src/routes/ai.js (top of file)
import express from "express";
import { chatWithAI } from "../controllers/aiController.js";
const router = express.Router();

// register route
router.post("/chat/ask", chatWithAI);

// other ai routes...
export default router;
