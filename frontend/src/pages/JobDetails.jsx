// frontend/src/pages/JobDetails.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import ApplyJobModal from "../components/ApplyJobModal";
import { useAuth } from "../hooks/useAuth.js";

export default function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openApply, setOpenApply] = useState(false);

  async function fetchJob() {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/jobs/${id}`);
      setJob(data.job);
    } catch (err) {
      console.error("fetch job", err);
      setJob(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchJob(); }, [id]);

  function getPosterId(jobObj) {
    if (!jobObj) return null;
    const pb = jobObj.postedBy;
    if (!pb) return null;
    if (typeof pb === "string") return pb;
    if (pb._id) return pb._id.toString();
    if (pb.id) return pb.id.toString();
    try { return pb.toString(); } catch { return null; }
  }

  const posterId = getPosterId(job);
  const currentUserId = user?.id || user?._id || null;
  const isPoster = currentUserId && posterId && currentUserId.toString() === posterId.toString();

  if (loading) return <div>Loading…</div>;
  if (!job) return <div>Job not found.</div>;

  // contact handling
  const contactHref = job.applicationUrl
    ? job.applicationUrl
    : (job.contactEmail ? `mailto:${job.contactEmail}` : "");
  const contactLabel = job.applicationUrl ? "External Apply" : (job.contactEmail ? "Contact" : "Contact (not set)");
  const contactDisabled = !contactHref;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="text-sm text-gray-600">{job.company} • {job.location} • {job.jobType}</div>
          <p className="mt-4 text-gray-700">{job.description}</p>

          <div className="mt-6">
            <h4 className="font-semibold">Requirements</h4>
            <ul className="mt-2 list-disc list-inside">
              {(job.requirements || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>

          <div className="mt-4">
            <h4 className="font-semibold">Skills</h4>
            <div className="mt-2">{(job.skills || []).map(s => <span key={s} className="pill mr-2">{s}</span>)}</div>
          </div>
        </div>

        <aside className="w-72">
          <div className="card p-4">
            <div className="text-sm text-gray-600">{job.experienceLevel}</div>
            <div className="text-lg font-semibold mt-2">{job.salaryRange || "Salary not specified"}</div>

            <div className="mt-4">
              <button className="btn btn-primary w-full" onClick={() => setOpenApply(true)}>Apply Now</button>

              <button
                type="button"
                className={`btn btn-ghost w-full mt-2 ${contactDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => {
                  if (!contactDisabled) {
                    if (job.applicationUrl) window.open(job.applicationUrl, "_blank", "noopener");
                    else window.location.href = `mailto:${job.contactEmail}`;
                  } else {
                    alert("This job has no application URL or contact email set.");
                  }
                }}
              >
                {contactLabel}
              </button>

              {isPoster && (
                <>
                  {/* use absolute paths so navigation is reliable regardless of nesting */}
                  <Link to={`/dashboard/jobs/${id}/applications`} className="btn btn-outline w-full mt-3">View Applications</Link>
                  <Link to={`/dashboard/jobs/${id}/edit`} className="btn btn-ghost w-full mt-2">Edit Job</Link>

                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <ApplyJobModal open={openApply} job={job} onClose={() => setOpenApply(false)} />
    </div>
  );
}
