import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard/directory", label: "Directory", icon: "👥" },
  { to: "/dashboard/events", label: "Events", icon: "📅" },
  { to: "/dashboard/mentorship", label: "Mentorship", icon: "🧭" },
  { to: "/dashboard/jobs", label: "Jobs", icon: "💼" },
  { to: "/dashboard/news", label: "News", icon: "📰" },
  { to: "/dashboard/leaderboard", label: "Leaderboard", icon: "🏆" },
  { to: "/dashboard/profile", label: "Profile", icon: "👤" }
];

export default function DashboardNav() {
  return (
    <aside className="sidebar sticky top-14">
      <div className="p-3">
        <div className="text-xs text-gray-500 mb-2 px-2">Menu</div>
        <nav className="flex flex-col gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 ${
                  isActive ? "chip-active" : "text-gray-800"
                }`
              }
            >
              <span>{l.icon}</span>
              <span className="text-sm">{l.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
