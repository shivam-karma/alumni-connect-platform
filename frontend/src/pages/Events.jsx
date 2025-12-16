import { useEffect, useState } from "react";
import api from "../lib/api";
import { Link } from "react-router-dom";
import CreateEventModal from "../components/CreateEventModal";

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  async function fetch(qterm = "") {
    setLoading(true);
    try {
      const { data } = await api.get("/api/events", { params: { q: qterm } });
      setEvents(data.events || []);
    } catch (err) {
      console.error("fetch events", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("");
  }, []);

  // called when CreateEventModal successfully creates an event
  function handleCreated(ev) {
    // Ensure event has an id and consistent shape
    if (!ev) return;
    // add to top of list (avoid duplicates)
    setEvents(prev => {
      const exists = prev.some(x => (x._id || x.id) === (ev._id || ev.id));
      if (exists) return prev;
      return [ev, ...prev];
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          className="input flex-1"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search events by name, description, or tags..."
        />
        <button className="btn" onClick={() => fetch(q)}>Search</button>

        {/* open modal instead of navigating to separate page */}
        <button className="btn btn-primary" onClick={() => setOpenCreate(true)}>+ Create Event</button>
        <CreateEventModal open={openCreate} onClose={() => setOpenCreate(false)} onCreated={handleCreated} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {loading && <div>Loading events…</div>}

        {!loading && events.length === 0 && (
          <div className="text-sm text-gray-500">No events found.</div>
        )}

        {!loading && events.map(ev => {
          const dateStr = ev.startDate ? new Date(ev.startDate).toLocaleDateString() : "TBA";
          const venue = ev.location?.venue || ev.location?.address || ev.location?.url || "-";
          const rsvpCount = (ev.rsvps || []).length;
          const capacity = ev.capacity || "-";

          // compute simple progress % if capacity is available and > 0
          const progressPct = (ev.capacity && ev.capacity > 0)
            ? Math.min(100, Math.round((rsvpCount / ev.capacity) * 100))
            : 0;

          return (
            <div key={ev._id || ev.id} className="card p-4">
              <div className="flex justify-between">
                <div className="pr-4">
                  <div className="text-lg font-semibold">{ev.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{dateStr} • {venue}</div>
                  <div className="mt-2 text-sm text-gray-700">{ev.description ? ev.description.slice(0, 200) + (ev.description.length > 200 ? "…" : "") : ""}</div>

                  {/* small tag list */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(ev.tags || []).slice(0, 4).map(t => (
                      <span key={t} className="px-2 py-1 text-xs border rounded-full text-gray-600">{t}</span>
                    ))}
                  </div>

                  {/* progress bar */}
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">{rsvpCount} / {capacity} attending</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div style={{ width: `${progressPct}%` }} className="h-2 rounded-full bg-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end justify-between">
                  <div className="text-sm text-gray-600">{ev.eventType || "Event"}</div>
                  <div>
                    <Link to={`/events/${ev._id || ev.id}`} className="btn btn-ghost mt-4">View Details</Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
