// frontend/src/pages/EditNews.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function EditNews() {
  const { id } = useParams();
  const nav = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    category: "Latest News",
    tags: "",
    imageUrl: "",
    featured: false
  });

  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/news/${id}`);
        if (!mounted) return;
        if (data?.news) {
          setItem(data.news);
          setForm({
            title: data.news.title || "",
            summary: data.news.summary || "",
            body: data.news.body || "",
            category: data.news.category || "Latest News",
            tags: (data.news.tags || []).join(", "),
            imageUrl: data.news.imageUrl || "",
            featured: !!data.news.featured
          });
          setPreview(data.news.imageUrl || null);
        } else {
          setItem(null);
        }
      } catch (err) {
        console.error("fetch news for edit", err);
        setItem(null);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
    return () => { mounted = false; };
  }, [id]);

  // use fetch to upload (reliable even if axios has JSON interceptor)
async function handleImageChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Show preview
  const reader = new FileReader();
  reader.onload = () => setPreview(reader.result);
  reader.readAsDataURL(file);

  setUploading(true);
  try {
    const fd = new FormData();
    fd.append("image", file);

    // ⚠️ Important: Use full backend URL if frontend runs on 5173
    const response = await fetch("http://localhost:5000/api/uploads/news", {
      method: "POST",
      body: fd,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Upload failed");
    }

    const data = await response.json(); // Will parse clean JSON now
    if (data?.url) {
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
      console.log("✅ Uploaded image URL:", data.url);
    } else {
      alert("Upload succeeded but no URL returned.");
    }
  } catch (err) {
    console.error("❌ Upload failed:", err);
    alert(err.message || "Image upload failed.");
  } finally {
    setUploading(false);
  }
}



  async function handleSave(e) {
    e?.preventDefault();
    if (!item) return alert("No news loaded");
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        body: form.body,
        category: form.category,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        imageUrl: form.imageUrl,
        featured: !!form.featured
      };
      const token = localStorage.getItem("token");
      const res = await api.put(`/api/news/${id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      // success
      alert("News updated");
      nav(-1); // go back
    } catch (err) {
      console.error("save news", err);
      // show server message if present
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading…</div>;
  if (!item) return <div>News not found or you might not be the author.</div>;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold">Edit News</h2>
      <form className="mt-4 space-y-3" onSubmit={handleSave}>
        <input className="input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
        <input className="input" value={form.summary} onChange={e=>setForm({...form, summary:e.target.value})} placeholder="Short summary" />
        <textarea className="input" rows={8} value={form.body} onChange={e=>setForm({...form, body:e.target.value})}></textarea>
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
            <option value="Latest News">Latest News</option>
            <option value="Announcements">Announcements</option>
            <option value="Success Story">Success Stories</option>
          </select>
          <input className="input" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} placeholder="Tags (comma separated)" />
        </div>

        <div className="grid grid-cols-2 items-center gap-3">
          <label className="text-sm text-gray-700">Image (optional)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </div>

        {uploading && <div className="text-sm text-gray-500">Uploading image…</div>}
        {preview && <img src={preview} alt="preview" className="max-h-48 rounded" />}

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.featured} onChange={e=>setForm({...form, featured:e.target.checked})} />
          Feature this post
        </label>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn" onClick={()=>nav(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || uploading}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
