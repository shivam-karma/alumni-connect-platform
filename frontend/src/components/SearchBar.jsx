// frontend/src/components/SearchBar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchBar({ placeholder = "Search people, news, jobs...", initial = "" }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();

  function onSubmit(e) {
    e?.preventDefault();
    const term = (q || "").trim();
    if (!term) return;
    navigate(`/dashboard/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="input flex-1"
      />
      <button type="submit" className="btn ml-2">Search</button>
    </form>
  );
}
