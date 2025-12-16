// frontend/src/pages/SearchResults.jsx
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [type, setType] = useState(params.get("type") || "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!q) return;
    fetchResults();
    // eslint-disable-next-line
  }, [q, type]);

  async function fetchResults() {
    setLoading(true);
    setErr("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/search/semantic", {
        params: { q, type: type || undefined, limit: 30 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch (e) {
      console.error("search error", e);
      setErr(e?.response?.data?.message || e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Search results for “{q}”</h2>

      <div className="flex gap-2 mb-3">
        <button className={`btn ${type === "" ? "btn-primary" : ""}`} onClick={() => setType("")}>All</button>
        <button className={`btn ${type === "user" ? "btn-primary" : ""}`} onClick={() => setType("user")}>People</button>
        <button className={`btn ${type === "news" ? "btn-primary" : ""}`} onClick={() => setType("news")}>News</button>
        <button className={`btn ${type === "job" ? "btn-primary" : ""}`} onClick={() => setType("job")}>Jobs</button>
      </div>

      {loading && <div>Searching…</div>}
      {err && <div className="text-red-600">{err}</div>}

      <div className="space-y-3 mt-4">
        {results.length === 0 && !loading && <div className="text-sm text-gray-500">No results.</div>}
        {results.map(r => (
          <div key={`${r.type}-${r.id}`} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {r.doc?.name || r.doc?.title || r.doc?.headline || (r.meta && r.meta.title) || `${r.type}:${r.id}`}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {r.doc?.summary || r.doc?.bio || r.meta?.snippet || (r.doc?.description && r.doc.description.slice(0, 160)) || ""}
                </div>
              </div>
              <div className="text-xs text-gray-400">{(r.score || 0).toFixed(3)}</div>
            </div>

            <div className="mt-3 flex gap-2">
              {r.type === "user" && r.doc && <Link to={`/dashboard/profile/${r.doc._id || r.doc.id}`} className="btn btn-ghost">View Profile</Link>}
              {r.type === "job" && r.doc && <Link to={`/dashboard/job/${r.doc._id || r.doc.id}`} className="btn btn-ghost">View Job</Link>}
              {r.type === "news" && r.doc && <Link to={`/dashboard/news/${r.doc._id || r.doc.id}`} className="btn btn-ghost">View News</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
