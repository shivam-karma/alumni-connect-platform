// frontend/src/components/CreateNewsModal.jsx
import { useState, useEffect } from "react";
import api from "../lib/api"; // still used for baseURL if needed
import { useAuth } from "../hooks/useAuth.js";

export default function CreateNewsModal({ open, onClose, onCreated }) {
  const { login } = useAuth(); // refresh user after posting
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    category: "Latest News",
    tags: "",
    imageUrl: "",
    featured: false,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        try {
          URL.revokeObjectURL(previewBlobUrl);
        } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBlobUrl]);

  if (!open) return null;

  // ---- Use native fetch for multipart upload (more predictable than axios here) ----
  async function handleImageChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // client-side validation
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      alert("Image too large. Max 10 MB allowed.");
      try { e.target.value = null; } catch (_) {}
      return;
    }

    // createObjectURL preview
    if (previewBlobUrl) {
      try { URL.revokeObjectURL(previewBlobUrl); } catch (_) {}
      setPreviewBlobUrl(null);
    }
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
    setPreviewBlobUrl(blobUrl);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file); // must match backend field name

      // log FormData entries for debugging (cannot directly log file contents fully)
      for (const pair of fd.entries()) {
        console.log("FormData:", pair[0], pair[1]);
      }

      // build absolute URL from api base or window.location
      const base = (api.defaults && api.defaults.baseURL) || window.location.origin;
      const uploadUrl = base.replace(/\/$/, "") + "/api/uploads/news";

      const token = localStorage.getItem("token");

      // Use fetch — do NOT set Content-Type; browser will set multipart boundary
      const resp = await fetch(uploadUrl, {
        method: "POST",
        body: fd,
        credentials: "include", // send cookies if any
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // do NOT set 'Content-Type'
        },
      });

      // Read response body (try JSON, fallback to text)
      let body;
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        body = await resp.json();
      } else {
        body = await resp.text();
      }

      console.log("upload response status:", resp.status, body);

      if (!resp.ok) {
        // Show server message if present
        const msg = (body && (body.message || body.error)) || `Upload failed (${resp.status})`;
        throw new Error(msg);
      }

      // Accept common variations
      let url = (body && (body.url || body.path || body.filePath || body.filename || body.file)) || null;
      if (!url && typeof body === "string" && body.length > 0) {
        // sometimes backend returns a plain path string
        url = body;
      }

      if (!url) {
        console.warn("Upload succeeded but no URL returned:", body);
        alert("Upload succeeded but server didn't return an image URL.");
        setForm((prev) => ({ ...prev, imageUrl: "" }));
        return;
      }

      if (typeof url === "string" && url.startsWith("/")) {
        url = base.replace(/\/$/, "") + url;
      }

      // HEAD check (optional)
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (!head.ok) console.warn("HEAD check failed for uploaded file:", head.status, url);
      } catch (headErr) {
        console.warn("HEAD check threw:", headErr);
      }

      setForm((prev) => ({ ...prev, imageUrl: url }));
      setPreview(url);

      // cleanup blob url if swapped
      try {
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
        }
      } catch (e) {}
    } catch (err) {
      console.error("image upload error:", err);
      // Show a useful message
      alert(err?.message || "Upload failed. Check server logs or response in DevTools Network tab.");
      setPreview(null);
      setForm((prev) => ({ ...prev, imageUrl: "" }));
      try { e.target.value = null; } catch (_) {}
    } finally {
      setUploading(false);
    }
  }

  // Create news post (unchanged)
  async function handleCreate(e) {
    e?.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        body: form.body,
        category: form.category,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        imageUrl: form.imageUrl,
        featured: !!form.featured,
      };

      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/news", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (data?.news) {
        try {
          const { data: meData } = await api.get("/api/auth/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (meData?.user) login({ token, user: meData.user });
        } catch (refreshErr) {
          console.warn("Failed to refresh auth user after creating news:", refreshErr);
        }

        if (window.showToast && typeof window.showToast === "function") {
          window.showToast("+15 points — for posting news!");
        } else {
          alert("+15 points — for posting news!");
        }

        onCreated && onCreated(data.news);
        onClose && onClose();
        setForm({
          title: "",
          summary: "",
          body: "",
          category: "Latest News",
          tags: "",
          imageUrl: "",
          featured: false,
        });
        setPreview(null);
      } else {
        alert("Create returned unexpected response.");
      }
    } catch (err) {
      console.error("create news", err);
      alert(err?.response?.data?.message || err?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-2xl bg-white rounded-xl shadow-xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-600 hover:text-gray-800">✕</button>
        <h3 className="font-semibold text-lg mb-3">Post News / Announcement</h3>

        <form onSubmit={handleCreate} className="space-y-3">
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="input" placeholder="Short summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <textarea className="input" rows={6} placeholder="Full content" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="Latest News">Latest News</option>
              <option value="Announcements">Announcements</option>
              <option value="Success Story">Success Stories</option>
            </select>
            <input className="input" placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <label className="text-sm text-gray-600">Image (optional)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </div>

          {uploading && <div className="text-sm text-gray-500">Uploading image…</div>}

          {preview && (
            <div className="mt-2">
              <div className="text-xs text-gray-600 mb-1">Preview</div>
              <img src={preview} alt="preview" className="max-h-48 rounded shadow object-contain" />
            </div>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Feature this post
          </label>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || uploading}>{loading ? "Posting…" : "Post News"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
