// backend/src/models/Conversation.js
import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  title: { type: String, default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // 2 for 1:1
  isGroup: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

ConversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
