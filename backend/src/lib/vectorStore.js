// backend/src/lib/vectorStore.js
import fs from "fs";
import path from "path";
import { cosineSim } from "./embeddings.js";

const DEFAULT_PATH = process.env.VECTOR_STORE_PATH || path.join(process.cwd(), "data", "vector-store.json");

class VectorStore {
  constructor(persistPath = DEFAULT_PATH) {
    this.map = new Map(); // key -> { id, type, vector, meta }
    this.persistPath = persistPath;
    try {
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, "utf8");
        const arr = JSON.parse(raw);
        for (const it of arr) {
          this.map.set(String(it.key || `${it.type}:${it.id}`), { id: it.id, type: it.type, vector: it.vector, meta: it.meta });
        }
      } else {
        // Ensure dir
        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn("vector-store load failed:", e?.message || e);
    }
  }

  keyFor(item) {
    return String(item.key || `${item.type}:${item.id}`);
  }

  index(item) {
    // item: { id, type, vector, meta, key? }
    const k = this.keyFor(item);
    this.map.set(k, { id: item.id, type: item.type, vector: item.vector, meta: item.meta || {} });
  }

  bulkIndex(items = []) {
    for (const it of items) this.index(it);
  }

  searchByVector(queryVector, { topK = 10, filterType = null } = {}) {
    const arr = [];
    for (const [k, v] of this.map.entries()) {
      if (filterType && v.type !== filterType) continue;
      const score = cosineSim(queryVector, v.vector);
      arr.push({ key: k, id: v.id, type: v.type, meta: v.meta, score });
    }
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, topK);
  }

  saveToDisk() {
    try {
      const arr = [];
      for (const [k, v] of this.map.entries()) {
        arr.push({ key: k, id: v.id, type: v.type, vector: v.vector, meta: v.meta });
      }
      fs.writeFileSync(this.persistPath, JSON.stringify(arr, null, 2), "utf8");
    } catch (e) {
      console.warn("vector-store save failed:", e?.message || e);
    }
  }

  clear() {
    this.map.clear();
    try { if (fs.existsSync(this.persistPath)) fs.unlinkSync(this.persistPath); } catch (e) {}
  }
}

const STORE = new VectorStore();
export default STORE;
export { VectorStore };
