// frontend/src/pages/EditJob.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function EditJob() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    jobType: "",
    experienceLevel: "",
    salaryRange: "",
    description: "",
    requirements: "",
    skills: "",
    applicationUrl: "",
    contactEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/jobs/${id}`);
        if (!mounted) return;
        setJob(data.job);
        setForm({
          title: data.job.title || "",
          company: data.job.company || "",
          location: data.job.location || "",
          jobType: data.job.jobType || "",
          experienceLevel: data.job.experienceLevel || "",
          salaryRange: data.job.salaryRange || "",
          description: data.job.description || "",
          requirements: (data.job.requirements || []).join("\n"),
          skills: (data.job.skills || []).join(", "),
          applicationUrl: data.job.applicationUrl || "",
          contactEmail: data.job.contactEmail || "",
        });
      } catch (err) {
        console.error("fetch job for edit", err);
        setJob(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    setMsg("");
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
        contactEmail: form.contactEmail,
      };

      const token = localStorage.getItem("token");
      await api.put(`/api/jobs/${id}`, payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      setMsg("Saved.");
      // redirect to dashboard job details
      navigate(`/dashboard/jobs/${id}`);
    } catch (err) {
      console.error("save job", err);
      setMsg(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  if (loading) return <div>Loading…</div>;
  if (!job) return <div>Job not found or you don't have permission to edit.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Edit Job</h1>
      </div>

      <form className="card p-4" onSubmit={handleSave}>
        <div className="grid md:grid-cols-2 gap-4">
          <input className="input" value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Job title" required />
          <input className="input" value={form.company} onChange={e => setField("company", e.target.value)} placeholder="Company" />
          <input className="input" value={form.location} onChange={e => setField("location", e.target.value)} placeholder="Location" />
          <input className="input" value={form.jobType} onChange={e => setField("jobType", e.target.value)} placeholder="Type (Full-time / Part-time / Internship)" />
          <input className="input" value={form.experienceLevel} onChange={e => setField("experienceLevel", e.target.value)} placeholder="Experience level" />
          <input className="input" value={form.salaryRange} onChange={e => setField("salaryRange", e.target.value)} placeholder="Salary range" />
          <textarea className="input md:col-span-2" rows={6} value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Job description" />
          <textarea className="input" rows={4} value={form.requirements} onChange={e => setField("requirements", e.target.value)} placeholder="Requirements (one per line)" />
          <input className="input" value={form.skills} onChange={e => setField("skills", e.target.value)} placeholder="Skills (comma separated)" />
          <input className="input" value={form.applicationUrl} onChange={e => setField("applicationUrl", e.target.value)} placeholder="External application URL" />
          <input className="input" value={form.contactEmail} onChange={e => setField("contactEmail", e.target.value)} placeholder="Contact email" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="ml-auto text-sm text-gray-600">{msg}</div>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save job"}</button>
        </div>
      </form>
    </div>
  );
}
