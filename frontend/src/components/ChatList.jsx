// frontend/src/components/ChatList.jsx
import React from "react";

export default function ChatList({ conversations = [], loading, onSelect, activeConv }) {
  if (loading) return <div className="card p-3">Loading chats…</div>;
  if (!conversations.length) return <div className="card p-3 text-sm text-gray-500">No conversations yet</div>;

  return (
    <div className="space-y-2">
      {conversations.map(conv => {
        const other = (conv.participants || []).filter(p => p._id !== conv._id && p?._id !== conv._id)[0] || conv.participants?.find(p=>p._id) || {};
        const title = conv.title || other?.name || "Conversation";
        const preview = conv.lastMessageText || "";
        const active = activeConv?._id === conv._id || activeConv === conv._id;
        return (
          <div key={conv._id} onClick={() => onSelect(conv)} className={`border rounded p-3 cursor-pointer ${active ? "bg-gray-50" : ""}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-gray-500 truncate">{preview}</div>
              </div>
              <div className="text-xs text-gray-400">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString() : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
