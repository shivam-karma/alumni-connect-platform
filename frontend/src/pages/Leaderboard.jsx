// frontend/src/pages/Leaderboard.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";
import { Link } from "react-router-dom";

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function fetchBoard() {
    setLoading(true);
    setErr("");
    try {
      // If your API requires auth to see leaderboard, send token; otherwise omitted
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/users/leaderboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setRows(data.users || []);
    } catch (e) {
      console.error("fetch leaderboard", e?.response?.data || e.message || e);
      setErr(e?.response?.data?.message || "Failed to load leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBoard();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <div className="text-sm text-gray-600">Compete with the community — earn points & badges!</div>
      </div>

      <div className="card mt-4 p-4">
        {loading && <div>Loading leaderboard…</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}

        {!loading && !err && rows.length === 0 && (
          <div className="text-sm text-gray-500">No leaderboard data yet.</div>
        )}

        {!loading && rows.length > 0 && (
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.id || r._id} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 text-white grid place-items-center font-semibold">
                    {r.name?.split(" ").map(s => s[0]).slice(0,2).join("") || "U"}
                  </div>
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-gray-600">{r.title || r.company || r.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Points</div>
                    <div className="font-semibold text-lg">{r.points ?? 0}</div>
                  </div>

                  <div className="flex gap-1">
                    {(r.badges || []).slice(0,3).map(b => (
                      <div key={b.key || b.name} title={b.name} className="text-xs px-2 py-1 bg-gray-100 rounded">{b.name}</div>
                    ))}
                  </div>

                  <Link to={`/dashboard/profile/${r.id || r._id}`} className="btn btn-ghost ml-4">View</Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
