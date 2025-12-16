import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { io } from "socket.io-client";

/**
 * ChatWindow props:
 * - conversation: { _id, participants: [...], lastMessage, updatedAt }
 * - currentUserId: id string
 * - onConversationUpdate: function called to refresh parent list (optional)
 *
 * Improvements in this version:
 * - Resolve participant names if participants array contains only IDs (fetch /api/users/:id)
 * - Show simple initials avatar + name in header
 * - Reuse global socket (window.__app_socket__) if available, otherwise create local socket
 * - Handle optimistic conversation ids (optim-*) when sending the first message
 * - Scroll to bottom whenever messages change
 * - Better error handling and small UX improvements
 */

export default function ChatWindow({ conversation = { _id: null, participants: [] }, currentUserId, onConversationUpdate }) {
  const convId = conversation?._id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState(null); // resolved other participant object

  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  // ----- small helpers -----
  function showLocalToast(msg, opts = {}) {
    if (window.showToast) window.showToast(msg, opts);
  }
  function beepOnce() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 700;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.06, now + 0.001);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.00001, now + 0.14);
      o.stop(now + 0.17);
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 300);
    } catch (e) {
      // ignore
    }
  }

  // ----- fetch other participant when participants may be simple ids -----
  async function resolveOtherParticipant() {
    const parts = conversation?.participants || [];
    if (!parts || parts.length === 0) {
      setOtherUser(null);
      return;
    }
    // find "other" participant (not current user)
    const otherRaw = parts.find((p) => String(p._id || p.id || p) !== String(currentUserId)) || parts[0];
    if (!otherRaw) {
      setOtherUser(null);
      return;
    }

    // if object with name already present, use it
    if (typeof otherRaw === "object" && (otherRaw.name || otherRaw.fullName || otherRaw.email)) {
      setOtherUser(otherRaw);
      return;
    }

    // otherwise try fetch by id
    const id = String(otherRaw);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get(`/api/users/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (data?.user) {
        setOtherUser(data.user);
        return;
      }
    } catch (e) {
      // ignore
    }

    setOtherUser({ _id: id, name: "Unknown" });
  }

  // ----- scroll helper -----
  function scrollToBottom(behavior = "auto") {
    try {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 9999;
    } catch (e) {
      // ignore
    }
  }

  // ----- load messages for conversation -----
  async function loadMessages() {
    if (!convId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get(`/api/messages/conversations/${convId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const msgs = Array.isArray(data?.messages) ? data.messages : [];
      if (!mountedRef.current) return;
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 40);

      // mark read on server (best-effort)
      try {
        await api.post(`/api/messages/conversations/${convId}/read-all`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        onConversationUpdate && onConversationUpdate();
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error("loadMessages err", e);
      setErr(e?.response?.data?.message || e.message || "Failed to load messages");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // ----- mount / socket setup -----
  useEffect(() => {
    mountedRef.current = true;
    resolveOtherParticipant();
    loadMessages();

    // try reuse global socket
    let sock = window.__app_socket__ || null;
    let createdLocal = false;
    if (!sock) {
      try {
        const base = (api.defaults && api.defaults.baseURL) || window.location.origin;
        sock = io(base.replace(/\/$/, ""), { transports: ["websocket", "polling"], withCredentials: true });
        createdLocal = true;
      } catch (e) {
        console.warn("Could not create local socket", e);
      }
    }
    socketRef.current = sock;

    const onMessageReceive = (payload) => {
      try {
        const incomingMsg = payload?.message || payload;
        const incomingConv = payload?.conversation || payload?.conversationId || incomingMsg?.conversation;
        const incomingConvId = incomingConv?._id || incomingConv || payload?.conversationId || incomingMsg?.conversation;
        if (!incomingConvId) return;
        if (String(incomingConvId) !== String(convId)) return; // not for this chat

        setMessages((prev) => {
          const exists = prev.find((m) => String(m._id || m.id) === String(incomingMsg._id || incomingMsg.id));
          if (exists) return prev;
          const next = [...prev, incomingMsg];
          return next;
        });
        setTimeout(() => scrollToBottom(), 40);
        beepOnce();
      } catch (e) {
        console.warn("onMessageReceive error", e);
      }
    };

    if (sock) {
      sock.on("message:receive", onMessageReceive);
      sock.on("message:sent", onMessageReceive);
    }

    return () => {
      mountedRef.current = false;
      if (sock) {
        sock.off("message:receive", onMessageReceive);
        sock.off("message:sent", onMessageReceive);
        if (createdLocal) {
          try { sock.disconnect(); } catch (e) {}
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, JSON.stringify(conversation.participants || [])]);

  // whenever conversation participants change, re-resolve other participant
  useEffect(() => {
    resolveOtherParticipant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(conversation.participants || [])]);

  // scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // ----- send message -----
  async function handleSend(e) {
    e?.preventDefault();
    const txt = (text || "").trim();
    if (!txt) return;

    // determine recipient id — attempt from conversation participants or otherUser
    let recipientId = null;
    const parts = conversation?.participants || [];
    const otherRaw = parts.find((p) => String(p._id || p.id || p) !== String(currentUserId)) || parts[0];
    if (otherRaw) recipientId = (otherRaw._id || otherRaw.id || otherRaw);
    if (!recipientId && otherUser?. _id) recipientId = otherUser._id;

    // optimistic append
    const temp = {
      _id: `tmp-${Date.now()}`,
      conversation: convId,
      from: { _id: currentUserId, name: "You" },
      to: recipientId ? { _id: recipientId } : null,
      text: txt,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, temp]);
    setText("");
    setTimeout(() => scrollToBottom(), 30);

    try {
      const token = localStorage.getItem("token");
      const payload = convId && String(convId).startsWith("optim-") === false ? { conversationId: convId, text: txt } : { toUserId: recipientId, text: txt };
      const { data } = await api.post("/api/messages/send", payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (data?.message) {
        // replace temp with server message
        setMessages((prev) => prev.map((m) => (String(m._id).startsWith("tmp-") && m.text === txt ? data.message : m)));
        onConversationUpdate && onConversationUpdate();
      } else {
        console.warn("send returned unexpected response", data);
      }
    } catch (err) {
      console.error("send message error", err);
      showLocalToast("Send failed — check connection");
    }
  }

  // render header name/initials
  const displayName = otherUser?.name || otherUser?.fullName || otherUser?.email || "Conversation";
  const initials = (displayName || "?")
    .trim()
    .split(/\s+/)
    .map((p) => (p[0] || ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="card p-3 h-[70vh] flex flex-col">
      <div className="border-b pb-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 9999, background: "#6B7280", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            {initials}
          </div>
          <div>
            <div className="font-semibold text-lg">{displayName}</div>
            <div className="text-xs text-gray-500">Conversation ID: {convId || "—"}</div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ overflowY: "auto", flex: 1, padding: 8 }}>
        {loading && <div>Loading messages…</div>}
        {err && <div className="text-red-600">{err}</div>}

        <div className="space-y-3">
          {messages.map((m) => {
            const mine = String(m.from?._id || m.from?.id) === String(currentUserId);
            const key = m._id || m.id || Math.random();
            return (
              <div key={key} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] p-2 rounded ${mine ? "bg-blue-600 text-white" : "bg-gray-100 text-black"}`}>
                  <div className="text-xs text-gray-500 mb-1">{!mine ? (m.from?.name || m.from?.email || "User") : "You"}</div>
                  <div>{m.text}</div>
                  <div className="text-[11px] text-gray-400 mt-1 text-right">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2 items-center">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="input flex-1" />
        <button type="submit" className="btn btn-primary">Send</button>
      </form>
    </div>
  );
}
