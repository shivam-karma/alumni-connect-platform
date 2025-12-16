// backend/scripts/create-admin.js
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import bcrypt from "bcryptjs";

async function run() {
  try {
    await connectDB(process.env.MONGODB_URI);

    const email = "admin@example.com";
    const defaultPlainPassword = "Admin@123"; // change after creation

    // find schema info
    const schemaPaths = User.schema.paths;
    const requiredFields = [];
    let passwordFieldName = null;
    let rolePath = null;

    for (const [pname, pinfo] of Object.entries(schemaPaths)) {
      // detect required
      if (pinfo.isRequired && typeof pinfo.isRequired === "function" && pinfo.isRequired()) {
        requiredFields.push(pname);
      } else if (pinfo.options && pinfo.options.required) {
        requiredFields.push(pname);
      }

      // detect password-like fields
      const lower = pname.toLowerCase();
      if (!passwordFieldName && (lower.includes("password") || lower.includes("passwordhash") || lower.includes("passhash") || lower.includes("pwd"))) {
        passwordFieldName = pname;
      }

      // detect role field and its enum
      if (pname === "role" || (pinfo.options && pinfo.options.enum)) {
        if (pname === "role") rolePath = pinfo;
      }
    }

    // Decide role to use
    let chosenRole = "admin";
    if (rolePath) {
      const enums = rolePath.options.enum || rolePath.enumValues || [];
      if (enums.length === 0) {
        // no restriction
        chosenRole = "admin";
      } else if (!enums.includes("admin")) {
        // pick first enum value and warn
        console.warn("Schema role enum does NOT include 'admin'. Available role values:", enums);
        chosenRole = enums[0];
        console.warn("Using role:", chosenRole, "for new admin (you can change later).");
      }
    } else {
      // no role path - we'll set admin anyway
      chosenRole = "admin";
    }

    // create password hash if a password field is required
    let passwordHash = null;
    if (passwordFieldName) {
      try {
        const salt = bcrypt.genSaltSync(10);
        passwordHash = bcrypt.hashSync(defaultPlainPassword, salt);
        console.log(`Will set password field '${passwordFieldName}' to hash of '${defaultPlainPassword}'`);
      } catch (e) {
        console.warn("bcrypt failed; falling back to plain password string (not recommended).", e);
        passwordHash = defaultPlainPassword;
      }
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("Admin already exists:", existing._id.toString());
      console.log("Existing user data:", { email: existing.email, role: existing.role });
      console.log("If you want to change the role or password, run an update in MongoDB or use the admin endpoints.");
      process.exit(0);
    }

    const doc = {
      name: "Site Admin",
      email,
      title: "Administrator",
      company: "Platform",
      role: chosenRole,
    };

    if (passwordFieldName) doc[passwordFieldName] = passwordHash;

    // set any other required fields to simple defaults if missing
    for (const f of requiredFields) {
      if (doc[f] === undefined) {
        // avoid _id, createdAt, etc.
        if (["__v", "_id", "id"].includes(f)) continue;
        // if it's the password field already handled, skip
        if (f === passwordFieldName) continue;
        doc[f] = doc[f] || `seed-${f}-${Date.now()}`;
        console.warn(`Auto-filling required field '${f}' with placeholder value.`);
      }
    }

    const admin = new User(doc);
    await admin.save();

    console.log("Admin created successfully!");
    console.log("Email:", email);
    if (passwordFieldName) console.log("Password (plain, for first login):", defaultPlainPassword);
    console.log("Admin ID:", admin._id.toString());
    process.exit(0);

  } catch (err) {
    console.error("Error creating admin:", err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
