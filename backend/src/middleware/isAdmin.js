// backend/src/middleware/isAdmin.js
import User from "../models/User.js";


export async function isAdmin(req, res, next) {
try {
const uid = req.userId;
if (!uid) return res.status(401).json({ message: "Not authenticated" });


const user = await User.findById(uid).lean();
if (!user) return res.status(401).json({ message: "User not found" });


if (user.role !== "admin") {
return res.status(403).json({ message: "Forbidden: admin only" });
}


req.user = user;
return next();
} catch (err) {
console.error("isAdmin middleware error:", err);
return res.status(500).json({ message: "Server error in isAdmin" });
}
}