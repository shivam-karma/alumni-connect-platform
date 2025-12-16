import { useEffect, useState } from "react";
import api from "../lib/api";

/**
 * ConnectModal — send a connection request.
 * - Tries JSON payload with multiple common field names (toId, to, toUserId)
 * - If server returns 400, retries as FormData.
 * - Shows server message in modal and logs full response for debugging.
 */
export default function ConnectModal({ open, onClose, toId, toName, onSent }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null); // { ok: true/false, msg: string }

  useEffect(() => {
    if (!open) {
      setNote("");
      setResp(null);
    }
  }, [open]);

  useEffect(() => {
    if (resp) {
      const t = setTimeout(() => setResp(null), 3500);
      return () => clearTimeout(t);
    }
  }, [resp]);

  if (!open) return null;

  async function handleSendRequest(e) {
    e?.preventDefault();
    setResp(null);

    if (!toId) {
      setResp({ ok: false, msg: "Missing recipient id (toId)." });
      return;
    }

    setLoading(true);

    // Prepare payloads
    const jsonPayload = {
      // include multiple keys — backend may expect any of these
      toId,
      to: toId,
      toUserId: toId,
      message: note || "",
    };

    // Helper to show and log error
    function showErr(err, noteStr = "") {
      console.error("send connection request error:", err);
      const serverMsg = err?.response?.data?.message || err?.message || noteStr || "Request failed";
      setResp({ ok: false, msg: serverMsg });
    }

    try {
      console.debug("Sending connection request (JSON) to /api/connections/request", jsonPayload);
      const token = localStorage.getItem("token");
      const res = await api.post("/api/connections/request", jsonPayload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      console.debug("request response", res?.data);
      setResp({ ok: true, msg: "Request sent successfully!" });
      if (typeof onSent === "function") onSent();
    } catch (err) {
      // If server returned 400 Bad Request, try FormData fallback
      const status = err?.response?.status;
      console.warn("JSON send failed, status:", status, err?.response?.data || err.message);

      if (status === 400) {
        // attempt FormData fallback (some servers expect urlencoded/form data)
        try {
          const fd = new FormData();
          fd.append("toId", toId);
          fd.append("to", toId);
          fd.append("toUserId", toId);
          fd.append("message", note || "");

          console.debug("Retrying with FormData");
          const token = localStorage.getItem("token");
          const res2 = await api.post("/api/connections/request", fd, {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                  // DO NOT set Content-Type, let browser set the multipart boundary
                }
              : {},
          });
          console.debug("FormData response", res2?.data);
          setResp({ ok: true, msg: "Request sent successfully (FormData)!" });
          if (typeof onSent === "function") onSent();
        } catch (err2) {
          // final failure: show server msg
          showErr(err2, "FormData retry failed");
        }
      } else {
        // other non-400 errors (401/403/etc) or network errors
        showErr(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <form
        onSubmit={handleSendRequest}
        className="relative w-[92%] max-w-md bg-white rounded-xl shadow-xl p-4"
      >
        <button type="button" onClick={onClose} className="absolute right-3 top-3 text-gray-600">
          ✕
        </button>

        <h3 className="font-semibold">Connect with {toName || "this user"}</h3>
        <p className="text-sm text-gray-600 mt-1">Write a short note (optional)</p>

        <textarea
          className="input w-full mt-3"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hi — I'd like to connect because..."
        />

        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>
            {loading ? "Sending…" : "Send Request"}
          </button>
        </div>

        <div className={`mt-3 text-sm text-center ${resp ? "opacity-100" : "opacity-0"} transition-opacity`}>
          <span className={resp?.ok ? "text-green-600" : "text-red-600"}>{resp?.msg}</span>
        </div>
      </form>
    </div>
  );
}
