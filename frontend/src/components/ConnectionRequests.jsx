// frontend/src/components/ConnectionRequests.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function ConnectionRequests({ onRefresh }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function fetchIncoming() {
    setLoading(true);
    setErr("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/connections/incoming", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setRequests(data.requests || []);
    } catch (e) {
      console.error("fetch incoming", e);
      setErr(e?.response?.data?.message || e.message || "Failed to load requests");
      setRequests([]);
    } finally {
      setLoading(false);
      if (typeof onRefresh === "function") onRefresh();
    }
  }

  useEffect(() => { fetchIncoming(); }, []);

  if (loading) return <div className="card p-4">Loading requests…</div>;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Connection Requests</div>
        <button className="btn btn-ghost" onClick={fetchIncoming}>Refresh</button>
      </div>

      {err && <div className="text-red-600 mb-2">{err}</div>}

      {requests.length === 0 ? (
        <div className="text-sm text-gray-500">No pending requests.</div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r._id} className="flex items-start justify-between p-3 border rounded">
              <div>
                <div className="font-semibold">{r.from?.name || "Unknown"}</div>
                <div className="text-xs text-gray-600">{r.from?.title || ""} {r.from?.company ? `• ${r.from.company}` : ""}</div>
                {r.message && <div className="mt-2 text-sm">{r.message}</div>}
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn btn-sm btn-primary">Accept</button>
                <button className="btn btn-sm btn-ghost">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
