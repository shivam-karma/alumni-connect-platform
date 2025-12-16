// frontend/src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import api from "../lib/api.js";

// Admin dashboard: users + content moderation
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // content lists
  const [events, setEvents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [news, setNews] = useState([]);
  const [mentorship, setMentorship] = useState([]);
  const [messages, setMessages] = useState([]);

  const [confirm, setConfirm] = useState({ open: false, action: null, payload: null, label: "" });

  // endpoints candidates for each type (tried in order)
  const ENDPOINT_CANDIDATES = {
    events: ["/api/events", "/api/event", "/api/events/list"],
    jobs: ["/api/jobs", "/api/job", "/api/jobs/list"],
    news: ["/api/news", "/api/news/list"],
    mentorship: ["/api/mentorship", "/api/mentorships", "/api/mentorship/list"],
    messages: ["/api/messages", "/api/messages/conversations", "/api/messages/list", "/api/messages/with"],
  };

  useEffect(() => {
    loadUsers();
    // preload some content but lazy load further when user clicks tab
    loadAllContentPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user switches tabs, load that type if empty (lazy load)
  useEffect(() => {
    if (activeTab === "events" && events.length === 0) loadType("events");
    if (activeTab === "jobs" && jobs.length === 0) loadType("jobs");
    if (activeTab === "news" && news.length === 0) loadType("news");
    if (activeTab === "mentorship" && mentorship.length === 0) loadType("mentorship");
    if (activeTab === "messages" && messages.length === 0) loadType("messages");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ------------------------------
  // Users
  // ------------------------------
  async function loadUsers(q = "") {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = res?.data ?? {};
      // support shapes: { users: [...] } or plain array
      const list = Array.isArray(data) ? data : data.users || data.usersList || data.items || [];
      setUsers(list);
    } catch (e) {
      console.error("loadUsers err", e?.response?.data || e?.message);
      showAlert("Error loading users", "error");
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------
  // Content loaders
  // ------------------------------
  // Try endpoints in order, return the first successful response
  async function tryEndpoints(list) {
    for (const p of list) {
      try {
        const res = await api.get(p);
        return res;
      } catch (e) {
        // swallow and continue to next candidate
      }
    }
    return null;
  }

  // Extract array from many possible shapes
  function extractList(res, preferKeys = []) {
    if (!res) return [];
    const d = res?.data ?? res;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    for (const k of preferKeys) if (Array.isArray(d[k])) return d[k];
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.rows)) return d.rows;
    const pluralKeys = ["events", "jobs", "news", "mentorship", "mentorships", "messages", "conversations"];
    for (const k of pluralKeys) if (Array.isArray(d[k])) return d[k];
    console.warn("Unrecognized list shape:", d);
    return [];
  }

  // Preload a small preview (calls the primary endpoints concurrently)
  async function loadAllContentPreview() {
    try {
      const [evRes, jbRes, nwRes] = await Promise.all([
        tryEndpoints(ENDPOINT_CANDIDATES.events).catch(() => null),
        tryEndpoints(ENDPOINT_CANDIDATES.jobs).catch(() => null),
        tryEndpoints(ENDPOINT_CANDIDATES.news).catch(() => null),
      ]);
      setEvents(extractList(evRes, ["events"]).slice(0, 15));
      setJobs(extractList(jbRes, ["jobs"]).slice(0, 15));
      setNews(extractList(nwRes, ["news"]).slice(0, 15));
    } catch (e) {
      console.warn("loadAllContentPreview error", e);
    }
  }

  // Load a specific type (used for lazy loading tabs)
  const loadType = useCallback(
    async (type) => {
      const candidates = ENDPOINT_CANDIDATES[type] || [`/api/${type}`];
      const res = await tryEndpoints(candidates);
      const list = extractList(res, [type, `${type}s`]);
      if (type === "events") setEvents(list);
      if (type === "jobs") setJobs(list);
      if (type === "news") setNews(list);
      if (type === "mentorship") setMentorship(list);
      if (type === "messages") setMessages(list);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ------------------------------
  // Actions: roles, deletes
  // ------------------------------
  function showAlert(message, type = "success", seconds = 4) {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), seconds * 1000);
  }

  function openConfirm(label, action, payload) {
    setConfirm({ open: true, label, action, payload });
  }

  function closeConfirm() {
    setConfirm({ open: false, action: null, payload: null, label: "" });
  }

  async function changeRole(userId, role) {
    try {
      await api.patch(`/api/admin/users/${userId}`, { role });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, role } : u)));
      showAlert("Role updated", "success");
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      showAlert("Failed to update role", "error");
    }
  }

  async function deleteUser(userId) {
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      showAlert("User deleted", "success");
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      showAlert("Failed to delete user", "error");
    }
  }

  // Try admin delete endpoint first, fallback to public path
  async function deleteContent(type, id) {
    try {
      const adminPath = `/api/admin/${type}/${id}`;
      const publicPath = `/api/${type}/${id}`;
      try {
        await api.delete(adminPath);
      } catch (firstErr) {
        await api.delete(publicPath);
      }
      showAlert(`${type} deleted`, "success");
      if (type === "events") setEvents((prev) => prev.filter((e) => e._id !== id));
      if (type === "jobs") setJobs((prev) => prev.filter((j) => j._id !== id));
      if (type === "news") setNews((prev) => prev.filter((n) => n._id !== id));
      if (type === "mentorship") setMentorship((prev) => prev.filter((m) => m._id !== id));
      if (type === "messages") setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (e) {
      console.error(e?.response?.data || e?.message);
      showAlert(`Failed to delete ${type}`, "error");
    }
  }

  function onConfirmProceed() {
    if (!confirm.action) return closeConfirm();
    const { action, payload } = confirm;
    if (action === "deleteUser") deleteUser(payload);
    if (action === "deleteContent") deleteContent(payload.type, payload.id);
    closeConfirm();
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-4">
        <h2 className="text-xl font-bold mb-4">Admin</h2>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-left p-2 rounded ${activeTab === "users" ? "bg-indigo-50" : ""}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`w-full text-left p-2 rounded ${activeTab === "events" ? "bg-indigo-50" : ""}`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`w-full text-left p-2 rounded ${activeTab === "jobs" ? "bg-indigo-50" : ""}`}
          >
            Jobs
          </button>
          <button
            onClick={() => setActiveTab("news")}
            className={`w-full text-left p-2 rounded ${activeTab === "news" ? "bg-indigo-50" : ""}`}
          >
            News
          </button>
          <button
            onClick={() => setActiveTab("mentorship")}
            className={`w-full text-left p-2 rounded ${activeTab === "mentorship" ? "bg-indigo-50" : ""}`}
          >
            Mentorship
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`w-full text-left p-2 rounded ${activeTab === "messages" ? "bg-indigo-50" : ""}`}
          >
            Messages
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="border rounded p-2" />
            <button className="ml-2 p-2 bg-indigo-600 text-white rounded" onClick={() => loadUsers(query)}>
              Search Users
            </button>
            <button
              className="ml-2 p-2 border rounded"
              onClick={() => {
                // quick refresh of currently active tab
                if (activeTab === "users") loadUsers(query);
                else loadType(activeTab);
              }}
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Alerts */}
        {alert && <div className={`mb-4 p-3 rounded ${alert.type === "success" ? "bg-green-100" : "bg-red-100"}`}>{alert.message}</div>}

        {/* Users tab */}
        {activeTab === "users" && (
          <section>
            <h2 className="text-xl mb-3">Users</h2>
            <div className="bg-white shadow rounded overflow-hidden">
              <table className="w-full table-auto">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th>Email</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        Loading...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} className="border-t">
                        <td className="p-2">{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.title}</td>
                        <td>{u.company}</td>
                        <td>
                          <select defaultValue={u.role || "Student"} onChange={(e) => changeRole(u._id, e.target.value)} className="border rounded p-1">
                            <option value="Student">Student</option>
                            <option value="Alumni">Alumni</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <button onClick={() => openConfirm("Delete user?", "deleteUser", u._id)} className="p-1 border rounded bg-red-50">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Generic content tabs */}
        {activeTab === "events" && <ContentList title="Events" items={events} type="events" onDelete={(id) => openConfirm("Delete event?", "deleteContent", { type: "events", id })} />}
        {activeTab === "jobs" && <ContentList title="Jobs" items={jobs} type="jobs" onDelete={(id) => openConfirm("Delete job?", "deleteContent", { type: "jobs", id })} />}
        {activeTab === "news" && <ContentList title="News" items={news} type="news" onDelete={(id) => openConfirm("Delete news?", "deleteContent", { type: "news", id })} />}
        {activeTab === "mentorship" && (
          <ContentList
            title="Mentorship"
            items={mentorship}
            type="mentorship"
            onDelete={(id) => openConfirm("Delete mentorship?", "deleteContent", { type: "mentorship", id })}
          />
        )}
        {activeTab === "messages" && <ContentList title="Messages" items={messages} type="messages" onDelete={(id) => openConfirm("Delete message?", "deleteContent", { type: "messages", id })} />}
      </main>

      {/* Confirm modal */}
      {confirm.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow w-96">
            <h3 className="text-lg font-semibold mb-2">{confirm.label}</h3>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className="p-2 border rounded">
                Cancel
              </button>
              <button onClick={onConfirmProceed} className="p-2 bg-red-600 text-white rounded">
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small reusable content list component
function ContentList({ title, items = [], type, onDelete }) {
  return (
    <section>
      <h2 className="text-xl mb-3">{title}</h2>
      <div className="bg-white shadow rounded overflow-hidden">
        <table className="w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Title / Text</th>
              <th>Meta</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4">
                  No items found.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it._id} className="border-t">
                  <td className="p-2">{it.title || it.text || it.description || "—"}</td>
                  <td>{it.hostId || it.postedBy || it.authorId || it.userId || ""}</td>
                  <td className="p-2">
                    <button onClick={() => onDelete(it._id)} className="p-1 border rounded bg-red-50">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
