// backend/src/routes/messages.js
import { Router } from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import User from "../models/User.js"; // adjust import if your User model path differs
const router = Router();

/**
 * Messaging routes.
 *
 * POST  /api/messages/send
 * GET   /api/messages?box=inbox|outgoing
 * GET   /api/messages/with/:userId
 * POST  /api/messages/conversations
 * GET   /api/messages/conversations/:id
 * POST  /api/messages/conversations/:id/read-all
 */

// --- Models (define if not present) ---
let Conversation, Message;

try {
  Conversation = mongoose.model("Conversation");
} catch (e) {
  const ConversationSchema = new mongoose.Schema(
    {
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
      lastMessage: {
        text: String,
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: Date,
      },
      meta: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
  );
  Conversation = mongoose.model("Conversation", ConversationSchema);
}

try {
  Message = mongoose.model("Message");
} catch (e) {
  const MessageSchema = new mongoose.Schema(
    {
      conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
      from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      text: { type: String, default: "" },
      attachments: [
        {
          url: String,
          filename: String,
          mime: String,
          size: Number,
        },
      ],
      read: { type: Boolean, default: false },
    },
    { timestamps: true }
  );
  Message = mongoose.model("Message", MessageSchema);
}

// ----- helpers -----
function toObjectIdIfValid(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === "string" && mongoose.isValidObjectId(id)) {
    return new mongoose.Types.ObjectId(String(id));
  }
  return null;
}

function emitToRecipient(req, toUserId, event, payload) {
  try {
    const io = req.app?.locals?.io;
    const activeUsers = req.app?.locals?.activeUsers;
    if (!io) return;
    if (activeUsers && typeof activeUsers.get === "function") {
      const sid = activeUsers.get(String(toUserId));
      if (sid) {
        io.to(sid).emit(event, payload);
        return;
      }
    }
    // fallback: emit to user room name if clients join that room
    io.to(`user:${String(toUserId)}`).emit(event, payload);
  } catch (e) {
    console.warn("emitToRecipient failed:", e);
  }
}

// Small utility to ensure DB connected (returns true if probably connected)
function isMongooseConnected() {
  try {
    // readyState: 1 = connected
    return mongoose?.connection?.readyState === 1;
  } catch (e) {
    return false;
  }
}

// ===== POST /send =====
router.post("/send", authRequired, async (req, res) => {
  try {
    console.log("POST /api/messages/send - hit");
    console.log("Mongoose readyState:", mongoose?.connection?.readyState);
    console.log("req.userId:", req.userId);

    if (!isMongooseConnected()) {
      console.error("Mongoose not connected (readyState !== 1)");
      return res.status(500).json({ message: "Database not connected" });
    }

    const fromId = req.userId;
    if (!fromId) return res.status(401).json({ message: "Not authenticated (missing user id)" });

    const { conversationId, toUserId, text = "", attachments = [] } = req.body ?? {};

    if (!toUserId && !conversationId) {
      return res.status(400).json({ message: "toUserId or conversationId required" });
    }

    // validate and convert ids
    const fromOid = toObjectIdIfValid(fromId);
    if (!fromOid) return res.status(400).json({ message: "Invalid authenticated user id" });

    let toUserObjId = toObjectIdIfValid(toUserId);
    if (toUserId && !toUserObjId) {
      return res.status(400).json({ message: "Invalid recipient id" });
    }

    if (toUserObjId) {
      const toUser = await User.findById(toUserObjId).lean();
      if (!toUser) return res.status(404).json({ message: "Recipient not found" });
    }

    // find or create conversation
    let conversation = null;
    if (conversationId) {
      const convOid = toObjectIdIfValid(conversationId);
      if (!convOid) return res.status(400).json({ message: "Invalid conversation id" });
      conversation = await Conversation.findById(convOid);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      // If toUserId wasn't provided, infer the recipient as the other participant
      if (!toUserObjId) {
        const participants = (conversation.participants || []).map(String);
        const other = participants.find((p) => p !== String(fromOid));
        if (!other) {
          return res.status(400).json({ message: "Cannot determine recipient from conversation participants" });
        }
        toUserObjId = toObjectIdIfValid(other);
        if (!toUserObjId) return res.status(400).json({ message: "Invalid inferred recipient id" });

        const toUser = await User.findById(toUserObjId).lean();
        if (!toUser) return res.status(404).json({ message: "Inferred recipient not found" });
      }
    } else {
      // conversationId not provided: find a conversation between the two users or create one
      const a = fromOid;
      const b = toUserObjId;
      if (!a || !b) return res.status(400).json({ message: "Invalid participants for conversation" });

      conversation = await Conversation.findOne({ participants: { $all: [a, b] } });
      if (!conversation) {
        conversation = new Conversation({
          participants: [a, b],
          lastMessage: null,
        });
        await conversation.save();
      }
    }

    // ensure we have a fresh mongoose document
    conversation = await Conversation.findById(conversation._id);
    if (!conversation) {
      console.error("No conversation after find/create:", conversation);
      return res.status(500).json({ message: "Failed to create or find conversation" });
    }

    // build and save message
    const message = new Message({
      conversation: conversation._id,
      from: fromOid,
      to: toUserObjId,
      text,
      attachments,
      read: false,
    });

    await message.save();

    // update conversation lastMessage & updatedAt
    conversation.lastMessage = { text, from: fromOid, createdAt: message.createdAt || new Date() };
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("from", "name email")
      .populate("to", "name email")
      .lean();

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants", "name email title company")
      .lean();

    // emit sockets (best-effort; don't block response)
    try {
      emitToRecipient(req, String(toUserObjId), "message:receive", { message: populatedMessage, conversation: populatedConversation });
      emitToRecipient(req, String(fromOid), "message:sent", { message: populatedMessage, conversation: populatedConversation });

      const io = req.app?.locals?.io;
      if (io) io.to(`conv:${String(conversation._id)}`).emit("message:receive", { message: populatedMessage, conversation: populatedConversation });
    } catch (e) {
      console.warn("socket emit warning:", e);
    }

    return res.status(201).json({ message: populatedMessage, conversation: populatedConversation });
  } catch (err) {
    console.error("POST /api/messages/send error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error sending message", error: err?.message ?? "unknown" });
  }
});

