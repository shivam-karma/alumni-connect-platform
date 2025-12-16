// frontend/src/pages/NewsDetails.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function NewsDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchNews() {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/news/${id}`);
      setItem(data.news);
    } catch (err) {
      console.error("fetch news", err);
      setItem(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchNews(); }, [id]);

  if (loading) return <div>Loading…</div>;
  if (!item) return <div>Not found.</div>;

  const isAuthor = user && item.author?.id && (user.id === item.author.id || user.id === item.author.id.toString());

  return (
    <div className="card p-6">
      <div className="flex gap-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <div className="text-sm text-gray-600">{item.category} • {new Date(item.createdAt).toLocaleDateString()}</div>
          {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-full mt-4 rounded" />}
          <div className="mt-4 text-gray-800" dangerouslySetInnerHTML={{ __html: item.body }} />
          <div className="mt-4">
            {(item.tags || []).map(t => <span key={t} className="pill mr-2">{t}</span>)}
          </div>
        </div>
        <aside className="w-64">
          <div className="card p-4">
            <div className="font-medium">Author</div>
            <div className="text-sm text-gray-600">{item.author?.name || "Admin"}</div>
            {isAuthor && (
              <Link to={`/dashboard/news/${id}/edit`} className="btn btn-ghost mt-3">Edit</Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
