// frontend/src/components/UserPickerModal.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function UserPickerModal({ open, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  async function search(qs) {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/users/search", { params: { q: qs, limit: 20 }, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setResults(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      console.error("user search", e);
    } finally {
      setLoading(false);
    }
  }

  return !open ? null : (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg p-4 w-[92%] max-w-xl">
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => { setQ(e.target.value); search(e.target.value); }} placeholder="Search people by name or email..." className="input flex-1" />
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="mt-3 space-y-2" style={{ maxHeight: 300, overflowY: "auto" }}>
          {loading && <div>Searching…</div>}
          {!loading && results.length === 0 && <div className="text-sm text-gray-500">No users found</div>}
          {results.map(u => (
            <div key={u._id} className="p-3 border rounded flex items-center justify-between hover:bg-gray-50">
              <div>
                <div className="font-medium">{u.name || u.email}</div>
                <div className="text-sm text-gray-500">{u.title || u.email}</div>
              </div>
              <div>
                <button className="btn btn-primary" onClick={() => onSelect(u)}>Message</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