// ===== GET /  list conversations (inbox/outgoing) =====
router.get("/", authRequired, async (req, res) => {
  try {
    const uid = req.userId;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const userOid = toObjectIdIfValid(uid);
    if (!userOid) return res.status(400).json({ message: "Invalid user id" });

    const filter = { participants: { $in: [userOid] } };

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("participants", "name title company email")
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    const convIds = (conversations || []).map((c) => (c._id ? toObjectIdIfValid(c._id) : null)).filter(Boolean);

    // compute unread counts
    let unreadCounts = [];
    if (convIds.length > 0) {
      unreadCounts = await Message.aggregate([
        { $match: { conversation: { $in: convIds }, to: userOid, read: false } },
        { $group: { _id: "$conversation", count: { $sum: 1 } } },
      ]);
    } else {
      unreadCounts = [];
    }

    const unreadMap = new Map((unreadCounts || []).map((u) => [String(u._id), u.count]));

    const results = conversations.map((c) => ({
      ...c,
      unread: unreadMap.get(String(c._id)) || 0,
    }));

    return res.json({ conversations: results, total });
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return res.status(500).json({ message: "Server error listing conversations" });
  }
});

// ===== GET /with/:userId  (conversation between two users) =====
router.get("/with/:userId", authRequired, async (req, res) => {
  try {
    const me = req.userId;
    const other = req.params.userId;
    if (!other) return res.status(400).json({ message: "Missing other user id" });

    const meOid = toObjectIdIfValid(me);
    const otherOid = toObjectIdIfValid(other);
    if (!otherOid) return res.status(400).json({ message: "Invalid other user id" });

    const conv = await Conversation.findOne({ participants: { $all: [meOid, otherOid] } })
      .populate("participants", "name title company email")
      .lean();

    if (!conv) return res.status(404).json({ message: "No conversation found" });

    const messages = await Message.find({ conversation: conv._id })
      .sort({ createdAt: 1 })
      .populate("from", "name email")
      .populate("to", "name email")
      .lean();

    return res.json({ conversation: conv, messages });
  } catch (err) {
    console.error("GET /api/messages/with/:id error:", err);
    return res.status(500).json({ message: "Server error fetching conversation with user" });
  }
});

// ===== POST /conversations  create conversation =====
router.post("/conversations", authRequired, async (req, res) => {
  try {
    const me = req.userId;
    const { participantIds = [] } = req.body || {};
    const ids = Array.from(new Set([me, ...(participantIds || [])].map(String))).filter(Boolean);

    if (ids.length < 2) return res.status(400).json({ message: "Need at least two participants" });

    const oids = ids.map((i) => toObjectIdIfValid(i)).filter(Boolean);

    // find exact-match conversation (participants match exactly)
    const existing = await Conversation.findOne({
      participants: { $all: oids },
      $expr: { $eq: [{ $size: "$participants" }, oids.length] },
    }).lean();

    if (existing) {
      const conv = await Conversation.findById(existing._id).populate("participants", "name title email").lean();
      return res.json({ conversation: conv });
    }

    const conv = new Conversation({ participants: oids });
    await conv.save();
    const populated = await Conversation.findById(conv._id).populate("participants", "name title email").lean();
    return res.status(201).json({ conversation: populated });
  } catch (err) {
    console.error("POST /api/messages/conversations error:", err);
    return res.status(500).json({ message: "Server error creating conversation" });
  }
});

// ===== GET /conversations/:id  get messages in conversation =====
router.get("/conversations/:id", authRequired, async (req, res) => {
  try {
    const me = req.userId;
    const convId = req.params.id;
    if (!convId) return res.status(400).json({ message: "Missing conversation id" });

    const convOid = toObjectIdIfValid(convId);
    if (!convOid) return res.status(400).json({ message: "Invalid conversation id" });

    const conv = await Conversation.findById(convOid).lean();
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    if (!conv.participants.map(String).includes(String(me))) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const messages = await Message.find({ conversation: conv._id })
      .sort({ createdAt: 1 })
      .populate("from", "name email")
      .populate("to", "name email")
      .lean();

    return res.json({ conversation: conv, messages });
  } catch (err) {
    console.error("GET /api/messages/conversations/:id error:", err);
    return res.status(500).json({ message: "Server error fetching conversation messages" });
  }
});

// ===== POST /conversations/:id/read-all =====
router.post("/conversations/:id/read-all", authRequired, async (req, res) => {
  try {
    const me = req.userId;
    const convId = req.params.id;
    if (!convId) return res.status(400).json({ message: "Missing conversation id" });

    const convOid = toObjectIdIfValid(convId);
    if (!convOid) return res.status(400).json({ message: "Invalid conversation id" });

    const conv = await Conversation.findById(convOid);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    if (!conv.participants.map(String).includes(String(me))) return res.status(403).json({ message: "Not allowed" });

    const r = await Message.updateMany({ conversation: conv._id, to: toObjectIdIfValid(me), read: false }, { $set: { read: true } });
    const modified = r.modifiedCount ?? r.nModified ?? 0;
    return res.json({ ok: true, modified });
  } catch (err) {
    console.error("POST /api/messages/conversations/:id/read-all error:", err);
    return res.status(500).json({ message: "Server error marking read" });
  }
});

export default router;
