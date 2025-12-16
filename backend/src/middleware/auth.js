// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";

/**
 * Robust auth middleware:
 * Sources checked (in order):
 * 1) DEV header (when DEV_AUTH=true): x-user-id
 * 2) req.session.userId (if you use sessions)
 * 3) cookie token: req.cookies.token
 * 4) Authorization header: Bearer <token>
 *
 * Accepts JWT claim names: sub | id | userId
 */
export function authRequired(req, res, next) {
  try {
    // 1) Dev bypass (explicitly enabled)
    if (process.env.DEV_AUTH === "true") {
      const devUid = req.headers["x-user-id"] || req.query?.devUserId;
      if (devUid) {
        req.userId = devUid;
        console.log("authRequired: DEV_AUTH bypass used, userId=", devUid);
        return next();
      }
    }

    // 2) Session fallback (if you use express-session)
    if (req.session && req.session.userId) {
      req.userId = req.session.userId;
      console.log("authRequired: session userId used");
      return next();
    }

    // 3) Token from cookie or Authorization
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = (req.cookies && req.cookies.token) || bearerToken || null;

    if (!token) {
      console.warn("authRequired: missing token (no cookie or Authorization).");
      return res.status(401).json({ message: "Unauthorized: missing token" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("authRequired: JWT_SECRET not set in env");
      return res.status(500).json({ message: "Server misconfiguration (missing JWT secret)" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        console.warn("authRequired: token expired");
        return res.status(401).json({ message: "Unauthorized: token expired" });
      }
      console.warn("authRequired: token verify failed:", jwtErr.message || jwtErr);
      return res.status(401).json({ message: "Unauthorized: invalid token" });
    }

    const userId = payload?.sub ?? payload?.id ?? payload?.userId ?? null;
    if (!userId) {
      console.warn("authRequired: token missing user id claim", payload);
      return res.status(401).json({ message: "Unauthorized: token payload invalid" });
    }

    req.userId = userId;
    return next();
  } catch (err) {
    console.error("authRequired unexpected error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}
