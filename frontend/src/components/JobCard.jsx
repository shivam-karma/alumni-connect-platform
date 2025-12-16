// frontend/src/components/JobCard.jsx
import { Link } from "react-router-dom";

export default function JobCard({ job, onApply }) {
  const id = job._id || job.id;
  return (
    <div className="card p-4">
      <div className="flex justify-between">
        <div className="flex-1">
          <div className="text-lg font-semibold">{job.title} {job.featured && <span className="px-2 py-1 ml-2 bg-yellow-100 text-yellow-800 rounded-full text-xs">Featured</span>}</div>
          <div className="text-sm text-gray-600">{job.company} • {job.location} • {job.jobType} • {job.experienceLevel}</div>
          <p className="text-sm text-gray-700 mt-3">{job.description?.slice(0, 240)}{job.description?.length > 240 ? "…" : ""}</p>
          <div className="mt-3">
            {(job.skills || []).slice(0,6).map(s => <span key={s} className="pill mr-2">{s}</span>)}
          </div>
        </div>
        <div className="w-40 flex flex-col items-end">
          <div className="text-sm text-gray-500">{new Date(job.createdAt || Date.now()).toLocaleDateString()}</div>
          <div className="mt-auto">
            <Link to={`/jobs/${id}`} className="btn btn-ghost">View Details</Link>
            <button className="btn btn-primary mt-2" onClick={() => onApply(job)}>Apply Now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
