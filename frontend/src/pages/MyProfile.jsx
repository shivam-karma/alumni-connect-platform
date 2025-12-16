import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth.js";
import api, { fetchDebug } from "../lib/api";
import { Link } from "react-router-dom";

export default function MyProfile() {
  const auth = useAuth();
  const ctxUser = auth?.user ?? null;
  const tokenFromCtx = auth?.token ?? null;
  const loginFn = auth?.login;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // incoming connection requests
  const [incoming, setIncoming] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "";

  // ensure we have auth user (try context, otherwise call /api/auth/me)
  async function ensureAuthUser() {
    if (ctxUser && ctxUser.id) return ctxUser;
    try {
      const res = await fetchDebug("/api/auth/me");
      if (res.ok && res.data?.user) {
        const token = localStorage.getItem("token") || tokenFromCtx;
        if (typeof loginFn === "function") loginFn({ token, user: res.data.user });
        return res.data.user;
      } else {
        console.warn("ensureAuthUser failed:", res.status, res.text || res.data);
        return null;
      }
    } catch (err) {
      console.warn("ensureAuthUser error:", err);
      return null;
    }
  }

  // fetch actual user record by id
  async function fetchUserById(id) {
    setLoading(true);
    try {
      const res = await fetchDebug(`/api/users/${id}`);
      if (res.ok && res.data?.user) {
        const dataUser = res.data.user;
        setUser(dataUser);
        setForm({
          name: dataUser.name || "",
          title: dataUser.title || "",
          company: dataUser.company || "",
          location: dataUser.location || "",
          phone: dataUser.phone || "",
          website: dataUser.website || "",
          linkedin: dataUser.linkedin || "",
          github: dataUser.github || "",
          bio: dataUser.bio || "",
          skills: (dataUser.skills || []).join(", "),
          department: dataUser.department || "",
          batch: dataUser.batch || "",
          isMentor: !!dataUser.isMentor,
          achievements: (dataUser.achievements || []).join("\n"),
          experience: dataUser.experience?.length ? dataUser.experience : [],
        });
      } else {
        console.warn("fetchUserById unexpected response:", res.status, res.text || res.data);
        setUser(null);
      }
    } catch (err) {
      console.error("fetchUserById error:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  // GET incoming connection requests (single canonical endpoint)
  async function fetchIncoming() {
    setReqLoading(true);
    try {
      const res = await fetchDebug("/api/connections/incoming");

      if (!res.ok) {
        console.error("fetchIncoming non-ok response:", res.status, res.text || res.data);
        setIncoming([]);
        return;
      }

      let list = [];
      if (res.data) {
        if (Array.isArray(res.data)) list = res.data;
        else if (Array.isArray(res.data.requests)) list = res.data.requests;
        else if (Array.isArray(res.data.data)) list = res.data.data;
        else list = res.data.requests || [];
      } else if (res.text) {
        console.warn("fetchIncoming got text response:", res.text);
        setIncoming([]);
        return;
      }

      const seen = new Set();
      const deduped = [];
      for (const r of list) {
        const fromId = r?.from?._id || r?.from?.id || r?.from;
        if (!fromId) {
          deduped.push(r);
          continue;
        }
        if (!seen.has(String(fromId))) {
          seen.add(String(fromId));
          deduped.push(r);
        }
      }

      setIncoming(deduped);
    } catch (err) {
      console.error("fetchIncoming", err);
      setIncoming([]);
    } finally {
      setReqLoading(false);
    }
  }

  // Boot: ensure auth user and fetch profile + incoming
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const authUser = await ensureAuthUser();
        if (!mounted) return;
        if (!authUser || !authUser.id) {
          setUser(null);
          setLoading(false);
          return;
        }
        await fetchUserById(authUser.id);
        await fetchIncoming();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [ctxUser?.id]); // eslint-disable-line

  // form helpers
  function setFieldAndState(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function addExperience() {
    setForm((prev) => ({ ...prev, experience: [...(prev.experience || []), { title: "", company: "", from: "", to: "", description: "" }] }));
  }
  function updateExperience(idx, key, value) {
    setForm((prev) => {
      const ex = [...(prev.experience || [])];
      ex[idx] = { ...ex[idx], [key]: value };
      return { ...prev, experience: ex };
    });
  }
  function removeExperience(idx) {
    setForm((prev) => {
      const ex = [...(prev.experience || [])];
      ex.splice(idx, 1);
      return { ...prev, experience: ex };
    });
  }

  // save profile
  async function handleSave(e) {
    e?.preventDefault();
    if (!user?.id) {
      setMsg("No user to save.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        name: form.name,
        title: form.title,
        company: form.company,
        location: form.location,
        phone: form.phone,
        website: form.website,
        linkedin: form.linkedin,
        github: form.github,
        bio: form.bio,
        skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        department: form.department,
        batch: form.batch,
        isMentor: !!form.isMentor,
        achievements: form.achievements ? form.achievements.split("\n").map((a) => a.trim()).filter(Boolean) : [],
        experience: form.experience || [],
      };

      const res = await fetchDebug(`/api/users/${user.id}`, { method: "PUT", data: payload });

      if (res.ok && res.data?.user) {
        setUser(res.data.user);
        if (typeof loginFn === "function") loginFn({ token: localStorage.getItem("token") ?? tokenFromCtx, user: res.data.user });
        setEditMode(false);
        setMsg("Profile saved.");
        await fetchIncoming();
      } else {
        console.error("save profile failed:", res.status, res.text || res.data);
        setMsg((res.data && res.data.message) || `Save failed (${res.status})`);
      }
    } catch (err) {
      console.error("save profile", err);
      setMsg(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Accept / Reject handlers
  async function handleAccept(req) {
    if (!req) return;
    const reqId = req._id || req.id || null;
    if (!reqId) {
      alert("Invalid request id");
      return;
    }
    setIncoming((prev) => prev.filter((r) => (r._id || r.id) !== reqId));
    try {
      const res = await fetchDebug(`/api/connections/${reqId}/accept`, { method: "POST" });
      if (!res.ok) console.error("accept non-ok:", res.status, res.text || res.data);
      await fetchIncoming();
      if (user?.id) await fetchUserById(user.id);
    } catch (err) {
      console.error("accept", err);
      alert(err?.message || "Accept failed");
      await fetchIncoming();
      if (user?.id) await fetchUserById(user.id);
    }
  }
  async function handleReject(req) {
    if (!req) return;
    const reqId = req._id || req.id || null;
    if (!reqId) {
      alert("Invalid request id");
      return;
    }
    setIncoming((prev) => prev.filter((r) => (r._id || r.id) !== reqId));
    try {
      const res = await fetchDebug(`/api/connections/${reqId}/reject`, { method: "POST" });
      if (!res.ok) console.error("reject non-ok:", res.status, res.text || res.data);
      await fetchIncoming();
    } catch (err) {
      console.error("reject", err);
      alert(err?.message || "Reject failed");
      await fetchIncoming();
    }
  }

  // small helper UI pieces
  if (loading) return <div>Loading profile…</div>;
  if (!user) return <div>No profile found. Try reloading or logging in.</div>;

  const displayedConnectionsCount =
    Array.isArray(user.connectionsList) && user.connectionsList.length > 0 ? user.connectionsList.length : user.connections || 0;

  function renderConnectionItem(conn) {
    const isObject = typeof conn === "object" && conn !== null;
    const id = isObject ? (conn.id || conn._id) : conn;
    const name = isObject ? (conn.name || "Unknown") : `User ${conn}`;
    const title = isObject ? (conn.title || "") : "";
    const company = isObject ? (conn.company || "") : "";

    return (
      <div key={id} className="flex items-center justify-between border rounded-lg p-2">
        <div>
          <div className="font-medium">{name}</div>
          {title || company ? <div className="text-sm text-gray-600">{title}{title && company ? ` • ` : ""}{company}</div> : null}
        </div>
        <Link to={`/dashboard/profile/${id}`} className="text-sm text-blue-700 hover:underline">View</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="avatar" style={{ width: 96, height: 96, fontSize: 24 }}>
          {user.name?.split(" ").map((s) => s[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <div className="text-sm text-gray-600">{user.title} {user.company ? `• ${user.company}` : ""}</div>
            <div className="ml-auto flex gap-2">
              {!editMode ? (
                <>
                  <button className="btn" onClick={() => setEditMode(true)}>Edit</button>
                  <Link to={`/dashboard/profile/${user.id}`} className="btn btn-ghost">View Public</Link>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => { setEditMode(false); fetchUserById(user.id); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                </>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 mt-2">
            {user.location} • {user.department} • Class of {user.batch} • {displayedConnectionsCount} connections
          </div>

          <div className="mt-3">
            <div className="text-sm text-gray-700">{user.bio || "No bio yet."}</div>
            <div className="mt-2">
              {(user.skills || []).slice(0, 10).map((s) => <span key={s} className="pill mr-2">{s}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <form className="card mt-5" onSubmit={handleSave}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Full name</label>
              <input className="input" value={form.name} onChange={e => setFieldAndState('name', e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm mb-1">Title</label>
              <input className="input" value={form.title} onChange={e => setFieldAndState('title', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Company</label>
              <input className="input" value={form.company} onChange={e => setFieldAndState('company', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Location</label>
              <input className="input" value={form.location} onChange={e => setFieldAndState('location', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Department</label>
              <input className="input" value={form.department} onChange={e => setFieldAndState('department', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Batch / Year</label>
              <input className="input" value={form.batch} onChange={e => setFieldAndState('batch', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={e => setFieldAndState('phone', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm mb-1">Website</label>
              <input className="input" value={form.website} onChange={e => setFieldAndState('website', e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Bio</label>
              <textarea className="input" rows={4} value={form.bio} onChange={e => setFieldAndState('bio', e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Skills (comma separated)</label>
              <input className="input" value={form.skills} onChange={e => setFieldAndState('skills', e.target.value)} />
            </div>
          </div>

          {/* Experience editor */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Experience</h3>
              <button type="button" className="btn" onClick={addExperience}>+ Add</button>
            </div>

            <div className="mt-3 space-y-3">
              {(form.experience || []).map((ex, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <input className="input mb-2" placeholder="Title" value={ex.title} onChange={(e) => updateExperience(i, 'title', e.target.value)} />
                      <input className="input mb-2" placeholder="Company" value={ex.company} onChange={(e) => updateExperience(i, 'company', e.target.value)} />
                      <div className="flex gap-2">
                        <input className="input" placeholder="From" value={ex.from} onChange={(e) => updateExperience(i, 'from', e.target.value)} />
                        <input className="input" placeholder="To" value={ex.to} onChange={(e) => updateExperience(i, 'to', e.target.value)} />
                      </div>
                      <textarea className="input mt-2" rows={2} placeholder="Description" value={ex.description} onChange={(e) => updateExperience(i, 'description', e.target.value)} />
                    </div>
                    <div>
                      <button type="button" className="btn btn-ghost" onClick={() => removeExperience(i)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
              {(form.experience || []).length === 0 && <div className="text-sm text-gray-500">No experience added yet.</div>}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isMentor} onChange={e => setFieldAndState('isMentor', e.target.checked)} /> Available for mentoring</label>
            <div className="ml-auto text-sm text-gray-600">{msg}</div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="card">
          <h3 className="font-semibold">Connections ({displayedConnectionsCount})</h3>
          <div className="mt-3 grid gap-2">
            {(!user.connectionsList || user.connectionsList.length === 0) && <div className="text-sm text-gray-500">No connections yet.</div>}
            {(user.connectionsList || []).map(conn => renderConnectionItem(conn))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Connection Requests</h3>
            <button className="btn" onClick={fetchIncoming}>Refresh</button>
          </div>

          <div className="mt-3 space-y-2">
            {reqLoading && <div>Loading requests…</div>}
            {!reqLoading && incoming.length === 0 && <div className="text-sm text-gray-500">No pending requests.</div>}
            {!reqLoading && incoming.map(r => (
              <div key={r._id || r.id || JSON.stringify(r)} className="flex items-start justify-between border rounded-lg p-3">
                <div>
                  <div className="font-semibold">{r.from?.name || r.fromName || r.fromEmail || "Unknown"}</div>
                  <div className="text-sm text-gray-600">{r.message}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => handleReject(r)}>Reject</button>
                  <button className="btn btn-primary" onClick={() => handleAccept(r)}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
