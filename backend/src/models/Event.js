// backend/src/models/Event.js
import mongoose from "mongoose";

const SpeakerSchema = new mongoose.Schema({
  name: String,
  title: String,
  company: String,
  bio: String,
  avatarUrl: String,
}, { _id: false });

const AgendaItemSchema = new mongoose.Schema({
  time: String,
  title: String,
  durationMinutes: Number,
  description: String,
}, { _id: false });

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, index: true },
  description: { type: String, default: "" },

  startDate: Date,
  endDate: Date,

  startTime: String,
  endTime: String,

  location: {
    type: { type: String, default: "physical" },
    venue: String,
    address: String,
    url: String
  },

  capacity: { type: Number, default: 0 },

  // tags as array of strings
  tags: { type: [String], default: [] },

  featured: { type: Boolean, default: false },
  eventType: { type: String, default: "Event" },

  speakers: [SpeakerSchema],
  agenda: [AgendaItemSchema],

  organizer: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String
  },

  rsvps: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["going","interested","cancelled"], default: "interested" },
    createdAt: { type: Date, default: Date.now },
  }],

  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
}, { timestamps: true });

/* Indexes:
   - Text index only on textual fields (title + description)
   - Normal index on tags (array-of-strings supported)
   - Index on startDate for sorting
*/
EventSchema.index({ title: "text", description: "text" });
EventSchema.index({ tags: 1 });
EventSchema.index({ startDate: 1 });

export default mongoose.model("Event", EventSchema);
