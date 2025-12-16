// frontend/src/components/MentorApplicationModal.jsx
import { useState, useEffect } from "react";
import api from "../lib/api";

export default function MentorApplicationModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    expertise: "",
    bio: "",
    availability: "",
    sessionTypes: "",
    languages: "",
    maxMentees: 1,
    preferredDurationMinutes: 60,
    linkedin: "",
    website: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // fetch existing
    (async () => {
      try {
        const { data } = await api.get("/api/mentorship/profile/me");
        if (data.profile) {
          setForm({
            expertise: (data.profile.expertise || []).join(", "),
            bio: data.profile.bio || "",
            availability: data.profile.availability || "",
            sessionTypes: (data.profile.sessionTypes || []).join(", "),
            languages: (data.profile.languages || []).join(", "),
            maxMentees: data.profile.maxMentees || 1,
            preferredDurationMinutes: data.profile.preferredDurationMinutes || 60,
            linkedin: data.profile.linkedin || "",
            website: data.profile.website || ""
          });
        }
      } catch (err) { /* ignore */ }
    })();
  }, [open]);

  async function save(e) {
    e?.preventDefault();
    setLoading(true);
    try {
      const payload = {
        expertise: form.expertise ? form.expertise.split(",").map(s=>s.trim()).filter(Boolean) : [],
        bio: form.bio,
        availability: form.availability,
        sessionTypes: form.sessionTypes ? form.sessionTypes.split(",").map(s=>s.trim()).filter(Boolean) : [],
        languages: form.languages ? form.languages.split(",").map(s=>s.trim()).filter(Boolean) : [],
        maxMentees: Number(form.maxMentees) || 1,
        preferredDurationMinutes: Number(form.preferredDurationMinutes) || 60,
        linkedin: form.linkedin,
        website: form.website
      };
      const { data } = await api.post("/api/mentorship/apply", payload);
      onSaved && onSaved(data.profile);
      onClose();
    } catch (err) {
      alert(err?.response?.data?.message || "Save failed");
    } finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 grid place-items-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <form className="relative bg-white rounded-lg shadow-xl p-6 w-[720px] max-w-full" onSubmit={save}>
        <h3 className="text-lg font-semibold mb-2">Apply to become a mentor</h3>
        <div className="grid gap-2">
          <label className="text-sm">Expertise (comma separated)</label>
          <input className="input" value={form.expertise} onChange={e=>setForm({...form, expertise: e.target.value})} />
          <label className="text-sm">Bio</label>
          <textarea className="input" rows={4} value={form.bio} onChange={e=>setForm({...form, bio: e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">Availability</label>
              <input className="input" value={form.availability} onChange={e=>setForm({...form, availability:e.target.value})} />
            </div>
            <div>
              <label className="text-sm">Session types (comma)</label>
              <input className="input" value={form.sessionTypes} onChange={e=>setForm({...form, sessionTypes:e.target.value})} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Submit Application"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
