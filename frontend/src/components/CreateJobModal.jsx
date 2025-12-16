// frontend/src/components/CreateJobModal.jsx
import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function CreateJobModal({ open, onClose, onCreated }) {
  const { login } = useAuth();
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    jobType: "Full-time",
    experienceLevel: "Entry",
    salaryRange: "",
    description: "",
    requirements: "",
    skills: "",
    applicationUrl: "",
    contactEmail: ""
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleCreate(e) {
    e?.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        company: form.company,
        location: form.location,
        jobType: form.jobType,
        experienceLevel: form.experienceLevel,
        salaryRange: form.salaryRange,
        description: form.description,
        requirements: form.requirements ? form.requirements.split("\n").map(s => s.trim()).filter(Boolean) : [],
        skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        applicationUrl: form.applicationUrl,
        contactEmail: form.contactEmail
      };

      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/jobs", payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (data?.job) {
        // refresh auth user so points update
        try {
          const { data: meData } = await api.get("/api/auth/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (meData?.user) login({ token, user: meData.user });
        } catch (refreshErr) {
          console.warn("Failed to refresh auth user after creating job:", refreshErr);
        }

        // toast
        if (window.showToast && typeof window.showToast === "function") {
          window.showToast("+20 points — for posting a job!");
        } else {
          alert("+20 points — for posting a job!");
        }

        onCreated && onCreated(data.job);
        onClose && onClose();

        // reset
        setForm({
          title: "",
          company: "",
          location: "",
          jobType: "Full-time",
          experienceLevel: "Entry",
          salaryRange: "",
          description: "",
          requirements: "",
          skills: "",
          applicationUrl: "",
          contactEmail: ""
        });
      } else {
        alert("Create returned unexpected response.");
      }
    } catch (err) {
      console.error("create job", err);
      alert(err?.response?.data?.message || "Create job failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-2xl bg-white rounded-xl shadow-xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-600">✕</button>
        <h3 className="font-semibold text-lg">Post a Job</h3>

        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <input className="input" placeholder="Job title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
          <input className="input" placeholder="Company" value={form.company} onChange={e=>setForm({...form, company:e.target.value})} />
          <input className="input" placeholder="Location" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} />

          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.jobType} onChange={e=>setForm({...form, jobType:e.target.value})}>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Internship</option>
              <option>Contract</option>
            </select>
            <select className="input" value={form.experienceLevel} onChange={e=>setForm({...form, experienceLevel:e.target.value})}>
              <option>Entry</option>
              <option>Mid</option>
              <option>Senior</option>
            </select>
          </div>

          <input className="input" placeholder="Salary range" value={form.salaryRange} onChange={e=>setForm({...form, salaryRange:e.target.value})} />

          <textarea className="input" rows={5} placeholder="Job description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}></textarea>

          <textarea className="input" rows={3} placeholder="Requirements (one per line)" value={form.requirements} onChange={e=>setForm({...form, requirements:e.target.value})}></textarea>

          <input className="input" placeholder="Skills (comma separated)" value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})} />
          <input className="input" placeholder="Application URL (optional)" value={form.applicationUrl} onChange={e=>setForm({...form, applicationUrl:e.target.value})} />
          <input className="input" placeholder="Contact email (optional)" value={form.contactEmail} onChange={e=>setForm({...form, contactEmail:e.target.value})} />

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Posting…" : "Post Job"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
