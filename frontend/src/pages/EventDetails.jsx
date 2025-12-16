import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";

/**
 * Updated EventDetails:
 * - If global auth user isn't ready but token exists, fetch /api/auth/me locally.
 * - Robust creator check (populated createdBy object or id string).
 * - RSVP / Follow use token fallback and refresh event after actions.
 */
export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const globalUser = auth?.user ?? null;

  const [currentUser, setCurrentUser] = useState(globalUser); // local copy (fall back to API if needed)
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    capacity: 0,
    locationType: "physical",
    locationVenue: "",
    locationAddress: "",
    locationUrl: "",
    tags: "",
    eventType: "",
    speakers: [],
    agenda: []
  });

  // If global user updates, keep local currentUser in sync
  useEffect(() => {
    if (globalUser) setCurrentUser(globalUser);
  }, [globalUser]);

  // if no global user but token exists, try to fetch /api/auth/me once
  useEffect(() => {
    async function fetchMeIfNeeded() {
      try {
        if (!currentUser) {
          const token = localStorage.getItem("token");
          if (token) {
            const { data } = await api.get("/api/auth/me"); // api attaches token automatically
            if (data?.user) {
              setCurrentUser(data.user);
            }
          }
        }
      } catch (err) {
        // ignore silently; user may be unauthenticated
        // console.warn("fetchMeIfNeeded failed", err);
      }
    }
    fetchMeIfNeeded();
    // only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch event
  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/api/events/${id}`);
        if (!data?.event) {
          setError("Event not found");
          setEvent(null);
        } else {
          setEvent(data.event);
          initFormFromEvent(data.event);
        }
      } catch (err) {
        console.error("fetchEvent error", err);
        setError(err?.response?.data?.message || "Failed to load event");
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function initFormFromEvent(ev) {
    setForm({
      title: ev.title || "",
      description: ev.description || "",
      startDate: ev.startDate ? new Date(ev.startDate).toISOString().slice(0, 16) : "",
      startTime: ev.startTime || "",
      capacity: ev.capacity || 0,
      locationType: ev.location?.type || "physical",
      locationVenue: ev.location?.venue || "",
      locationAddress: ev.location?.address || "",
      locationUrl: ev.location?.url || "",
      tags: (ev.tags || []).join(", "),
      eventType: ev.eventType || "",
      speakers: (ev.speakers || []).map(s => ({ ...s })),
      agenda: (ev.agenda || []).map(a => ({ ...a })),
    });
  }

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function addSpeaker() { setForm(prev => ({ ...prev, speakers: [...(prev.speakers || []), { name: "", title: "", company: "", bio: "" }] })); }
  function updateSpeaker(i, key, value) { setForm(prev => { const sp = [...prev.speakers]; sp[i] = { ...sp[i], [key]: value }; return { ...prev, speakers: sp }; }); }
  function removeSpeaker(i) { setForm(prev => { const sp = [...prev.speakers]; sp.splice(i, 1); return { ...prev, speakers: sp }; }); }

  function addAgendaItem() { setForm(prev => ({ ...prev, agenda: [...(prev.agenda || []), { time: "", title: "", durationMinutes: 0, description: "" }] })); }
  function updateAgenda(i, key, value) { setForm(prev => { const ag = [...prev.agenda]; ag[i] = { ...ag[i], [key]: value }; return { ...prev, agenda: ag }; }); }
  function removeAgenda(i) { setForm(prev => { const ag = [...prev.agenda]; ag.splice(i, 1); return { ...prev, agenda: ag }; }); }

  // Helper: get organizer id (works with populated object or string id)
  function getOrganizerId(ev) {
    if (!ev) return null;
    const cand = ev.createdBy ?? ev.organizer ?? null;
    if (!cand) return null;
    return cand._id ?? cand;
  }

  // permission check: creator or admin
  function isUserCreatorOrAdmin() {
    if (!event) return false;
    const organizerId = getOrganizerId(event);
    const userId = currentUser?.id ?? currentUser?._id;
    if (!userId) return false;
    if (String(organizerId) === String(userId)) return true;
    if (currentUser?.role === "admin") return true;
    return false;
  }

  // Save edited event (PUT /api/events/:id)
  async function handleSave(e) {
    e?.preventDefault();
    if (!isUserCreatorOrAdmin()) return alert("Not allowed to edit this event.");
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        startTime: form.startTime,
        capacity: Number(form.capacity) || 0,
        location: {
          type: form.locationType,
          venue: form.locationVenue,
          address: form.locationAddress,
          url: form.locationUrl
        },
        tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
        eventType: form.eventType,
        speakers: form.speakers,
        agenda: form.agenda
      };

      const { data } = await api.put(`/api/events/${id}`, payload);
      const newEvent = data.event || data;
      if (newEvent) {
        setEvent(newEvent);
        initFormFromEvent(newEvent);
        setEditMode(false);
      } else {
        alert("Save succeeded but server returned no event.");
      }
    } catch (err) {
      console.error("save error", err);
      alert(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Delete event
  async function handleDelete() {
    if (!isUserCreatorOrAdmin()) return alert("Not allowed");
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/events/${id}`);
      navigate("/dashboard/events");
    } catch (err) {
      console.error("delete error", err);
      alert(err?.response?.data?.message || "Delete failed");
      setDeleting(false);
    }
  }

  // RSVP (going/interested/cancel). backend accepts 'cancel' or 'cancelled'
  async function rsvp(status) {
    const token = localStorage.getItem("token");
    if (!currentUser && !token) {
      window.showToast?.("Please login to RSVP");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/events/${id}/rsvp`, { status });
      const { data } = await api.get(`/api/events/${id}`);
      setEvent(data.event || data);
    } catch (err) {
      console.error("rsvp error", err);
      alert(err?.response?.data?.message || "RSVP failed");
    } finally {
      setActionLoading(false);
    }
  }

  // Follow toggle
  async function toggleFollow() {
    const token = localStorage.getItem("token");
    if (!currentUser && !token) {
      window.showToast?.("Please login to follow event");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/events/${id}/follow`, { action: "toggle" });
      const { data } = await api.get(`/api/events/${id}`);
      setEvent(data.event || data);
    } catch (err) {
      console.error("follow error", err);
      alert(err?.response?.data?.message || "Follow failed");
    } finally {
      setActionLoading(false);
    }
  }

  // Rendering states
  if (loading) return <div className="p-4">Loading event…</div>;
  if (error) return (
    <div className="p-4 text-red-600">
      {error} <div className="mt-3"><Link to="/dashboard/events" className="btn btn-ghost">Back to events</Link></div>
    </div>
  );
  if (!event) return <div className="p-4">Event not found.</div>;

  const goingCount = (event.rsvps || []).filter(r => r.status === "going").length;
  const interestedCount = (event.rsvps || []).filter(r => r.status === "interested").length;
  const organizer = event.createdBy ?? event.organizer ?? null;
  const myRsvp = (event.rsvps || []).find(r => String(r.userId) === String(currentUser?.id ?? currentUser?._id))?.status ?? null;
  const iFollow = (event.followers || []).some(f => String(f) === String(currentUser?.id ?? currentUser?._id));

  if (!editMode) {
    return (
      <div className="grid md:grid-cols-3 gap-6 p-4">
        <div className="md:col-span-2">
          <div className="card p-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{event.title}</h1>
                <div className="text-sm text-gray-600 mt-1">
                  {event.startDate ? new Date(event.startDate).toLocaleString() : "TBA"}
                  {event.startTime ? ` • ${event.startTime}` : ""} {event.location?.venue ? ` • ${event.location.venue}` : ""}
                </div>
              </div>

              <div className="flex gap-2">
                {isUserCreatorOrAdmin() && <button className="btn" onClick={() => setEditMode(true)}>Edit</button>}
                {isUserCreatorOrAdmin() && <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>}
                <Link to="/dashboard/events" className="btn btn-ghost">Back</Link>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-line text-gray-800">{event.description}</p>

            {event.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {event.tags.map(t => <span key={t} className="pill">#{t}</span>)}
              </div>
            )}

            <div className="mt-6">
              <h4 className="font-semibold">Event Details</h4>
              <div className="grid sm:grid-cols-2 gap-3 mt-2 text-sm">
                <div><b>Type:</b> {event.eventType || "-"}</div>
                <div><b>Capacity:</b> {event.capacity || "Unlimited"}</div>
                <div><b>Organizer:</b> {organizer?.name || "-"}</div>
                <div><b>Created:</b> {event.createdAt ? new Date(event.createdAt).toLocaleString() : "-"}</div>
                <div><b>Attendees:</b> {goingCount} going • {interestedCount} interested</div>
              </div>
            </div>

            {event.speakers?.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold">Speakers</h4>
                <div className="mt-3 grid gap-2">
                  {event.speakers.map((s, i) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-gray-600">{s.title} {s.company && `• ${s.company}`}</div>
                      {s.bio && <div className="text-sm text-gray-700 mt-2">{s.bio}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.agenda?.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold">Agenda</h4>
                <div className="mt-3 space-y-2">
                  {event.agenda.map((a, i) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="text-sm font-medium">{a.time} — {a.title} <span className="text-xs text-gray-500">({a.durationMinutes} min)</span></div>
                      {a.description && <div className="text-sm text-gray-600 mt-1">{a.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside>
          <div className="card p-4 mb-4">
            <div className="flex flex-col gap-2">
              <button className={`btn btn-primary ${actionLoading ? "opacity-60" : ""}`} onClick={() => rsvp(myRsvp === "going" ? "cancel" : "going")} disabled={actionLoading}>
                {myRsvp === "going" ? "Cancel Going" : "Going"}
              </button>
              <button className={`btn ${actionLoading ? "opacity-60" : ""}`} onClick={() => rsvp(myRsvp === "interested" ? "cancel" : "interested")} disabled={actionLoading}>
                {myRsvp === "interested" ? "Remove Interest" : "Interested"}
              </button>
              <button className={`btn btn-ghost ${actionLoading ? "opacity-60" : ""}`} onClick={toggleFollow} disabled={actionLoading}>
                {iFollow ? "Following" : "Follow Event"}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="font-semibold">Organized By</h4>
            <div className="mt-2">
              <div className="font-medium">{organizer?.name || "-"}</div>
              <div className="text-sm text-gray-600">{organizer?.email || "-"}</div>
              <div className="mt-3">
                <Link to="/dashboard/events" className="btn btn-ghost">Back to events</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  // EDIT MODE (same as before, re-used form state)
  return (
    <div className="p-4">
      <form className="card p-6" onSubmit={handleSave}>
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold">Edit Event</h2>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => { setEditMode(false); initFormFromEvent(event); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input className="input" value={form.title} onChange={e => setField('title', e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm mb-1">Type</label>
            <input className="input" value={form.eventType} onChange={e => setField('eventType', e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Description</label>
            <textarea className="input" rows={5} value={form.description} onChange={e => setField('description', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm mb-1">Start (date & time)</label>
            <input type="datetime-local" className="input" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm mb-1">Capacity</label>
            <input className="input" type="number" value={form.capacity} onChange={e => setField('capacity', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm mb-1">Location type</label>
            <select className="input" value={form.locationType} onChange={e => setField('locationType', e.target.value)}>
              <option value="physical">Physical</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Venue (or URL)</label>
            <input className="input" value={form.locationVenue} onChange={e => setField('locationVenue', e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Address</label>
            <input className="input" value={form.locationAddress} onChange={e => setField('locationAddress', e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Tags (comma separated)</label>
            <input className="input" value={form.tags} onChange={e => setField('tags', e.target.value)} />
          </div>
        </div>

        {/* speakers editor */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Speakers</h4>
            <button type="button" className="btn" onClick={addSpeaker}>+ Add</button>
          </div>
          <div className="mt-3 space-y-3">
            {form.speakers.map((s, i) => (
              <div key={i} className="border rounded p-3">
                <div className="grid md:grid-cols-2 gap-2">
                  <input className="input" placeholder="Name" value={s.name} onChange={e => updateSpeaker(i, 'name', e.target.value)} />
                  <input className="input" placeholder="Title" value={s.title} onChange={e => updateSpeaker(i, 'title', e.target.value)} />
                  <input className="input" placeholder="Company" value={s.company} onChange={e => updateSpeaker(i, 'company', e.target.value)} />
                  <input className="input" placeholder="Avatar URL" value={s.avatarUrl || ''} onChange={e => updateSpeaker(i, 'avatarUrl', e.target.value)} />
                  <textarea className="input md:col-span-2" placeholder="Bio" rows={2} value={s.bio} onChange={e => updateSpeaker(i, 'bio', e.target.value)} />
                </div>
                <div className="mt-2">
                  <button type="button" className="btn btn-ghost" onClick={() => removeSpeaker(i)}>Remove</button>
                </div>
              </div>
            ))}
            {form.speakers.length === 0 && <div className="text-sm text-gray-500">No speakers added.</div>}
          </div>
        </div>

        {/* agenda editor */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Agenda</h4>
            <button type="button" className="btn" onClick={addAgendaItem}>+ Add</button>
          </div>
          <div className="mt-3 space-y-3">
            {form.agenda.map((a, i) => (
              <div key={i} className="border rounded p-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <input className="input" placeholder="Time" value={a.time} onChange={e => updateAgenda(i, 'time', e.target.value)} />
                  <input className="input" placeholder="Title" value={a.title} onChange={e => updateAgenda(i, 'title', e.target.value)} />
                  <input className="input" placeholder="Duration (min)" type="number" value={a.durationMinutes} onChange={e => updateAgenda(i, 'durationMinutes', Number(e.target.value))} />
                  <textarea className="input md:col-span-3" rows={2} placeholder="Description" value={a.description} onChange={e => updateAgenda(i, 'description', e.target.value)} />
                </div>
                <div className="mt-2">
                  <button type="button" className="btn btn-ghost" onClick={() => removeAgenda(i)}>Remove</button>
                </div>
              </div>
            ))}
            {form.agenda.length === 0 && <div className="text-sm text-gray-500">No agenda items added.</div>}
          </div>
        </div>
      </form>
    </div>
  );
}
