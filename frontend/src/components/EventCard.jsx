// frontend/src/components/EventCard.jsx
import { Link } from "react-router-dom";

export default function EventCard({ event }) {
  const id = event._id || event.id;
  const dateStr = event.startDate
    ? new Date(event.startDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "TBA";
  const venue = event.location?.venue || event.location?.address || event.location?.url || "-";
  const rsvpCount = (event.rsvps || []).length;
  const capacity = event.capacity || 0;
  const progressPct = capacity > 0 ? Math.min(100, Math.round((rsvpCount / capacity) * 100)) : 0;

  // If current URL starts with /dashboard use dashboard path, otherwise public path
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const to = currentPath.startsWith("/dashboard") ? `/dashboard/events/${id}` : `/events/${id}`;

  return (
    <div className="card p-5">
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-semibold">{event.title}</div>
              <div className="text-sm text-gray-600 mt-1">{event.eventType || "Event"} • {dateStr} • {venue}</div>
            </div>
            <div className="flex flex-col items-end">
              {event.featured && <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm mb-2">Featured</span>}
              <div className="text-sm text-gray-600">{rsvpCount} / {capacity || "-" } attending</div>
            </div>
          </div>

          <p className="text-sm text-gray-700 mt-3">{event.description ? (event.description.length > 240 ? event.description.slice(0, 240) + "…" : event.description) : ""}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(event.tags || []).slice(0, 6).map(t => (
              <span key={t} className="px-3 py-1 text-xs bg-gray-100 rounded-full text-gray-700">{t}</span>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
              <div>Registration Progress</div>
              <div>{capacity > 0 ? `${progressPct}%` : `${rsvpCount}`}</div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full progress-gradient"
                style={{ width: `${progressPct}%`, transition: "width 0.6s ease" }}
              />
            </div>
          </div>
        </div>

        <div className="w-40 flex flex-col justify-between items-end">
          <div className="text-sm text-gray-500">{new Date(event.createdAt || event.startDate || Date.now()).toLocaleDateString()}</div>
          <div className="mt-auto">
            <Link to={`/dashboard/events/${id}`} className="btn btn-ghost">View Details</Link>

          </div>
        </div>
      </div>
    </div>
  );
}
