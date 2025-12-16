// backend/src/models/ConnectionRequest.js
import mongoose from "mongoose";

const connectionRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    // optional metadata
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

const ConnectionRequest = mongoose.model("ConnectionRequest", connectionRequestSchema);
export default ConnectionRequest;
