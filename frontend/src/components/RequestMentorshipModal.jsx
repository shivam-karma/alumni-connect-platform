// frontend/src/components/RequestMentorshipModal.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

export default function RequestMentorshipModal({ open, onClose, mentor, onSent }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setMessage("");
      setResp(null);
    } else if (mentor) {
      // suggested default title
      setTitle(`${mentor.user?.name ? "Mentorship with " + mentor.user.name : "Mentorship request"}`);
    }
  }, [open, mentor]);

  if (!open) return null;

  async function handleSend(e) {
    e?.preventDefault();
    if (!mentor) return;
    setLoading(true);
    setResp(null);

    try {
      const toId = mentor.user?._id || mentor.user?.id || mentor.userId;
      if (!toId) throw new Error("Invalid mentor id");

      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const { data } = await api.post("/api/mentorship/request", { toId, title, message }, { headers });
      setResp({ ok: true, msg: "Request sent" });
      onSent && onSent(data.request);
      // keep modal open for a moment to show response, then close automatically
      setTimeout(() => {
        setLoading(false);
        onClose && onClose();
      }, 700);
    } catch (err) {
      console.error("send mentorship request", err);
      setResp({ ok: false, msg: err?.response?.data?.message || (err.message || "Request failed") });
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />
      <form className="relative w-[92%] max-w-xl bg-white rounded-xl shadow-xl p-5 transform transition duration-150" onSubmit={handleSend}>
        <button type="button" onClick={() => !loading && onClose?.()} className="absolute right-3 top-3 text-gray-600">✕</button>

        <h3 className="text-lg font-semibold">Request Mentorship {mentor?.user?.name ? `— ${mentor.user.name}` : ""}</h3>
        <p className="text-sm text-gray-600 mt-1">Write a short title and message to introduce yourself and your goals.</p>

        <div className="mt-4">
          <label className="block text-sm mb-1">Title</label>
          <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        <div className="mt-3">
          <label className="block text-sm mb-1">Message (optional)</label>
          <textarea rows={5} className="input w-full" value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi — I'd like mentorship on..." />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn" onClick={() => !loading && onClose?.()} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>{loading ? "Sending…" : "Send Request"}</button>
        </div>

        {resp && (
          <div className={`mt-3 text-sm ${resp.ok ? "text-green-600" : "text-red-600"}`}>
            {resp.msg}
          </div>
        )}
      </form>
    </div>
  );
}
