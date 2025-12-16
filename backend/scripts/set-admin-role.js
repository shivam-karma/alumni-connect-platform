// backend/scripts/set-admin-role.js
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

async function run() {
  await connectDB(process.env.MONGODB_URI);

  const adminEmail = "admin@example.com";
  const plainPassword = "Admin@123"; // change this after first login

  // find existing user
  const existing = await User.findOne({ email: adminEmail }).exec();

  // prepare password hash
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(plainPassword, salt);

  if (existing) {
    console.log("Found existing user:", existing._id.toString());
    // Update role to 'admin' if not already
    if (existing.role !== "admin") {
      existing.role = "admin";
      console.log("Setting role -> admin");
    } else {
      console.log("User already has role 'admin'");
    }
    // Set passwordHash if not present or different
    if (!existing.passwordHash) {
      existing.passwordHash = passwordHash;
      console.log("Setting passwordHash (you should change password after first login).");
    } else {
      console.log("User already has passwordHash. (If you want to reset, delete passwordHash and re-run.)");
    }

    await existing.save();
    console.log("Updated user:", existing._id.toString());
    console.log("Email:", adminEmail);
    console.log("Password (plain):", plainPassword);
    process.exit(0);
  } else {
    // create new admin user
    const u = new User({
      name: "Site Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      title: "Administrator",
      company: "Platform",
    });
    await u.save();
    console.log("Created admin user:", u._id.toString());
    console.log("Email:", adminEmail);
    console.log("Password (plain):", plainPassword);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Failed:", err && err.stack ? err.stack : err);
  process.exit(1);
});
