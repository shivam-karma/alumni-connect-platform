// backend/src/models/Message.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional for group convs
  text: { type: String, default: "" },
  attachments: [{ filename: String, url: String }],
  status: { type: String, default: "delivered" }, // sent, delivered, read
  createdAt: { type: Date, default: () => new Date() }
});

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
