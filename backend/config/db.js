// backend/config/db.js
import mongoose from "mongoose";

export async function connectDB(mongoUri) {
  const uri = mongoUri || process.env.MONGODB_URI || "mongodb://localhost:27017/alumni-platform";
  if (!uri) {
    throw new Error("Missing MongoDB URI. Set MONGODB_URI in .env or pass to connectDB()");
  }

  // Only set these once
  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  if (mongoose.connection.readyState === 1) {
    // already connected
    return mongoose;
  }

  try {
    await mongoose.connect(uri, opts);
    console.log("✅ Mongoose connected to", uri);
    return mongoose;
  } catch (err) {
    console.error("❌ Mongoose connection error:", err);
    throw err;
  }
}
