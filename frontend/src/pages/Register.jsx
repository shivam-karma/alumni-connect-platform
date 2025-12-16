import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";

const departments = ["CSE","ECE","EEE","ME","Civil","IT","MBA","MCA"];
const years = Array.from({length: 12}, (_,i) => 2016 + i);

export default function Register() {
  const nav = useNavigate();
  const [role, setRole] = useState("Student");
  const [form, setForm] = useState({
    name:"", email:"", password:"", confirm:"",
    department:"", batch:"",
    title:"", company:"", location:"", skills:"", // CSV for convenience
    isMentor:false
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match");

    const skillsArr = form.skills
      ? form.skills.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    setLoading(true);
    try {
      await api.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        department: form.department,
        batch: form.batch,
        role,
        title: form.title,
        company: form.company,
        location: form.location,
        skills: skillsArr,
        isMentor: form.isMentor
      });
      nav("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container py-10 grid place-items-center">
        <div className="max-w-2xl w-full card">
          <h1 className="text-2xl font-bold text-center">Create Account</h1>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Role + Mentor */}
            <div className="md:col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role" checked={role==="Student"} onChange={()=>setRole("Student")} />
                Student
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role" checked={role==="Alumni"} onChange={()=>setRole("Alumni")} />
                Alumni
              </label>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <input type="checkbox" checked={form.isMentor} onChange={e=>setForm({...form, isMentor:e.target.checked})} />
                Mentor
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Full Name *</label>
              <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            </div>

            <div>
              <label className="block text-sm mb-1">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
            </div>

            <div>
              <label className="block text-sm mb-1">Graduation Year</label>
              <select className="input" value={form.batch} onChange={e=>setForm({...form, batch:e.target.value})}>
                <option value="">Year</option>
                {years.map(y=> <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Department</label>
              <select className="input" value={form.department} onChange={e=>setForm({...form, department:e.target.value})}>
                <option value="">Select</option>
                {departments.map(d=> <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Password *</label>
              <input type="password" className="input" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
            </div>

            <div>
              <label className="block text-sm mb-1">Confirm Password *</label>
              <input type="password" className="input" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} required />
            </div>

            {/* Directory extras */}
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input className="input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="e.g., Data Scientist" />
            </div>
            <div>
              <label className="block text-sm mb-1">Company</label>
              <input className="input" value={form.company} onChange={e=>setForm({...form, company:e.target.value})} placeholder="e.g., Amazon" />
            </div>
            <div>
              <label className="block text-sm mb-1">Location</label>
              <input className="input" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} placeholder="e.g., Bengaluru, India" />
            </div>
            <div>
              <label className="block text-sm mb-1">Skills (comma-separated)</label>
              <input className="input" value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})} placeholder="React, Python, SQL" />
            </div>

            {error && <p className="md:col-span-2 text-red-600 text-sm">{error}</p>}

            <button className="md:col-span-2 btn btn-primary w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </button>
            <p className="md:col-span-2 text-sm text-center text-gray-600">
              Already have an account? <Link to="/login" className="underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
