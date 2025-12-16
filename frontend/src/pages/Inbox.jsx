// frontend/src/pages/Inbox.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  async function fetchConversations() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/messages", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setConversations(data?.conversations || []);
    } catch (err) {
      console.error("fetchConversations", err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Messages</h2>
        <button className="btn" onClick={fetchConversations}>Refresh</button>
      </div>

      {loading && <div>Loading conversations…</div>}
      {!loading && conversations.length === 0 && <div className="text-sm text-gray-500">No conversations yet.</div>}

      <div className="space-y-3">
        {conversations.map(conv => {
          const other = (conv.participants || []).find(p => p._id !== localStorage.getItem("userId") && p.id !== localStorage.getItem("userId")) || conv.participants?.[0] || {};
          const title = other.name || (other.email ? other.email.split("@")[0] : `Conversation ${conv._id}`);
          return (
            <div key={conv._id} className="card p-3 flex items-center justify-between">
              <div onClick={() => nav(`/dashboard/messages/${conv._id}`)} style={{ cursor: "pointer" }}>
                <div className="font-semibold">{title}</div>
                <div className="text-sm text-gray-600">{conv.lastMessage?.text ? conv.lastMessage.text.slice(0, 80) : "No messages yet"}</div>
              </div>
              <div className="text-xs text-gray-500">
                {conv.unread ? <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs">{conv.unread}</span> : null}
                <div className="mt-1 text-right text-xs text-gray-400">{conv.updatedAt ? new Date(conv.updatedAt).toLocaleString() : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
