// frontend/src/components/MessageModal.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function MessageModal({ open, onClose, toId, toName, onSent }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setText("");
      setStatus(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSend(e) {
    e?.preventDefault();
    if (!toId) {
      setStatus({ ok: false, message: "Missing recipient." });
      return;
    }
    if (!text.trim()) {
      setStatus({ ok: false, message: "Please write a message." });
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const token = localStorage.getItem("token");

      // payload: conversationId optional; toUserId required for new conversation
      const payload = {
        conversationId: null, // if you have conversation id, pass it here
        toUserId: toId,
        text: text.trim(),
        attachments: [] // add attachments if you implement upload
      };

      // Use the '/api/messages/send' endpoint (matches ChatWindow and server examples)
      const { data } = await api.post("/api/messages/send", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      // server returned { message, conversation } — pass to caller
      setStatus({ ok: true, message: "Message sent." });
      setText("");

      // call onSent if provided (give server response so caller may navigate / update)
      if (typeof onSent === "function") {
        try { onSent(data); } catch (e) { /* ignore */ }
      }

      // If server returned conversation id, go to messages page for that conversation
      const convId = data?.conversation?._id || data?.conversation?.id;
      if (convId) {
        // small delay so user sees success message briefly
        setTimeout(() => {
          onClose && onClose();
          navigate(`/dashboard/messages/${convId}`);
        }, 250);
      } else {
        // fallback: go to messages list
        setTimeout(() => {
          onClose && onClose();
          navigate(`/dashboard/messages`);
        }, 250);
      }
    } catch (err) {
      console.error("send message", err);
      const msg = err?.response?.data?.message || err?.message || "Send failed";
      setStatus({ ok: false, message: msg });
      // leave modal open so user can retry
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-[92%] max-w-lg bg-white rounded-xl shadow-xl p-4">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-600">✕</button>
        <h3 className="font-semibold">Message {toName || "user"}</h3>

        <form onSubmit={handleSend}>
          <div className="mt-3">
            <textarea
              className="input w-full"
              rows={5}
              placeholder={`Write your message to ${toName || "user"}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="btn btn-primary ml-auto" disabled={sending}>
              {sending ? "Sending…" : "Send Message"}
            </button>
          </div>

          {status && (
            <div className={`mt-3 text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
              {status.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
