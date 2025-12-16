// frontend/src/components/MessageInput.jsx
import { useState } from "react";

export default function MessageInput({ onSend }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText("");
    } catch (err) {
      console.error("MessageInput send failed", err);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input placeholder="Type a message…" className="input flex-1" value={text} onChange={e=>setText(e.target.value)} />
      <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send"}</button>
    </form>
  );
}
