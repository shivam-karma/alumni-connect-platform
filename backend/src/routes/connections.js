// backend/src/routes/connections.js
import express from "express";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js"; // optional — used if present

const router = express.Router();

/**
 * In-memory fallback store for connection requests (dev only).
 * Stored as array of { id, from, to, message, status, createdAt }.
 * If you have a real model, replace logic with DB queries.
 */
function getStore(req) {
  if (!req.app.locals.connectionRequests) req.app.locals.connectionRequests = [];
  return req.app.locals.connectionRequests;
}

// Helper to gen simple id
function genId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/**
 * Utility: fetch requests for a user and optional box ('incoming'|'outgoing')
 * Returns populated requests (attempts to populate from/to with basic user info if User model exists)
 *
 * By default this returns only pending requests. Set includeResolved=true to get accepted/rejected too.
 */
async function listRequestsForUser(req, box = "incoming", includeResolved = false) {
  const userId = req.userId;
  const store = getStore(req);

  let requests = store.filter(r => {
    if (box === "incoming") return String(r.to) === String(userId);
    if (box === "outgoing") return String(r.from) === String(userId);
    return false;
  });

  // By default only return pending requests (so accepted/rejected disappear from the UI)
  if (!includeResolved) {
    requests = requests.filter(r => r.status === "pending");
  }

  // Optionally populate small user info if User model exists
  let populated = requests;
  try {
    if (User && User.find) {
      populated = await Promise.all(requests.map(async r => {
        const from = await User.findById(r.from).lean().catch(()=>null);
        const to = await User.findById(r.to).lean().catch(()=>null);
        return {
          ...r,
          from: from ? { _id: from._id, name: from.name, email: from.email } : r.from,
          to: to ? { _id: to._id, name: to.name, email: to.email } : r.to
        };
      }));
    }
  } catch (e) {
    // ignore population errors
  }

  return populated;
}

/**
 * POST /api/connections/request
 * body: { toId, message }
 */
router.post("/request", authRequired, async (req, res) => {
  try {
    const fromId = req.userId;
    const { toId, message } = req.body;
    if (!toId) return res.status(400).json({ message: "toId is required" });
    if (String(toId) === String(fromId)) return res.status(400).json({ message: "Cannot send request to yourself" });

    // Basic dedupe: check existing pending request from->to
    const store = getStore(req);
    const existing = store.find(r => String(r.from) === String(fromId) && String(r.to) === String(toId) && r.status === "pending");
    if (existing) return res.status(400).json({ message: "Request already pending" });

    const reqObj = {
      id: genId(),
      _id: genId(),
      from: fromId,
      to: toId,
      message: message || "",
      status: "pending",
      createdAt: new Date().toISOString()
    };

    store.push(reqObj);

    // If you have a User model, optionally add to a requests array field (non-critical)
    try {
      if (User && User.updateOne) {
        await User.updateOne({ _id: toId }, { $push: { incomingRequests: reqObj } }).catch(()=>{});
        await User.updateOne({ _id: fromId }, { $push: { outgoingRequests: reqObj } }).catch(()=>{});
      }
    } catch(e) { /* ignore */ }

    return res.status(201).json({ request: reqObj });
  } catch (err) {
    console.error("POST /api/connections/request error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * NEW — GET /api/connections/incoming
 * Return incoming PENDING requests for the authenticated user.
 * Mirrors GET / with box=incoming and supports frontend call.
 * Optional query: includeResolved=1 to include accepted/rejected.
 */
router.get("/incoming", authRequired, async (req, res) => {
  try {
    const includeResolved = String(req.query.includeResolved || "") === "1";
    const populated = await listRequestsForUser(req, "incoming", includeResolved);
    return res.json({ requests: populated });
  } catch (err) {
    console.error("GET /api/connections/incoming error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/connections
 * query: box=incoming|outgoing (defaults to incoming)
 * optional query: includeResolved=1
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const box = (req.query.box || "incoming").toString();
    const includeResolved = String(req.query.includeResolved || "") === "1";
    const populated = await listRequestsForUser(req, box, includeResolved);
    res.json({ requests: populated });
  } catch (err) {
    console.error("GET /api/connections error", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/connections/:id/accept
 */
router.post("/:id/accept", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.userId;
    const store = getStore(req);
    const idx = store.findIndex(r => (r.id === id || r._id === id));
    if (idx === -1) return res.status(404).json({ message: "Request not found" });
    const reqObj = store[idx];
    if (String(reqObj.to) !== String(userId)) return res.status(403).json({ message: "Not allowed" });

    reqObj.status = "accepted";
    reqObj.acceptedAt = new Date().toISOString();

    // Optionally add connection to users if model present
    try {
      if (User && User.updateOne) {
        await User.updateOne({ _id: reqObj.from }, { $addToSet: { connectionsList: reqObj.to } }).catch(()=>{});
        await User.updateOne({ _id: reqObj.to }, { $addToSet: { connectionsList: reqObj.from } }).catch(()=>{});
      }
    } catch(e){}

    return res.json({ ok: true, request: reqObj });
  } catch (err) {
    console.error("POST /api/connections/:id/accept error", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/connections/:id/reject
 */
router.post("/:id/reject", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.userId;
    const store = getStore(req);
    const idx = store.findIndex(r => (r.id === id || r._id === id));
    if (idx === -1) return res.status(404).json({ message: "Request not found" });
    const reqObj = store[idx];
    if (String(reqObj.to) !== String(userId)) return res.status(403).json({ message: "Not allowed" });

    reqObj.status = "rejected";
    reqObj.rejectedAt = new Date().toISOString();

    return res.json({ ok: true, request: reqObj });
  } catch (err) {
    console.error("POST /api/connections/:id/reject error", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
