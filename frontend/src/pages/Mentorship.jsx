// frontend/src/pages/Mentorship.jsx
import { useEffect, useState, useRef } from "react";
import MentorCard from "../components/MentorCard";
import MentorApplicationModal from "../components/MentorApplicationModal";
import MentorshipRequestsList from "../components/MentorshipRequestsList";
import RequestMentorshipModal from "../components/RequestMentorshipModal";
import api from "../lib/api";

export default function Mentorship() {
  const [tab, setTab] = useState("find");
  const [mentors, setMentors] = useState([]);
  const [openApply, setOpenApply] = useState(false);
  const [openRequestModal, setOpenRequestModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  async function fetchMentors(qterm = "") {
    setLoading(true);
    try {
      const { data } = await api.get("/api/mentorship/mentors", { params: { q: qterm } });
      setMentors(data.mentors || []);
    } catch (err) {
      console.error("fetch mentors", err);
      setMentors([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchMentors(); }, []);

  // debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMentors(q), 250);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  // called when MentorCard's "Request Mentorship" clicked
  function openRequest(mentor) {
    setSelectedMentor(mentor);
    setOpenRequestModal(true);
  }

  // when request sent, optionally refresh outgoing requests list or show toast
  function handleRequestSent(request) {
    // simple feedback: switch to 'requests' tab so user sees outgoing list
    setOpenRequestModal(false);
    setTab("requests");
    // optionally refresh mentors or anything else here
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className={`tab ${tab === "find" ? "active" : ""}`} onClick={() => setTab("find")}>Find Mentors</div>
        <div className={`tab ${tab === "apply" ? "active" : ""}`} onClick={() => setTab("apply")}>Become a Mentor</div>
        <div className={`tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>My Requests</div>
      </div>

      <div className="mt-5">
        {tab === "find" && (
          <>
            <div className="flex gap-2">
              <input className="input flex-1" value={q} onChange={e => setQ(e.target.value)} placeholder="Search mentors by name, expertise..." />
              <button className="btn" onClick={() => fetchMentors(q)}>Search</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              {loading && <div>Loading mentors…</div>}
              {!loading && mentors.length === 0 && <div className="text-sm text-gray-500">No mentors found.</div>}
              {!loading && mentors.map(m => (
                <MentorCard key={m._id || m.user?.id || m.userId} mentor={m} onRequest={openRequest} />
              ))}
            </div>
          </>
        )}

        {tab === "apply" && (
          <div className="card p-6 mt-4">
            <h3 className="text-lg font-semibold">Become a Mentor</h3>
            <p className="text-sm text-gray-600 mt-2">Share your expertise and help mentees grow.</p>
            <div className="mt-4">
              <button className="btn btn-primary" onClick={() => setOpenApply(true)}>Apply to Become a Mentor</button>
            </div>
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-4">
            <h3 className="font-semibold">My Requests — Incoming</h3>
            <div className="mt-3"><MentorshipRequestsList box="incoming" onAction={() => { }} /></div>

            <h3 className="font-semibold mt-6">My Requests — Outgoing</h3>
            <div className="mt-3"><MentorshipRequestsList box="outgoing" onAction={() => { }} /></div>
          </div>
        )}
      </div>

      <MentorApplicationModal open={openApply} onClose={() => setOpenApply(false)} onSaved={(profile) => { alert("Application saved"); setOpenApply(false); }} />

      <RequestMentorshipModal
        open={openRequestModal}
        onClose={() => setOpenRequestModal(false)}
        mentor={selectedMentor}
        onSent={handleRequestSent}
      />
    </div>
  );
}
