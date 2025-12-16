// frontend/src/pages/News.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";
import { Link } from "react-router-dom";
import CreateNewsModal from "../components/CreateNewsModal";

export default function News() {
  const [news, setNews] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  async function fetchNews(qterm = "", cat = "") {
    setLoading(true);
    try {
      const params = {};
      if (qterm) params.q = qterm;
      if (cat) params.category = cat;
      const { data } = await api.get("/api/news", { params });
      setNews(data.news || []);
    } catch (err) {
      console.error("fetch news", err);
      setNews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNews();
  }, []);

  function handleCreated(newItem) {
    if (newItem) setNews((prev) => [newItem, ...prev]);
  }

  return (
    <div>
      {/* Header + filters */}
      <div className="flex items-center gap-3">
        <input
          className="input flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search news, announcements..."
        />
        <select
          className="input w-48"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          <option value="Latest News">Latest News</option>
          <option value="Announcements">Announcements</option>
          <option value="Success Story">Success Stories</option>
        </select>
        <button className="btn" onClick={() => fetchNews(q, category)}>
          Search
        </button>
        <button className="btn btn-primary" onClick={() => setOpenCreate(true)}>
          + Post News
        </button>
      </div>

      <CreateNewsModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={handleCreated}
      />

      {/* News Cards */}
      <div className="mt-6 grid gap-6">
        {loading && <div>Loading news…</div>}
        {!loading && news.length === 0 && (
          <div className="text-sm text-gray-500">No news yet.</div>
        )}
        {!loading &&
          news.map((n) => (
            <div
              key={n._id}
              className="card overflow-hidden hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left: Image */}
                <div className="md:w-1/3 w-full h-48 md:h-auto flex-shrink-0 bg-gray-100">
                  {n.imageUrl ? (
                    <img
                      src={n.imageUrl}
                      alt={n.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm italic">
                      No Image
                    </div>
                  )}
                </div>

                {/* Right: Content */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {n.title}
                      </h3>
                      {n.featured && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {n.category} •{" "}
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <p className="mt-3 text-gray-700 text-sm">
                      {n.summary
                        ? n.summary
                        : n.body?.length > 160
                        ? n.body.slice(0, 160) + "…"
                        : n.body}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(n.tags || [])
                        .slice(0, 6)
                        .map((t) => (
                          <span
                            key={t}
                            className="px-3 py-1 text-xs bg-gray-100 rounded-full text-gray-700"
                          >
                            #{t}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      to={`/dashboard/news/${n._id}`}
                      className="btn btn-ghost text-blue-600"
                    >
                      Read More →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
