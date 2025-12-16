import { useEffect, useState } from "react";
import api from "../lib/api";

export default function StartChatModal({ open, onClose, onCreated }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  if (!open) return null;

  async function handleSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/users", {
        params: { q: query.trim() },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setResults(data.users || []);
    } catch (err) {
      console.error("search users", err);
      setResults([]);
      alert(err?.response?.data?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartChat(userId) {
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.post(
        "/api/messages/conversations",
        { otherUserId: userId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (data?.conversation && typeof onCreated === "function") {
        onCreated(data.conversation);
      }
      onClose && onClose();
    } catch (err) {
      console.error("create conversation", err);
      alert(err?.response?.data?.message || "Could not start chat");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-lg bg-white rounded-xl shadow-xl p-5">
        <button
          className="absolute right-3 top-3 text-gray-600 hover:text-gray-800"
          onClick={onClose}
        >
          ✕
        </button>

        <h3 className="font-semibold text-lg mb-2">Start a new chat</h3>
        <p className="text-sm text-gray-600">
          Search alumni or students by name, email, or company.
        </p>

        <form className="mt-3 flex gap-2" onSubmit={handleSearch}>
          <input
            className="input flex-1"
            placeholder="Type a name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
          {loading && <div className="text-sm">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="text-sm text-gray-500">No results yet.</div>
          )}

          {results.map(u => (
            <div
              key={u.id}
              className="flex items-center justify-between border rounded-lg p-2"
            >
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-gray-600">
                  {u.email} {u.title || u.company ? "•" : ""} {u.title}{" "}
                  {u.company ? `@ ${u.company}` : ""}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleStartChat(u.id)}
                disabled={creating}
              >
                {creating ? "Starting…" : "Chat"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
