// backend/src/middleware/auth_debug.js
export function authRequired(req, res, next) {
  try {
    // For quick dev testing: set the user id via header: `x-user-id`
    const headerUid = req.headers['x-user-id'];
    if (!headerUid) {
      // If header not present, return 401 so you know auth is the issue
      return res.status(401).json({ message: "Missing x-user-id header (dev auth)" });
    }
    // Optionally validate as ObjectId string format (not necessary but helpful)
    req.userId = headerUid;
    return next();
  } catch (err) {
    console.error("auth_debug error:", err);
    return res.status(401).json({ message: "Authentication failed (dev)" });
  }
}
