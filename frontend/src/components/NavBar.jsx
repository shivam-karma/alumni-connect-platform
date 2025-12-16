// frontend/src/components/NavBar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext.jsx"; // updated to use context-based hook
import useSocket from "../hooks/useSocket.js";

const MILESTONE_THRESHOLDS = [100, 300];

export default function NavBar() {
  const { currentUser: user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const isDash = pathname.startsWith("/dashboard");

  const initials = (user?.name || "U")
    .split(" ")
    .map(s => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const prevPointsRef = useRef(user?.points ?? 0);
  const [pulse, setPulse] = useState(false);
  const [showBadgeTooltip, setShowBadgeTooltip] = useState(false);
  const tooltipIdRef = useRef(`badges-tooltip-${Math.random().toString(36).slice(2,8)}`);
  const celebratedRef = useRef(new Set());

  // unread badge state
  const [unread, setUnread] = useState(0);
  const userId = user?.id || user?._id;
  const { on, off, connected } = useSocket(userId);

  useEffect(() => {
    const prev = prevPointsRef.current ?? 0;
    const now = user?.points ?? 0;
    if (now !== prev) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 800);
      for (const t of MILESTONE_THRESHOLDS) {
        if (prev < t && now >= t && !celebratedRef.current.has(t)) {
          celebratedRef.current.add(t);
          // simple confetti effect
          try {
            const c = document.createElement("div");
            c.className = "confetti-container";
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 1200);
          } catch (e) {}
          if (window.showToast) window.showToast(`🎉 Congrats! You reached ${t} points`);
          break;
        }
      }
      prevPointsRef.current = now;
      return () => clearTimeout(id);
    } else {
      prevPointsRef.current = now;
    }
  }, [user?.points]);

  // handle incoming messages -> bump unread (unless on messages page)
  useEffect(() => {
    if (!userId) return;
    function onReceive(payload) {
      // If user is looking at messages page, don't bump
      if (!pathname.includes("/dashboard/messages")) {
        setUnread(u => u + 1);
      }
    }
    on("message:receive", onReceive);
    return () => off("message:receive", onReceive);
  }, [userId, on, off, pathname]);

  useEffect(() => {
    if (pathname.includes("/dashboard/messages")) setUnread(0);
  }, [pathname]);

  function handleLogout() {
    // call context logout (which should clear token/state) and navigate home
    try {
      logout();
      // be safe: also clear localStorage token if present
      localStorage.removeItem("token");
    } catch (e) {}
    nav("/");
  }

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur topbar">
      <div className="container h-14 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-xl grid place-items-center text-white text-sm font-bold"
            style={{ background: "hsl(var(--brand))" }}
          >
            A
          </div>
          <span className="font-semibold tracking-tight">AlumniConnect</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {!isDash && (
                <Link to="/dashboard" className="btn btn-primary">
                  Dashboard
                </Link>
              )}

              {/* Admin link (visible only to admins) */}
              {user?.role === "admin" && (
                <Link to="/admin" className="btn btn-ghost border rounded px-3 py-1">
                  Admin
                </Link>
              )}

              {/* Messages icon */}
              <Link to="/dashboard/messages" className="relative">
                <ChatBubbleLeftEllipsisIcon className="w-6 h-6 text-gray-600" />
                {unread > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5">
                    {unread}
                  </span>
                )}
              </Link>

              <div className="hidden sm:flex items-center gap-3 mr-2 relative">
                <div
                  className={`points-pill flex items-center gap-2 px-3 py-1 rounded-full text-sm ${pulse ? "points-pulse" : ""}`}
                  onMouseEnter={() => setShowBadgeTooltip(true)}
                  onMouseLeave={() => setShowBadgeTooltip(false)}
                  aria-label={`You have ${user?.points ?? 0} points`}
                  aria-describedby={tooltipIdRef.current}
                  aria-live="polite"
                  role="status"
                >
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-semibold">{user?.points ?? 0}</span>
                </div>

                <div className="flex gap-2">
                  {(user?.badges || []).slice(0, 3).map(b => (
                    <div key={b.key} className="text-xs px-2 py-1 bg-gray-100 rounded" title={b.name}>
                      {b.name}
                    </div>
                  ))}
                </div>

                {showBadgeTooltip && (user?.badges || []).length > 0 && (
                  <div id={tooltipIdRef.current} role="tooltip" className="badge-tooltip" aria-hidden={!showBadgeTooltip}>
                    <div className="font-semibold text-sm mb-1">Badges</div>
                    <div className="flex flex-col gap-1">
                      {(user.badges || []).map(b => (
                        <div key={b.key} className="text-xs">
                          • {b.name} {b.awardedAt ? `— ${new Date(b.awardedAt).toLocaleDateString()}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white grid place-items-center font-semibold">
                  {initials}
                </div>
                <div className="hidden sm:block text-sm">
                  <div className="font-medium">{user?.name?.split(" ")[0]}</div>
                  <div className="text-xs text-gray-500">{user?.title || user?.role}</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:ml-3">
                  <button onClick={handleLogout} className="btn btn-ghost">
                    Logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
