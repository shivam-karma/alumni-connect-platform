// frontend/src/pages/JobsList.jsx
import { useEffect, useState, useRef } from "react";
import api from "../lib/api";
import JobCard from "../components/JobCard";
import CreateJobModal from "../components/CreateJobModal";
import ApplyJobModal from "../components/ApplyJobModal";

export default function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openApply, setOpenApply] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const debounceRef = useRef(null);

  async function fetchJobs(qterm="") {
    setLoading(true);
    try {
      const params = {};
      if (qterm) params.q = qterm;
      const { data } = await api.get("/api/jobs", { params });
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("fetch jobs", err);
      setJobs([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchJobs(q), 250);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  function openApplyModal(job) {
    setSelectedJob(job);
    setOpenApply(true);
  }

  function handleCreated(job) {
    if (!job) return;
    setJobs(prev => [job, ...prev]);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input className="input flex-1" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search jobs, companies, skills..." />
        <button className="btn" onClick={() => fetchJobs(q)}>Search</button>
        <button className="btn btn-primary" onClick={() => setOpenCreate(true)}>Post a Job</button>
      </div>

      <CreateJobModal open={openCreate} onClose={() => setOpenCreate(false)} onCreated={handleCreated} />

      <div className="grid md:grid-cols-1 gap-4 mt-6">
        {loading && <div>Loading jobs…</div>}
        {!loading && jobs.length === 0 && <div className="text-sm text-gray-500">No jobs found.</div>}
        {!loading && jobs.map(job => <JobCard key={job._id || job.id} job={job} onApply={openApplyModal} />)}
      </div>

      <ApplyJobModal open={openApply} job={selectedJob} onClose={() => setOpenApply(false)} />
    </div>
  );
}
