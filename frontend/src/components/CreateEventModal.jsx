// frontend/src/components/CreateEventModal.jsx
import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function CreateEventModal({ open, onClose, onCreated }) {
  const { login } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    locationType: "physical", // physical | online
    venue: "",
    address: "",
    url: "",
    capacity: 0,
    tags: "",
    eventType: "Event",
    featured: false
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleCreate(e) {
    e?.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        startDate: form.startDate ? new Date(form.startDate) : null,
        startTime: form.startTime,
        location: {
          type: form.locationType,
          venue: form.venue,
          address: form.address,
          url: form.url
        },
        capacity: Number(form.capacity) || 0,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        eventType: form.eventType,
        featured: !!form.featured
      };

      const token = localStorage.getItem("token");
      const { data } = await api.post("/api/events", payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (data?.event) {
        // refresh auth user so points update
        try {
          const { data: meData } = await api.get("/api/auth/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (meData?.user) login({ token, user: meData.user });
        } catch (refreshErr) {
          console.warn("Failed to refresh auth user after creating event:", refreshErr);
        }

        // toast
        if (window.showToast && typeof window.showToast === "function") {
          window.showToast("+25 points — for creating an event!");
        } else {
          alert("+25 points — for creating an event!");
        }

        onCreated && onCreated(data.event);
        onClose && onClose();

        setForm({
          title: "",
          description: "",
          startDate: "",
          startTime: "",
          locationType: "physical",
          venue: "",
          address: "",
          url: "",
          capacity: 0,
          tags: "",
          eventType: "Event",
          featured: false
        });
      } else {
        alert("Create returned unexpected response.");
      }
    } catch (err) {
      console.error("create event", err);
      alert(err?.response?.data?.message || "Create event failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-2xl bg-white rounded-xl shadow-xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-600">✕</button>
        <h3 className="font-semibold text-lg">Create Event</h3>

        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <input className="input" placeholder="Event title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required />
          <textarea className="input" rows={4} placeholder="Short description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}></textarea>

          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} />
            <input className="input" type="time" value={form.startTime} onChange={e=>setForm({...form, startTime:e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.locationType} onChange={e=>setForm({...form, locationType:e.target.value})}>
              <option value="physical">Physical</option>
              <option value="online">Online</option>
            </select>
            <input className="input" placeholder="Venue (if physical)" value={form.venue} onChange={e=>setForm({...form, venue:e.target.value})} />
          </div>

          <input className="input" placeholder="Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
          <input className="input" placeholder="Online URL (if any)" value={form.url} onChange={e=>setForm({...form, url:e.target.value})} />
          <input className="input" placeholder="Capacity" type="number" value={form.capacity} onChange={e=>setForm({...form, capacity:e.target.value})} />

          <input className="input" placeholder="Tags (comma separated)" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} />
          <input className="input" placeholder="Event type (Meetup, Webinar...)" value={form.eventType} onChange={e=>setForm({...form, eventType:e.target.value})} />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.featured} onChange={e=>setForm({...form, featured:e.target.checked})} />
            Feature this event
          </label>

          <div className="flex gap-3 justify-end">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Creating…" : "Create Event"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
