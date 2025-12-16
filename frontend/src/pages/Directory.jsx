// frontend/src/pages/Directory.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";
import MessageModal from "../components/MessageModal.jsx";
import ConnectModal from "../components/ConnectModal.jsx";

const DEPTS = ["CSE","ECE","EEE","ME","Civil","IT","MBA","MCA"];
const YEARS = Array.from({ length: 20 }, (_, i) => 2010 + i);
const ROLES = ["Alumni", "Student"];

export default function Directory() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [mentorsOnly, setMentorsOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [msgModal, setMsgModal] = useState({ open: false, toId: null, toName: "" });
  const [connectModal, setConnectModal] = useState({ open: false, toId: null, toName: "" });

  // optimistic/persistent requested ids
  const [requestedIds, setRequestedIds] = useState(() => new Set());

  // Fetch users list
  async function fetchUsers() {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (role) params.role = role;
      if (department) params.department = department;
      if (year) params.year = year;
      if (mentorsOnly) params.mentorsOnly = true;

      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/users", {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setItems(data.users || []);
    } catch (err) {
      console.error("fetchUsers error:", err);
    } finally {
      setLoading(false);
    }
  }

  // seed pending outgoing requests
  async function fetchOutgoingRequests() {
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.get("/api/connections", {
        params: { box: "outgoing" },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const ids = new Set();
      (data.requests || []).forEach(r => {
        if (r.status === "pending" && r.to) ids.add(r.to._id ?? r.to);
      });
      setRequestedIds(ids);
    } catch (err) {
      console.error("fetchOutgoingRequests error:", err);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchOutgoingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countText = useMemo(() => {
    const n = items.length;
    return `Showing ${n} ${n === 1 ? "profile" : "profiles"}`;
  }, [items]);

  function clearAll() {
    setQ(""); setRole(""); setDepartment(""); setYear(""); setMentorsOnly(false);
  }

  // Modal open handlers
  function openMessageModal(e, id, name) {
    // important to stop Link navigation (card is often wrapped in <Link>)
    e && e.preventDefault && e.preventDefault();
    e && e.stopPropagation && e.stopPropagation();
    setMsgModal({ open: true, toId: id, toName: name });
  }
  function openConnectModal(e, id, name) {
    e && e.preventDefault && e.preventDefault();
    e && e.stopPropagation && e.stopPropagation();
    setConnectModal({ open: true, toId: id, toName: name });
  }

  // Called when ConnectModal reports success
  function handleConnectSent(toId) {
    setRequestedIds(prev => {
      const nxt = new Set(prev);
      nxt.add(toId);
      return nxt;
    });
    setConnectModal({ open: false, toId: null, toName: "" });
  }

  // Called when MessageModal reports sent
  // Accept optional data from server. If it contains a conversation id, navigate to messages page.
  function handleMessageSent(response) {
    setMsgModal({ open: false, toId: null, toName: "" });

    try {
      const convId = response?.conversation?._id || response?.conversation?.id;
      if (convId) {
        // navigate to messages and open conversation
        navigate(`/dashboard/messages/${convId}`);
      } else {
        // fallback: go to messages list so user can see sent messages
        navigate(`/dashboard/messages`);
      }
    } catch (e) {
      console.warn("handleMessageSent navigation failed:", e);
    }
  }

  // helper that returns a canonical id string (handles _id)
  const getId = (p) => (p?.id || p?._id || (p?._id && p._id.$oid) || null);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="h1 text-blue-900">Directory</div>
          <p className="meta">{countText}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => { fetchUsers(); fetchOutgoingRequests(); }} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="card mt-4">
        <div className="grid md:grid-cols-6 gap-3">
          <input className="input md:col-span-2" placeholder="Search (name, company, skill)…" value={q} onChange={(e) => setQ(e.target.value)} />

          <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
            <span className={`chip ${role === "" ? "chip-active" : ""}`} onClick={() => setRole("")}>All Roles</span>
            {ROLES.map(r => (
              <span key={r} className={`chip ${role === r ? "chip-active" : ""}`} onClick={() => setRole(r)}>{r}</span>
            ))}
            <label className={`chip ${mentorsOnly ? "chip-active" : ""}`}>
              <input type="checkbox" className="mr-1" checked={mentorsOnly} onChange={(e) => setMentorsOnly(e.target.checked)} />
              Mentors only
            </label>
          </div>

          <div>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Department</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => { fetchUsers(); fetchOutgoingRequests(); }} disabled={loading}>{loading ? "Filtering…" : "Apply Filters"}</button>
          <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
          <span className="meta ml-auto">{countText}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-5">
        {items.map(p => {
          const userId = getId(p);
          const isSelf = authUser && userId && (String(userId) === String(authUser.id));
          const cardInner = (
            <div>
              <div className="flex items-start gap-3">
                <div className="avatar">{p.name?.split(" ").map(s => s[0]).slice(0, 2).join("") || "U"}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{p.name}</div>
                    {p.isMentor && <span className="badge">Mentor</span>}
                    <span className={p.role === "Alumni" ? "badge badge-role-alumni" : "badge badge-role-student"}>{p.role || "—"}</span>
                  </div>
                  {p.title && <div className="text-sm text-gray-800">{p.title}</div>}
                  {(p.company || p.location) && <div className="text-xs text-gray-500">{p.company}{p.company && p.location ? " • " : ""}{p.location}</div>}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 mt-3">
                {p.batch && <div>📅 Class of {p.batch}</div>}
                {p.department && <div>🏷️ {p.department}</div>}
                <div>👥 {p.connections || 0} connections</div>
              </div>

              {Array.isArray(p.skills) && p.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.skills.slice(0, 6).map(s => <span key={s} className="pill">{s}</span>)}
                  {p.skills.length > 6 && <span className="meta">+{p.skills.length - 6} more</span>}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                {requestedIds.has(userId) ? (
                  <button className="btn btn-ghost flex-1" onClick={(e) => e.preventDefault()} disabled>Requested</button>
                ) : (
                  <button type="button" className="btn btn-soft flex-1" onClick={(e) => openConnectModal(e, userId, p.name)}>Connect</button>
                )}

                {/* ensure click doesn't bubble to parent Link */}
                <button type="button" className="btn btn-primary" onClick={(e) => openMessageModal(e, userId, p.name)}>Message</button>
              </div>
            </div>
          );

          // If the card is current user's, navigate to editable profile route
          if (isSelf) {
            return (
              <div key={userId} className="card block cursor-pointer no-underline hover:shadow-md" onClick={() => navigate("/dashboard/profile")}>
                {cardInner}
              </div>
            );
          }

          // Normal: link to public profile
          if (userId) {
            return (
              <Link key={userId} to={`/dashboard/profile/${userId}`} className="card block no-underline hover:shadow-md" aria-label={`View profile of ${p.name}`}>
                {cardInner}
              </Link>
            );
          }

          // Fallback if no id
          return (
            <div key={p.name + Math.random()} className="card block cursor-pointer hover:shadow-md" onClick={() => {
              console.warn("Directory: user id missing for item", p);
              navigate(`/dashboard/profile/${encodeURIComponent(p.name || "")}`);
            }}>
              {cardInner}
            </div>
          );
        })}
      </div>

      {!loading && items.length === 0 && <div className="text-gray-500 mt-6">No profiles found.</div>}

      {/* Modals */}
      {msgModal.open && (
        <MessageModal
          open={msgModal.open}
          onClose={() => setMsgModal({ open: false, toId: null, toName: "" })}
          toId={msgModal.toId}
          toName={msgModal.toName}
          onSent={handleMessageSent}
        />
      )}
      {connectModal.open && (
        <ConnectModal
          open={connectModal.open}
          onClose={() => setConnectModal({ open: false, toId: null, toName: "" })}
          toId={connectModal.toId}
          toName={connectModal.toName}
          onSent={() => handleConnectSent(connectModal.toId)}
        />
      )}
    </div>
  );
}
