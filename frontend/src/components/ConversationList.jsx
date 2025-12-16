import React from "react";

export default function ConversationList({
  conversations = [],
  onSelect,
  selected,
  currentUserId,
}) {
  return (
    <div className="space-y-2">
      {conversations.map(c => {
        const title = (c.participants || [])
          .map(p => p.name)
          .join(", ");

        const lastText = c.lastMessage?.text || "";
        const updatedAt = c.updatedAt || c.lastMessage?.createdAt;

        const unread = c.unreadCount || 0;

        return (
          <div
            key={c._id}
            className={`flex items-start gap-2 p-3 rounded cursor-pointer ${
              selected === c._id ? "bg-gray-100" : "hover:bg-gray-50"
            }`}
            onClick={() => onSelect(c)}
          >
            <div className="h-8 w-8 rounded-full bg-gray-200 grid place-items-center text-xs font-semibold">
              {title
                .split(" ")
                .map(s => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{title || "Conversation"}</div>
                {updatedAt && (
                  <div className="text-xs text-gray-400 ml-2">
                    {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600 truncate">{lastText}</div>
            </div>
            {unread > 0 && (
              <div className="ml-2 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs">
                {unread}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
