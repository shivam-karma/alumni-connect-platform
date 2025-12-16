import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

function ApplicationDetailModal({ open, app, onClose }) {
  if (!open || !app) return null;
  const applicant = app.applicant || {};
  const name = app.name || applicant.name || "Unknown";
  const email = app.email || applicant.email || "";
  const phone = app.phone || applicant.phone || "";
  const yearsExperience = app.yearsExperience || app.yearsExperience === 0 ? app.yearsExperience : (app.applicant?.yearsExperience || "");
  const coverLetter = app.coverLetter || "";
  const resumeUrlRaw = app.resumeUrl || app.resume || app.resume_path || null;
  const resumeUrl = resumeUrlRaw ? (resumeUrlRaw.startsWith("http") ? resumeUrlRaw : `${window.location.origin}${resumeUrlRaw}`) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-xl bg-white rounded-xl shadow-xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-600">✕</button>
        <h3 className="font-semibold text-lg">Application — {name}</h3>

        <div className="mt-4 space-y-3 text-sm text-gray-800">
          <div><strong>Email:</strong> {email}</div>
          <div><strong>Phone:</strong> {phone || "—"}</div>
          <div><strong>Experience:</strong> {yearsExperience || "—"}</div>
          <div><strong>Submitted:</strong> {app.createdAt ? new Date(app.createdAt).toLocaleString() : "—"}</div>

          <div>
            <strong>Cover Letter:</strong>
            <div className="mt-2 p-3 bg-gray-50 rounded text-sm">{coverLetter || "No cover letter provided."}</div>
          </div>

          <div>
            <strong>Resume:</strong>
            <div className="mt-2">
              {resumeUrl ? (
                <a className="btn btn-ghost" href={resumeUrl} target="_blank" rel="noreferrer">Download / View Resume</a>
              ) : (
                <div className="text-xs text-gray-500">No resume uploaded</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-right">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function JobApplications() {
  const { id } = useParams(); // job id
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewing, setViewing] = useState(null); // the application we're viewing

  // fetch applications for a job (includes token header)
  async function fetchApplications(jobId) {
    if (!jobId) throw new Error("Missing job id");
    setErr("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get(`/api/jobs/${jobId}/applications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const list = Array.isArray(data?.applications) ? data.applications : [];
      return list;
    } catch (err) {
      console.error("fetchApplications", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to load applications";
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) {
        setErr("Job id not provided");
        setApps([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const list = await fetchApplications(id);
        if (!mounted) return;
        setApps(list);
      } catch (e) {
        if (!mounted) return;
        setErr(e.message || "Error fetching applications");
        setApps([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Loading applications…</div>;
  if (err) return <div className="text-red-600">{err}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Applications</h2>
        <Link to={`/dashboard/jobs/${id}`} className="btn btn-ghost">Back to Job</Link>
      </div>

      {apps.length === 0 && <div className="text-sm text-gray-500">No applications yet.</div>}

      <div className="space-y-3">
        {apps.map(a => {
          const applicant = a.applicant || {};
          const name = a.name || applicant.name || "Unknown";
          const email = a.email || applicant.email || "";
          const resumeUrlRaw = a.resumeUrl || a.resume || a.resume_path || null;
          const createdAt = a.createdAt || a.appliedAt || null;
          const resumeUrl = resumeUrlRaw ? (resumeUrlRaw.startsWith("http") ? resumeUrlRaw : `${window.location.origin}${resumeUrlRaw}`) : null;

          const key = a._id || a.id || `${email}-${createdAt || Math.random()}`;

          return (
            <div key={key} className="card p-4 flex items-start justify-between">
              <div>
                <div className="font-semibold">{name}</div>
                <div className="text-sm text-gray-600">{email}</div>
                {a.phone && <div className="text-sm mt-1">Phone: {a.phone}</div>}
                {a.coverLetter && <div className="mt-2 text-sm">{a.coverLetter.length > 120 ? a.coverLetter.slice(0, 120) + "…" : a.coverLetter}</div>}
                {applicant.title && <div className="text-xs text-gray-500 mt-2">{applicant.title}{applicant.company ? ` • ${applicant.company}` : ""}</div>}
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => setViewing(a)}>View Details</button>
                  {resumeUrl ? <a className="btn btn-ghost" href={resumeUrl} target="_blank" rel="noreferrer">Resume</a> : null}
                </div>
                <div className="text-xs text-gray-500">{createdAt ? new Date(createdAt).toLocaleString() : ""}</div>
              </div>
            </div>
          );
        })}
      </div>

      <ApplicationDetailModal open={!!viewing} app={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
