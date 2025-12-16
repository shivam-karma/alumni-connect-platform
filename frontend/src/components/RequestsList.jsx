// frontend/src/components/RequestsList.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function RequestsList({ profileUserId }) {
  const [requests, setRequests] = useState([]);
  const [connections, setConnections] = useState(0);

  // 🔹 Load pending requests + connection count when component loads
  useEffect(() => {
    fetchRequestsAndProfile();
  }, []);

  async function fetchRequestsAndProfile() {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/api/users/${profileUserId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // assuming backend returns user data with connectionRequests + connections
      setRequests(res.data.user.connectionRequests || []);
      setConnections(res.data.user.connections || 0);
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }

  async function handleAccept(req) {
    const reqId = req._id;
    const requesterId = req.from || req.requester || req.fromUserId; // adapt based on your field names

    // ✅ Optimistically update UI
    setRequests((prev) => prev.filter((r) => r._id !== reqId));
    setConnections((prev) => prev + 1);

    try {
      const token = localStorage.getItem("token");
      await api.post(
        `/api/users/${profileUserId}/requests/${reqId}/accept`,
        { requesterId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch (err) {
      console.error("Accept failed:", err.response?.data || err);
      alert(err.response?.data?.message || "Accept failed");
      fetchRequestsAndProfile(); // revert UI on failure
    }
  }

  async function handleReject(req) {
    const reqId = req._id;

    // ✅ Optimistically remove the request
    setRequests((prev) => prev.filter((r) => r._id !== reqId));

    try {
      const token = localStorage.getItem("token");
      await api.post(
        `/api/users/${profileUserId}/requests/${reqId}/reject`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch (err) {
      console.error("Reject failed:", err.response?.data || err);
      alert(err.response?.data?.message || "Reject failed");
      fetchRequestsAndProfile(); // revert UI on failure
    }
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-3">Pending Connection Requests</h2>

      <div className="mb-2 text-sm text-gray-700">
        <strong>Connections:</strong> {connections}
      </div>

      {requests.length === 0 && (
        <div className="text-sm text-gray-500">No pending requests</div>
      )}

      {requests.map((r) => (
        <div
          key={r._id}
          className="flex items-center justify-between p-2 border rounded-lg mb-2"
        >
          <div>
            <div className="font-medium">{r.fromName || "Unknown User"}</div>
            <div className="text-xs text-gray-600">{r.message || ""}</div>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-sm bg-green-500 hover:bg-green-600 text-white"
              onClick={() => handleAccept(r)}
            >
              Accept
            </button>
            <button
              className="btn btn-sm bg-red-500 hover:bg-red-600 text-white"
              onClick={() => handleReject(r)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
