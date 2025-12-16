// EditProfile.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function EditProfile() {
  const { user, token, login } = useAuth(); // login used to update stored user after save
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "", title: "", company: "", location: "", phone: "", website: "",
    linkedin: "", github: "", bio: "", skills: "", department: "", batch: "",
    isMentor: false, achievements: "", // achievements as newline/CSV for convenience
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      title: user.title || "",
      company: user.company || "",
      location: user.location || "",
      phone: user.phone || "",
      website: user.website || "",
      linkedin: user.linkedin || "",
      github: user.github || "",
      bio: user.bio || "",
      skills: (user.skills || []).join(", "),
      department: user.department || "",
      batch: user.batch || "",
      isMentor: !!user.isMentor,
      achievements: (user.achievements || []).join("\n"),
    });
  }, [user]);

 async function handleSave(e) {
  e.preventDefault();
  setLoading(true);
  setMsg("");

  if (!user || !user.id) {
    setMsg("Save failed: missing user id (not authenticated).");
    setLoading(false);
    return;
  }

  try {
    const payload = {
      name: form.name,
      title: form.title,
      company: form.company,
      location: form.location,
      phone: form.phone,
      website: form.website,
      linkedin: form.linkedin,
      github: form.github,
      bio: form.bio,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      department: form.department,
      batch: form.batch,
      isMentor: !!form.isMentor,
      achievements: form.achievements ? form.achievements.split("\n").map(a => a.trim()).filter(Boolean) : []
    };

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // NOTE: use PATCH (server expects PATCH in the robust handler)
    const { data } = await api.patch(`/api/users/${user.id}`, payload, { headers });

    // update user in context so NavBar/profile reflect changes
    login({ token, user: data.user });

    setMsg("Profile saved.");
  } catch (err) {
    // detailed error handling for debugging + user-friendly message
    console.error("Profile save error (full):", err);
    if (err.response) {
      console.error("Response data:", err.response.data);
      console.error("Response status:", err.response.status);
      console.error("Response headers:", err.response.headers);
      const serverMessage =
        err.response.data?.message ||
        (err.response.data?.errors && JSON.stringify(err.response.data.errors)) ||
        err.response.statusText;
      setMsg(`Save failed: ${serverMessage} (status ${err.response.status})`);
    } else if (err.request) {
      // Request was made but no response
      console.error("No response received (request):", err.request);
      setMsg("Save failed: no response from server. Check network or server logs.");
    } else {
      console.error("Request setup error:", err.message);
      setMsg(`Save failed: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
}

  return (
    <div>
      <div className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <button className="btn" onClick={()=>nav(-1)}>Back</button>
        </div>

        <form className="mt-4 grid md:grid-cols-2 gap-4" onSubmit={handleSave}>
          <div>
            <label className="block text-sm mb-1">Full name</label>
            <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
          </div>

          <div>
            <label className="block text-sm mb-1">Title</label>
            <input className="input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Company</label>
            <input className="input" value={form.company} onChange={e=>setForm({...form, company:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Location</label>
            <input className="input" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Department</label>
            <input className="input" value={form.department} onChange={e=>setForm({...form, department:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Batch / Year</label>
            <input className="input" value={form.batch} onChange={e=>setForm({...form, batch:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input className="input" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
          </div>

          <div>
            <label className="block text-sm mb-1">Website</label>
            <input className="input" value={form.website} onChange={e=>setForm({...form, website:e.target.value})} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Bio</label>
            <textarea className="input" rows="4" value={form.bio} onChange={e=>setForm({...form, bio:e.target.value})} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Skills (comma separated)</label>
            <input className="input" value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Achievements (one per line)</label>
            <textarea className="input" rows="4" value={form.achievements} onChange={e=>setForm({...form, achievements:e.target.value})} />
          </div>

          <div className="md:col-span-2 flex items-center gap-3 mt-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isMentor} onChange={e=>setForm({...form, isMentor:e.target.checked})} /> Available for mentoring</label>
            <div className="ml-auto text-sm text-gray-600">{msg}</div>
            <button className="btn btn-primary" disabled={loading} type="submit">{loading ? "Saving..." : "Save profile"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
