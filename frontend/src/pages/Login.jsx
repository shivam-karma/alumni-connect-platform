// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Try login request
      const res = await api.post("/api/auth/login", form);
      const data = res?.data || {};

      // Token could be inside: data.token OR data.data.token
      const token =
        data.token ||
        data.accessToken ||
        data?.data?.token ||
        null;

      // User object could be inside: data.user or data.data.user
      let user =
        data.user ||
        data?.data?.user ||
        null;

      // If backend does NOT return user directly → fetch /me
      if (!user) {
        try {
          const me = await api.get("/api/auth/me");
          user = me?.data?.user || me?.data || null;
        } catch {
          throw new Error("Login succeeded but user profile failed.");
        }
      }

      // Call global login
      login({ token, user });

      // Redirect depending on role
      if (user?.role === "admin") {
        nav("/admin");
      } else {
        nav("/dashboard");
      }
    } catch (err) {
      console.error("Login Error:", err?.response?.data || err);
      setError(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container py-10 grid place-items-center">
        <div className="max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 grid place-items-center text-white text-lg">⭑</div>
            <div>
              <div className="text-xl font-semibold text-blue-700">AlumniConnect</div>
              <div className="text-xs text-gray-500 -mt-1">Welcome back to your alumni network</div>
            </div>
          </div>

          <div className="card">
            <h1 className="text-2xl font-bold text-center">Sign In</h1>
            <p className="text-center text-gray-600 text-sm">Enter your credentials to access your account</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm mb-1">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <p className="text-sm text-center text-gray-600">
                Don't have an account?{" "}
                <Link to="/register" className="underline">Sign up</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
