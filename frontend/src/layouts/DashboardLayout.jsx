// frontend/src/layouts/DashboardLayout.jsx
import { Outlet } from "react-router-dom";
import DashboardNav from "../components/DashboardNav.jsx";
import { useAuth } from "../hooks/useAuth.js";

export default function DashboardLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-56px)]" style={{ background: "hsl(var(--bg))" }}>
      <div className="topbar">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Dashboard</div>
            <span className="hidden md:inline meta">Welcome, {user?.name?.split(" ")[0] || "Member"} 👋</span>
          </div>
          <div className="flex items-center gap-2">
            <input className="input w-64" placeholder="Search people, jobs, events…" />
            <button className="btn btn-soft">Search</button>
          </div>
        </div>
      </div>

      <div className="container flex gap-6 py-6">
        <DashboardNav />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
