// frontend/src/components/RecommendationsPanel.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import { Link } from "react-router-dom";

export default function RecommendationsPanel() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecs();
  }, []);

  async function fetchRecs() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/recommendations/jobs", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch (e) {
      console.error("recommendations error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Recommended Jobs</div>
        <button className="btn btn-sm" onClick={fetchRecs} disabled={loading}>Refresh</button>
      </div>

      {loading && <div>Loading recommendations…</div>}
      {!loading && jobs.length === 0 && <div className="text-sm text-gray-500">No recommendations yet.</div>}

      <div className="space-y-2">
        {jobs.map(j => (
          <div key={j.id} className="border rounded p-2">
            <div className="font-medium">{j.doc?.title || j.meta?.title || "Job"}</div>
            <div className="text-sm text-gray-600">{j.doc?.company || j.meta?.company || ""}</div>
            <div className="text-xs text-gray-400">{(j.score || 0).toFixed(3)}</div>
            {j.doc && <Link to={`/dashboard/job/${j.doc._id || j.id}`} className="btn btn-ghost btn-sm mt-2">View</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
