// frontend/src/components/ResumeUpload.jsx
import { useState } from "react";
import api from "../lib/api";

export default function ResumeUpload({ onParsed }) {
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [suggested, setSuggested] = useState([]);
  const [msg, setMsg] = useState("");

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF resume.");
      return;
    }
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/resume/parse", fd, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (data?.parsed) {
        setParsed(data.parsed);
        setSuggested(data.suggestedJobs || []);
        onParsed && onParsed(data.parsed);
      } else {
        setMsg("No parsed data returned");
      }
    } catch (err) {
      console.error("parse error", err);
      setMsg(err?.response?.data?.message || err.message || "Upload/parse failed");
    } finally {
      setUploading(false);
    }
  }

  async function applyToProfile() {
    if (!parsed) return;
    setMsg("Applying to profile…");
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/resume/apply", { parsed }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (data?.ok) {
        setMsg("Profile updated.");
      } else {
        setMsg("Apply returned unexpected response.");
      }
    } catch (err) {
      console.error("apply error", err);
      setMsg(err?.response?.data?.message || err.message || "Apply failed");
    }
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold">Upload Resume (PDF)</h3>
      <input type="file" accept="application/pdf" onChange={handleFile} />
      {uploading && <div className="text-sm text-gray-500">Uploading & parsing…</div>}
      {msg && <div className="text-sm text-gray-600 mt-2">{msg}</div>}

      {parsed && (
        <div className="mt-3">
          <div><strong>Name:</strong> {parsed.name || "—"}</div>
          <div><strong>Emails:</strong> {parsed.emails?.join(", ") || "—"}</div>
          <div><strong>Phones:</strong> {parsed.phones?.join(", ") || "—"}</div>
          <div><strong>Skills:</strong> {(parsed.skills || []).slice(0,40).join(", ") || "—"}</div>
          <div className="mt-2">
            <button className="btn btn-primary" onClick={applyToProfile}>Apply to profile</button>
            <button className="btn ml-2" onClick={() => { setParsed(null); setSuggested([]); setMsg(""); }}>Clear</button>
          </div>
          {suggested && suggested.length > 0 && (
            <div className="mt-3">
              <div className="font-semibold">Suggested Jobs</div>
              <ul className="list-disc pl-5">
                {suggested.map(j => (
                  <li key={j._id || j.id}>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-sm text-gray-600">{j.company || j.organization} — {j.location}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
