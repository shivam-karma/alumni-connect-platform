// frontend/src/pages/Messages.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { getApiBase } from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";
import ChatWindow from "../components/ChatWindow.jsx";
import { io } from "socket.io-client";

/**
 * Messages page — WhatsApp-like UI with:
 *  - Merge incoming conversation lists so previous items are preserved
 *  - Initials avatar instead of profile pic
 *  - New message composer (optimistic conversation create)
 *  - Read-all marking when opening a conversation
 *  - Socket updates to merge new messages in real-time
 */

// small helpers
function relativeTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "now";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}
function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}
function hashToColor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h << 5) - h + str.charCodeAt(i);
  const c = (h & 0x00ffffff).toString(16).toUpperCase();
  return `#${"000000".slice(0, 6 - c.length) + c}`;
}
function getOtherParticipant(participants = [], myId) {
  if (!participants || participants.length === 0) return null;
  if (!myId) return participants[0];
  return participants.find((p) => String(p._id || p.id || p) !== String(myId)) || participants[0];
}

export default function MessagesPage() {
  const { id: routeConvId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id || user?._1d || user?._id || null;

  const mountedRef = useRef(true);
  const socketRef = useRef(null);

  const [conversations, setConversations] = useState([]); // list of conversation objects
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedConv, setSelectedConv] = useState(routeConvId || null);
  const [query, setQuery] = useState("");
  const [newRecipientId, setNewRecipientId] = useState("");
  const [creating, setCreating] = useState(false);

  // in-memory user cache (id -> userObj) — used to resolve participant names when backend returns only ids
  const userCacheRef = useRef(new Map());
  const [, setTick] = useState(0);

  // helper: fetch & cache user
  async function fetchUserToCache(id) {
    if (!id) return null;
    const key = String(id);
    if (userCacheRef.current.has(key)) return userCacheRef.current.get(key);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get(`/api/users/${key}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const u = data?.user || { _id: key, name: "Unknown" };
      userCacheRef.current.set(key, u);
      setTick((t) => t + 1);
      return u;
    } catch (e) {
      // store fallback
      const fallback = { _id: key, name: "Unknown" };
      userCacheRef.current.set(key, fallback);
      setTick((t) => t + 1);
      return fallback;
    }
  }

  // Normalize participants array then preload missing user objects
  async function preloadParticipants(list) {
    const promises = [];
    for (const c of list) {
      const parts = c.participants || [];
      for (const p of parts) {
        if (!p) continue;
        if (typeof p === "string" || typeof p === "number") promises.push(fetchUserToCache(String(p)));
        else if (!p.name && (p._id || p.id)) promises.push(fetchUserToCache(p._id || p.id));
      }
    }
    if (promises.length) await Promise.allSettled(promises);
  }

  // merge incoming conversations into existing list, preserving items not present in server response
  function mergeConversations(existing = [], incoming = []) {
    const map = new Map();
    for (const e of existing) {
      if (!e || !e._id) continue;
      map.set(String(e._id), e);
    }
    for (const i of incoming) {
      if (!i || !i._id) continue;
      const key = String(i._id);
      const prev = map.get(key) || {};
      // keep prev fields unless incoming provides them; incoming wins
      const merged = { ...(prev || {}), ...(i || {}) };
      map.set(key, merged);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const ta = new Date(a.updatedAt || (a.lastMessage && a.lastMessage.createdAt) || 0).getTime();
      const tb = new Date(b.updatedAt || (b.lastMessage && b.lastMessage.createdAt) || 0).getTime();
      return tb - ta;
    });
    return arr.slice(0, 500);
  }

  // Fetch conversations and merge
  async function fetchConversations() {
    setLoading(true);
    setErr("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/messages", { params: { box: "inbox", limit: 100 }, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const list = Array.isArray(data?.conversations) ? data.conversations : [];
      // normalize shape
      const norm = list.map((c) => ({
        _id: c._id || c.id,
        participants: c.participants || [],
        lastMessage: c.lastMessage || null,
        updatedAt: c.updatedAt || (c.lastMessage && c.lastMessage.createdAt) || new Date().toISOString(),
        unread: c.unread || 0,
        optimistic: c.optimistic || false,
      }));
      await preloadParticipants(norm);
      if (!mountedRef.current) return;
      // merge with existing
      setConversations((prev) => {
        const merged = mergeConversations(prev || [], norm || []);
        // auto-select first if none selected and not routed
        if (!routeConvId && !selectedConv && merged.length > 0) {
          const first = merged[0];
          if (first && first._id) {
            setSelectedConv(first._id);
            navigate(`/dashboard/messages/${first._id}`, { replace: true });
          }
        }
        return merged;
      });
    } catch (e) {
      console.error("fetchConversations error", e);
      setErr(e?.response?.data?.message || e?.message || "Failed to load conversations");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // ensure a route conversation is present in list (fetch single conv if needed)
  async function ensureConversationPresent(routeId) {
    if (!routeId) return;
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get(`/api/messages/conversations/${routeId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (data?.conversation) {
        const conv = data.conversation;
        const normalized = {
          _id: conv._id || conv.id,
          participants: conv.participants || [],
          lastMessage: conv.lastMessage || null,
          updatedAt: conv.updatedAt || (conv.lastMessage && conv.lastMessage.createdAt) || new Date().toISOString(),
          unread: 0,
        };
        await preloadParticipants([normalized]);
        setConversations((prev) => mergeConversations(prev || [], [normalized]));
        setSelectedConv(routeId);
      }
    } catch (e) {
      console.warn("ensureConversationPresent failed", e);
    }
  }

  // mark conversation read when opening
  async function markConvRead(convId) {
    if (!convId) return;
    try {
      const token = localStorage.getItem("token");
      await api.post(`/api/messages/conversations/${convId}/read-all`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      // locally set unread to 0
      setConversations((prev) => (prev || []).map((c) => (String(c._id) === String(convId) ? { ...c, unread: 0 } : c)));
    } catch (e) {
      // ignore
      console.warn("markConvRead failed", e);
    }
  }

  // open conversation: navigate + mark read + ensure present
  function openConversation(convId) {
    if (!convId) return;
    setSelectedConv(convId);
    if (!window.location.pathname.includes(convId)) {
      navigate(`/dashboard/messages/${convId}`);
    }
    markConvRead(convId);
    ensureConversationPresent(convId);
  }

  // New conversation (optimistic) from user-provided recipient id (or email)
  async function createConversationForRecipient() {
    if (!newRecipientId) {
      alert("Enter recipient user id (or user id string).");
      return;
    }
    setCreating(true);
    try {
      // optimistic id (temporary)
      const optimisticId = `optim-${Date.now()}`;
      const optimisticConv = {
        _id: optimisticId,
        participants: [myId, newRecipientId],
        lastMessage: { text: "", createdAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
        unread: 0,
        optimistic: true,
      };
      // create cached placeholder for other user to show name if available
      await fetchUserToCache(newRecipientId);

      // merge optimistic convo into list
      setConversations((prev) => mergeConversations(prev || [], [optimisticConv]));
      setSelectedConv(optimisticId);
      navigate(`/dashboard/messages/${optimisticId}`);

      // create on server
      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/messages/conversations", { participantIds: [newRecipientId] }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (data?.conversation) {
        const conv = data.conversation;
        const normalized = {
          _id: conv._1d || conv._id || conv.id,
          participants: conv.participants || [],
          lastMessage: conv.lastMessage || null,
          updatedAt: conv.updatedAt || (conv.lastMessage && conv.lastMessage.createdAt) || new Date().toISOString(),
          unread: 0,
        };
        await preloadParticipants([normalized]);
        // replace optimistic with real conv
        setConversations((prev) =>
          mergeConversations((prev || []).filter((c) => String(c._id) !== String(optimisticId)), [normalized])
        );
        setSelectedConv(normalized._id);
        navigate(`/dashboard/messages/${normalized._id}`, { replace: true });
      } else {
        // remove optimistic if server failed to return conv
        setConversations((prev) => (prev || []).filter((c) => String(c._id) !== String(optimisticId)));
        alert("Failed to create conversation on server.");
      }
    } catch (e) {
      console.error("createConversation error", e);
      alert(e?.response?.data?.message || e?.message || "Create conversation failed");
    } finally {
      setCreating(false);
      setNewRecipientId("");
    }
  }

  // socket setup & polling
  useEffect(() => {
    mountedRef.current = true;
    fetchConversations();

    // connect socket for real-time merge updates
    try {
      const base = getApiBase ? getApiBase() : (api.defaults && api.defaults.baseURL) || window.location.origin;
      const socketBase = base.replace(/\/$/, "");
      const socket = io(socketBase, { transports: ["websocket", "polling"], withCredentials: true });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (myId) socket.emit("auth:handshake", { userId: String(myId) });
      });

      socket.on("message:receive", async (payload) => {
        try {
          // payload often contains message + conversation
          const conv = payload?.conversation || (payload?.message && payload.message.conversation ? { _id: payload.message.conversation, lastMessage: payload.message } : null);
          if (conv) {
            const normalized = {
              _id: conv._id || conv.id || (payload?.message?.conversation) || null,
              participants: conv.participants || payload?.conversation?.participants || [],
              lastMessage: conv.lastMessage || payload?.message || null,
              updatedAt: conv.updatedAt || payload?.message?.createdAt || new Date().toISOString(),
              unread: conv.unread || 0,
            };
            await preloadParticipants([normalized]);
            setConversations((prev) => mergeConversations(prev || [], [normalized]));
          } else {
            fetchConversations();
          }
        } catch (e) {
          console.warn("socket message:receive handler", e);
        }
      });

      socket.on("message:sent", (payload) => {
        try {
          const conv = payload?.conversation;
          if (conv) {
            const normalized = {
              _id: conv._id || conv.id,
              participants: conv.participants || [],
              lastMessage: conv.lastMessage || null,
              updatedAt: conv.updatedAt || new Date().toISOString(),
              unread: conv.unread || 0,
            };
            (async () => {
              await preloadParticipants([normalized]);
              setConversations((prev) => mergeConversations(prev || [], [normalized]));
            })();
          } else {
            fetchConversations();
          }
        } catch (e) {
          console.warn("socket message:sent handler", e);
        }
      });

      socket.on("connect_error", (err) => console.warn("socket connect_error", err));
    } catch (e) {
      console.warn("socket init error", e);
    }

    const poll = setInterval(() => fetchConversations(), 15000);

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      try {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  useEffect(() => {
    if (routeConvId) {
      setSelectedConv(routeConvId);
      ensureConversationPresent(routeConvId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeConvId]);

  // filter by search
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const otherRaw = getOtherParticipant(c.participants, myId);
      const otherObj = typeof otherRaw === "object" ? otherRaw : userCacheRef.current.get(String(otherRaw)) || {};
      const name = (otherObj.name || otherObj.fullName || otherObj.username || otherObj.email || "").toLowerCase();
      const last = (c.lastMessage?.text || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [conversations, query, myId]);

  function ConversationListItem({ conv, isSelected }) {
    const otherRaw = getOtherParticipant(conv.participants, myId);
    let other = null;
    if (typeof otherRaw === "object") other = otherRaw;
    else if (otherRaw != null) other = userCacheRef.current.get(String(otherRaw)) || { _id: otherRaw, name: "Unknown" };
    else other = { name: "Unknown" };

    const name = other.name || other.fullName || other.username || other.email || "Unknown";
    const initials = initialsFromName(name);
    const bg = hashToColor(String(other._id || name));
    const lastText = (conv.lastMessage && (conv.lastMessage.text || conv.lastMessage?.message)) || "";
    const timeLabel = relativeTime(conv.updatedAt);
    const unread = conv.unread || 0;

    return (
      <div
        onClick={() => openConversation(conv._id)}
        role="button"
        className={`flex gap-3 items-center p-3 rounded-lg cursor-pointer ${isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`}
      >
        <div style={{ width: 48, height: 48, minWidth: 48 }}>
          <div style={{ width: 44, height: 44, borderRadius: 9999, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 600 }}>
            {initials}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="font-medium truncate">{name}{conv.optimistic ? " • (pending)" : ""}</div>
            <div className="text-xs text-gray-400 ml-2">{timeLabel}</div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="text-sm truncate" style={{ maxWidth: 200 }}>
              <span className={`${unread > 0 ? "font-semibold text-gray-900" : "text-gray-600"}`}>{lastText || "No messages yet"}</span>
            </div>
            {unread > 0 && (
              <div className="inline-flex items-center justify-center bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {unread}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Messages</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search chats or messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input input-sm"
              style={{ minWidth: 180 }}
            />
            <button className="btn" onClick={fetchConversations} disabled={loading}>Refresh</button>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <input placeholder="Start new - recipient user id" className="input" value={newRecipientId} onChange={(e) => setNewRecipientId(e.target.value)} />
          <button className="btn btn-primary" onClick={createConversationForRecipient} disabled={creating}>{creating ? "Creating…" : "New Message"}</button>
        </div>

        {loading && <div>Loading conversations…</div>}
        {err && <div className="text-red-600">{err}</div>}

        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)", paddingRight: 6 }}>
          {filtered.length === 0 && !loading && <div className="text-sm text-gray-500">No conversations yet.</div>}
          {filtered.map((conv) => (
            <ConversationListItem key={conv._id} conv={conv} isSelected={String(conv._id) === String(selectedConv)} />
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {selectedConv ? (
          <ChatWindow
            conversation={conversations.find((c) => String(c._id) === String(selectedConv)) || { _id: selectedConv, participants: [] }}
            currentUserId={myId}
            onConversationUpdate={() => fetchConversations()}
          />
        ) : (
          <div className="card p-6">
            <div className="text-lg font-semibold">No conversation selected</div>
            <div className="text-sm text-gray-500 mt-2">Select a conversation on the left or start a new message from someone's profile.</div>
            <Link to="/dashboard/directory" className="btn btn-primary mt-4">Find people to message</Link>
          </div>
        )}
      </div>
    </div>
  );
}
