// backend/scripts/index-existing.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import News from "../models/News.js";
import { generateEmbedding } from "../lib/embeddings.js";
import STORE from "../lib/vectorStore.js";

async function run() {
  await connectDB(process.env.MONGODB_URI);
  console.log("Connected DB");

  // index users
  const users = await User.find({}).lean().limit(1000);
  console.log("Users:", users.length);
  for (const u of users) {
    const text = [u.name, u.title, (u.skills||[]).join(", "), u.bio || "", u.company || ""].filter(Boolean).join(" • ");
    const v = await generateEmbedding(text);
    STORE.index({ id: String(u._id), type: "user", vector: v, meta: { name: u.name } });
  }

  // jobs
  try {
    const jobs = await Job.find({}).lean().limit(2000);
    for (const j of jobs) {
      const text = [j.title, j.description, (j.skills||[]).join(", "), j.company || ""].filter(Boolean).join(" • ");
      const v = await generateEmbedding(text);
      STORE.index({ id: String(j._id), type: "job", vector: v, meta: { title: j.title, company: j.company } });
    }
  } catch (e) {}

  // news
  try {
    const news = await News.find({}).lean().limit(2000);
    for (const n of news) {
      const text = [n.title, n.summary || "", n.body || "", (n.tags || []).join(", ")].filter(Boolean).join(" • ");
      const v = await generateEmbedding(text);
      STORE.index({ id: String(n._id), type: "news", vector: v, meta: { title: n.title } });
    }
  } catch (e) {}

  STORE.saveToDisk();
  console.log("Indexing done. store saved.");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
