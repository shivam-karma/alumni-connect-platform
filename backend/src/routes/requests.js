// backend/src/routes/requests.js
import { Router } from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js";

const router = Router();

// Optional standalone Request model support (try to import)
let RequestModel = null;
try {
  // dynamic import so file still works if Request model doesn't exist
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  RequestModel = (await import("../models/Request.js")).default;
} catch (e) {
  RequestModel = null;
}

function toObjectIdIfValid(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === "string" && mongoose.isValidObjectId(id)) return new mongoose.Types.ObjectId(String(id));
  return null;
}

function emitToUser(req, userId, event, payload) {
  try {
    const io = req.app?.locals?.io;
    const activeUsers = req.app?.locals?.activeUsers;
    if (!io) return;
    if (activeUsers && typeof activeUsers.get === "function") {
      const sid = activeUsers.get(String(userId));
      if (sid) {
        io.to(sid).emit(event, payload);
        return;
      }
    }
    io.to(`user:${String(userId)}`).emit(event, payload);
  } catch (e) {
    console.warn("emitToUser failed:", e);
  }
}

/**
 * POST /api/requests
 * body: { toUserId, message? }
 */
router.post("/", authRequired, async (req, res) => {
  try {
    const fromId = toObjectIdIfValid(req.userId);
    const { toUserId, message = "" } = req.body || {};
    const toId = toObjectIdIfValid(toUserId);

    console.log("POST /api/requests - from:", String(fromId), "to:", String(toId), "message:", message?.slice(0,120));

    if (!toId) return res.status(400).json({ message: "toUserId required" });
    if (String(fromId) === String(toId)) return res.status(400).json({ message: "Cannot send request to yourself" });

    const toUser = await User.findById(toId).lean();
    if (!toUser) {
      console.warn("Recipient not found", String(toId));
      return res.status(404).json({ message: "Recipient not found" });
    }

    // If we have a RequestModel (separate collection), use it
    if (RequestModel) {
      const doc = await RequestModel.create({
        from: fromId,
        to: toId,
        message: String(message || ""),
        status: "pending",
        createdAt: new Date()
      });
      const populated = await RequestModel.findById(doc._id)
        .populate("from", "name email title company")
        .populate("to", "name email title company")
        .lean();

      emitToUser(req, toId, "connection:request", { request: populated });
      return res.status(201).json({ request: populated });
    }

    // Embedded request: create object and push into recipient.connectionRequests
    const requestObj = {
      _id: new mongoose.Types.ObjectId(),
      from: fromId,
      message: String(message || ""),
      status: "pending",
      createdAt: new Date()
    };

    // Avoid duplicate pending requests: allow re-sending after rejection or if last is not pending.
    const existingPending = (toUser.connectionRequests || []).some(r =>
      String(r.from || r.requester || "") === String(fromId) && String(r.status) === "pending"
    );
    if (existingPending) {
      console.log("Duplicate pending request exists - rejecting creation");
      return res.status(409).json({ message: "Duplicate pending request already exists" });
    }

    // push into recipient doc
    const update = await User.updateOne({ _id: toId }, { $push: { connectionRequests: requestObj } });
    if (update.modifiedCount === 0 && update.nModified === 0) {
      // older mongoose versions may use nModified
      // still keep going and read back
      console.warn("User.updateOne did not modify (update result):", update);
    }

    // read back the recipient and find the inserted request
    const freshRecipient = await User.findById(toId).lean();
    const inserted = (freshRecipient.connectionRequests || []).find(r => String(r._id) === String(requestObj._id)) || requestObj;

    // populate 'from' fields for the response
    const requester = await User.findById(fromId).lean();
    const resp = {
      ...inserted,
      from: {
        id: requester?._id?.toString?.() || String(fromId),
        name: requester?.name || "",
        email: requester?.email || "",
        title: requester?.title || "",
        company: requester?.company || ""
      },
      to: {
        id: freshRecipient?._id?.toString?.(),
        name: freshRecipient?.name || "",
        email: freshRecipient?.email || ""
      }
    };

    // emit socket notification
    emitToUser(req, toId, "connection:request", { request: resp });

    console.log("Request created (embedded) id:", String(requestObj._id));
    return res.status(201).json({ request: resp });
  } catch (err) {
    console.error("POST /api/requests error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/requests?box=inbox|outgoing|all
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const uid = toObjectIdIfValid(req.userId);
    const box = (req.query.box || "inbox").toLowerCase();

    console.log("GET /api/requests - user:", String(uid), "box:", box);

    if (RequestModel) {
      let filter = {};
      if (box === "inbox") filter = { to: uid };
      else if (box === "outgoing") filter = { from: uid };
      else filter = { $or: [{ to: uid }, { from: uid }] };

      const items = await RequestModel.find(filter)
        .sort({ createdAt: -1 })
        .populate("from", "name email title company")
        .populate("to", "name email title company")
        .lean();

      return res.json({ requests: items, total: items.length });
    }

    if (box === "inbox") {
      const me = await User.findById(uid, { connectionRequests: 1 }).lean();
      const reqs = (me?.connectionRequests || []).slice().reverse();
      // populate from users
      const fromIds = [...new Set(reqs.map(r => String(r.from || r.requester || "")).filter(Boolean))];
      const users = await User.find({ _id: { $in: fromIds } }, "name email title company").lean();
      const map = new Map(users.map(u => [String(u._id), u]));
      const populated = reqs.map(r => ({
        ...r,
        from: map.get(String(r.from || r.requester)) || { id: String(r.from || r.requester), name: "" },
        to: { id: String(uid) }
      }));
      return res.json({ requests: populated, total: populated.length });
    }

    if (box === "outgoing") {
      const docs = await User.find({ "connectionRequests.from": uid }, { connectionRequests: 1, name: 1, email: 1 }).lean();
      let outs = [];
      for (const d of docs) {
        const matches = (d.connectionRequests || []).filter(r => String(r.from) === String(uid));
        for (const m of matches) {
          outs.push({
            ...m,
            from: { id: String(uid) },
            to: { id: String(d._id), name: d.name, email: d.email }
          });
        }
      }
      outs = outs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ requests: outs, total: outs.length });
    }

    // box === "all"
    const me = await User.findById(uid, { connectionRequests: 1 }).lean();
    const inbox = (me?.connectionRequests || []).map(r => ({ ...r, to: { id: String(uid) } }));
    const sentDocs = await User.find({ "connectionRequests.from": uid }, { connectionRequests: 1, name: 1, email: 1 }).lean();
    let outgoing = [];
    for (const d of sentDocs) {
      const matches = (d.connectionRequests || []).filter(r => String(r.from) === String(uid));
      for (const m of matches) outgoing.push({ ...m, to: { id: String(d._id), name: d.name, email: d.email } });
    }
    const all = [...inbox, ...outgoing].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ requests: all, total: all.length });
  } catch (err) {
    console.error("GET /api/requests error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
