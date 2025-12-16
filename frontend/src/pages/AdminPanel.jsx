// frontend/src/pages/AdminPanel.jsx
const [users, setUsers] = useState([]);
const [q, setQ] = useState("");
const [loading, setLoading] = useState(false);


useEffect(() => { loadUsers(); }, []);


async function loadUsers(query) {
try {
setLoading(true);
const res = await api.get(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
setUsers(res.data.users || []);
} catch (e) {
console.error('loadUsers err', e.response?.data || e.message);
} finally { setLoading(false); }
}


async function changeRole(userId, role) {
try {
await api.patch(`/api/admin/users/${userId}`, { role });
loadUsers(q);
} catch (e) { console.error(e.response?.data || e.message); }
}


async function deleteUser(userId) {
if (!confirm('Delete user and related content?')) return;
try {
await api.delete(`/api/admin/users/${userId}`);
setUsers(users.filter(u => u._id !== userId));
} catch (e) { console.error(e.response?.data || e.message); }
}


return (
<div className="p-4">
<h1 className="text-2xl mb-4">Admin Panel</h1>
<div className="mb-4">
<input className="border p-2" placeholder="Search users" value={q} onChange={e => setQ(e.target.value)} />
<button className="ml-2 p-2 border" onClick={() => loadUsers(q)}>Search</button>
</div>
{loading ? <div>Loading...</div> : (
<table className="w-full table-auto border-collapse">
<thead>
<tr className="bg-gray-100">
<th className="p-2">Name</th>
<th>Email</th>
<th>Role</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
{users.map(u => (
<tr key={u._id} className="border-t">
<td className="p-2">{u.name}</td>
<td>{u.email}</td>
<td>{u.role}</td>
<td className="p-2">
<select defaultValue={u.role} onChange={(e) => changeRole(u._id, e.target.value)}>
<option value="user">User</option>
<option value="moderator">Moderator</option>
<option value="admin">Admin</option>
</select>
<button className="ml-2 p-1 border" onClick={() => deleteUser(u._1d)}>Delete</button>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
);
}