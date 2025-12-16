// PublicProfile.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth.js";

export default function PublicProfile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user: me } = useAuth();

  // incoming connection requests (for logged-in user)
  const [incoming, setIncoming] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const { data } = await api.get(`/api/users/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setUser(data.user);
      } catch (e) {
        console.error(e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isMe = me?.id === user?.id;

  // load incoming requests only if viewing own profile
  async function fetchIncoming() {
    try {
      setReqLoading(true);
      const token = localStorage.getItem('token');
      const { data } = await api.get('/api/connections', { params: { box: 'incoming' }, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setIncoming(data.requests || []);
    } catch (err) {
      console.error('fetchIncoming', err);
    } finally {
      setReqLoading(false);
    }
  }

  useEffect(() => {
    if (isMe) fetchIncoming();
    else setIncoming([]);
  }, [isMe]);

  async function handleAccept(reqId) {
    try {
      const token = localStorage.getItem('token');
      await api.post(`/api/connections/${reqId}/accept`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      // refresh incoming and user connections count
      await fetchIncoming();
      // refetch profile to see updated connections
      const token2 = localStorage.getItem('token');
      const { data } = await api.get(`/api/users/${user.id}`, { headers: token2 ? { Authorization: `Bearer ${token2}` } : {} });
      setUser(data.user);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Could not accept request');
    }
  }

  async function handleReject(reqId) {
    try {
      const token = localStorage.getItem('token');
      await api.post(`/api/connections/${reqId}/reject`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      await fetchIncoming();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Could not reject request');
    }
  }

  if (loading) return <div>Loading profile…</div>;
  if (!user) return <div>Profile not found.</div>;

  const isMeView = isMe;

  return (
    <div>
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="avatar" style={{width:80,height:80}}>{user.name?.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
          <div>
            <div className="text-2xl font-semibold">{user.name}</div>
            <div className="text-sm text-gray-600">{user.title} {user.company ? `at ${user.company}` : ""}</div>
            <div className="text-sm text-gray-500 mt-2">{user.location} • {user.department} • Class of {user.batch}</div>
            <div className="mt-2">
              {user.isMentor && <span className="badge badge-role-alumni">Available for Mentoring</span>}
              {user.skills?.slice(0,5).map(s => <span key={s} className="pill ml-2">{s}</span>)}
            </div>
          </div>
        </div>

        <div>
          {isMeView ? (
            <Link to="/dashboard/profile/edit" className="btn btn-primary">Edit Profile</Link>
          ) : (
            <div className="flex gap-2">
              <button className="btn">Connect</button>
              <button className="btn btn-primary">Message</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="card">
          <h3 className="font-semibold">About</h3>
          <p className="text-sm text-gray-700 mt-2">{user.bio}</p>

          <h4 className="mt-4 font-medium">Contact</h4>
          <div className="mt-2 text-sm text-blue-700 space-y-1">
            {user.email && <div><a href={`mailto:${user.email}`}>{user.email}</a></div>}
            {user.phone && <div>{user.phone}</div>}
            {user.website && <div><a href={user.website} target="_blank" rel="noreferrer">{user.website}</a></div>}
            {user.linkedin && <div><a href={user.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></div>}
            {user.github && <div><a href={user.github} target="_blank" rel="noreferrer">GitHub</a></div>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold">Skills & Experience</h3>
          <div className="mt-3">
            {user.skills?.map(s => <span key={s} className="pill mr-2">{s}</span>)}
          </div>

          {user.experience?.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium">Experience</h4>
              <ul className="mt-2 space-y-3 text-sm">
                {user.experience.map((ex,i)=>(
                  <li key={i}>
                    <div className="font-medium">{ex.title} • {ex.company}</div>
                    <div className="text-xs text-gray-600">{ex.from} — {ex.to}</div>
                    {ex.description && <div className="text-sm mt-1">{ex.description}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* If viewing own profile show incoming connection requests */}
      {isMeView && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold">Connection Requests</h3>
          <div className="mt-3">
            {reqLoading && <div>Loading requests…</div>}
            {!reqLoading && incoming.length === 0 && <div className="text-sm text-gray-500">No pending requests.</div>}
            {!reqLoading && incoming.map(r => (
              <div key={r._id} className="card flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">{r.from?.name}</div>
                  <div className="text-sm text-gray-600">{r.message}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => handleReject(r._id)}>Reject</button>
                  <button className="btn btn-primary" onClick={() => handleAccept(r._id)}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
