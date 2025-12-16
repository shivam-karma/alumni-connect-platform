import { useState, useEffect } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function ApplyJobModal({ open, job, onClose, onApplied }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [yearsExperience, setYearsExperience] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
    // reset other fields when modal opens/closes
    if (!open) {
      setYearsExperience("");
      setCoverLetter("");
      setFile(null);
      setError("");
      setLoading(false);
    }
  }, [open, user]);

  if (!open) return null;

  function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    if (!job?.id && !job?._id) return setError("Missing job id");

    // minimal validation required fields
    if (!name || !email) {
      setError("Name and email are required");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      // fields front-end will send; backend should accept them
      fd.append("name", name);
      fd.append("email", email);
      if (phone) fd.append("phone", phone);
      if (yearsExperience) fd.append("yearsExperience", yearsExperience);
      if (coverLetter) fd.append("coverLetter", coverLetter);
      if (file) fd.append("resume", file); // multer expects 'resume' as in backend
      const token = localStorage.getItem("token");

      const res = await api.post(`/api/jobs/${job._id || job.id}/apply`, fd, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
        // DO NOT set Content-Type - let browser/axios set boundary
      });

      const application = res.data.application || res.data;
      onApplied && onApplied(application);
      onClose && onClose();
    } catch (err) {
      console.error("apply job", err);
      const serverMsg = err?.response?.data?.message || err?.message || "Apply failed";
      setError(serverMsg);
      // lightweight user feedback
      alert(serverMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form className="relative w-[92%] max-w-lg bg-white rounded-xl shadow-xl p-6" onSubmit={handleSubmit}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 text-gray-600">✕</button>
        <h3 className="font-semibold text-lg">Apply for {job?.title || "this role"}</h3>

        <div className="grid grid-cols-1 gap-2 mt-3">
          <label className="text-sm">Full name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />

          <label className="text-sm">Email *</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />

          <label className="text-sm">Phone</label>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 99999..." />

          <label className="text-sm">Years of experience</label>
          <input className="input" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="e.g., 2-4" />

          <label className="text-sm">Cover letter (optional)</label>
          <textarea className="input" rows={5} placeholder="Tell them why you're a great fit..." value={coverLetter} onChange={e => setCoverLetter(e.target.value)} />
        </div>

        <div className="mt-3">
          <label className="text-sm text-gray-600">Upload resume (optional - PDF, DOC, DOCX)</label>
          <input type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />
        </div>

        {error && <div className="text-red-600 mt-2">{error}</div>}

        <div className="mt-4 flex gap-3 justify-end">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Applying…" : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
