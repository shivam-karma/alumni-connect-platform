// src/models/User.js
import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema(
  {
    title: String,
    company: String,
    from: String,
    to: String,
    description: String,
  },
  { _id: false }
);

// connection request subdocument schema
const connectionRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // sender
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    createdAt: { type: Date, default: () => new Date() },
    respondedAt: { type: Date, default: null }
  },
  { _id: true } // keep _id to be able to target individual requests
);

const userSchema = new mongoose.Schema(
  {
    // Basic profile
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Required hashed password for login
    passwordHash: { type: String, required: true },

    department: { type: String, default: "" },
    batch: { type: String, default: "" },

    // role
    role: {
      type: String,
      enum: ["Student", "Alumni", "admin"],
      default: "Student",
    },

    title: { type: String, default: "" },
    company: { type: String, default: "" },
    location: { type: String, default: "" },
    skills: { type: [String], default: [] },
    isMentor: { type: Boolean, default: false },

    // Connections
    connections: { type: Number, default: 0 },
    connectionsList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // NEW: embedded connection requests (inbox for this user)
    // Each request is created on the recipient user's document (push)
    connectionRequests: { type: [connectionRequestSchema], default: [] },

    // Contact
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    bio: { type: String, default: "" },

    // Experience & achievements
    experience: { type: [experienceSchema], default: [] },
    achievements: { type: [String], default: [] },

    // Gamification
    points: { type: Number, default: 0 },
    badges: [{ key: String, name: String, awardedAt: Date }],

    stats: {
      posts: { type: Number, default: 0 },
      newsPosts: { type: Number, default: 0 },
      jobPosts: { type: Number, default: 0 },
      eventsCreated: { type: Number, default: 0 },
      connectionsAccepted: { type: Number, default: 0 },
      rsvps: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Safe JSON transform (removes passwordHash)
userSchema.methods.toSafeJSON = function () {
  const {
    _id,
    name,
    email,
    department,
    batch,
    role,
    title,
    company,
    location,
    skills,
    isMentor,
    connections,
    connectionsList,
    connectionRequests,
    phone,
    website,
    linkedin,
    github,
    bio,
    experience,
    achievements,
    points,
    badges,
    stats,
    createdAt,
    updatedAt,
  } = this;

  return {
    id: _id.toString(),
    name,
    email,
    department,
    batch,
    role,
    title,
    company,
    location,
    skills,
    isMentor,
    connections,
    connectionsList: (connectionsList || []).map((id) =>
      id?.toString ? id.toString() : id
    ),
    // expose connectionRequests in a safe/populated-friendly shape
    connectionRequests: (connectionRequests || []).map((r) => ({
      id: r._id?.toString ? r._id.toString() : r._id,
      from: r.from?.toString ? r.from.toString() : r.from,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt || null,
    })),
    phone,
    website,
    linkedin,
    github,
    bio,
    experience,
    achievements,
    points: points || 0,
    badges:
      badges?.map((b) => ({
        key: b.key,
        name: b.name,
        awardedAt: b.awardedAt,
      })) || [],
    stats: stats || {},
    createdAt,
    updatedAt,
  };
};

// Prevent overwrite error in dev
export default mongoose.models.User || mongoose.model("User", userSchema);
