import { useEffect, useState } from "react";
import api from "../lib/api";
import { AuthCtx } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data } = await api.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(data.user);
      } catch {
        logout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveToken(t) {
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
    setToken(t);
  }

  function login({ token, user }) {
    saveToken(token);
    setUser(user);
  }

  function logout() {
    saveToken(null);
    setUser(null);
  }

  const value = { user, token, login, logout };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
