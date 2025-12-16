// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api.js";

// named export (some hooks/components import AuthCtx directly)
export const AuthCtx = createContext(null);

// hook (named) — use across the app as: import { useAuth } from "../context/AuthContext.jsx";
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // user object
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token");
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // load user when token changes (or on mount)
  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      if (!token) {
        if (mounted) {
          setCurrentUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const { data } = await api.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;
        // backend might return { user } or user directly
        setCurrentUser(data?.user ?? data);
      } catch (err) {
        // invalid token / expired — clear auth
        console.warn("Auth load failed:", err?.response?.data || err?.message || err);
        logout();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
    // we intentionally run when token changes
  }, [token]);

  // Save token to localStorage + state
  function saveToken(t) {
    try {
      if (t) localStorage.setItem("token", t);
      else localStorage.removeItem("token");
    } catch (e) {
      console.warn("Could not access localStorage:", e);
    }
    setToken(t);
  }

  // login expects an object { token, user } or { token } (user optional)
  function login({ token: newToken, user } = {}) {
    if (newToken) saveToken(newToken);
    if (user) setCurrentUser(user);
  }

  // logout clears token + user
  function logout() {
    saveToken(null);
    setCurrentUser(null);
  }

  // expose both `user` and legacy `currentUser` to reduce breaking changes
  const value = {
    user: currentUser,
    currentUser,
    token,
    login,
    logout,
    loading,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
