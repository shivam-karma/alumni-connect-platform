// frontend/src/components/MentorshipRequestsList.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function MentorshipRequestsList({ box = "incoming", onAction }) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/mentorship/requests", { params: { box }, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setRequests(data.requests || []);
    } catch (err) {
      console.error("fetch mentorship requests", err);
      setRequests([]);
    } finally { setLoading(false); }
  }

  useEffect(()=> { load(); }, [box]);

  async function accept(id) {
    try {
      const token = localStorage.getItem("token");
      await api.post(`/api/mentorship/${id}/accept`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      load(); onAction && onAction();
    } catch (err) { alert(err?.response?.data?.message || "Accept failed"); }
  }
  async function reject(id) {
    try {
      const token = localStorage.getItem("token");
      await api.post(`/api/mentorship/${id}/reject`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      load(); onAction && onAction();
    } catch (err) { alert(err?.response?.data?.message || "Reject failed"); }
  }
  async function cancel(id) {
    try {
      const token = localStorage.getItem("token");
      await api.post(`/api/mentorship/${id}/cancel`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      load(); onAction && onAction();
    } catch (err) { alert(err?.response?.data?.message || "Cancel failed"); }
  }

  if (loading) return <div>Loading requests…</div>;
  if (!requests.length) return <div className="text-sm text-gray-500">No requests.</div>;

  return (
    <div className="space-y-3">
      {requests.map(r => (
        <div key={r._id} className="border rounded-lg p-3 flex items-start justify-between">
          <div>
            <div className="font-semibold">{r.title || "Mentorship Request"}</div>
            <div className="text-sm text-gray-600">{r.message}</div>
            <div className="text-xs text-gray-500 mt-1">From: {r.from?.name} • To: {r.to?.name}</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-sm">{r.status}</div>
            {box === "incoming" && r.status === "pending" && (
              <>
                <button className="btn" onClick={()=>reject(r._id)}>Reject</button>
                <button className="btn btn-primary" onClick={()=>accept(r._id)}>Accept</button>
              </>
            )}
            {box === "outgoing" && r.status === "pending" && <button className="btn" onClick={()=>cancel(r._id)}>Cancel</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
