// frontend/src/components/MentorCard.jsx
import { Link } from "react-router-dom";

export default function MentorCard({ mentor, onRequest }) {
  const user = mentor.user || {};
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-blue-500 text-white grid place-items-center font-semibold">
          {user.name ? user.name.split(" ").map(s=>s[0]).slice(0,2).join('') : "M"}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{user.name}</div>
              <div className="text-sm text-gray-600">{user.title} {user.company ? `• ${user.company}` : ""}</div>
            </div>
            <div className="text-sm text-gray-600">{mentor.expertise?.slice(0,3).join(", ")}</div>
          </div>
          <div className="text-sm text-gray-700 mt-2">{mentor.bio?.slice(0,160)}</div>

          <div className="mt-3 flex items-center gap-2">
            <button className="btn btn-primary" onClick={() => onRequest(mentor)}>Request Mentorship</button>
            <Link to={`/dashboard/profile/${user._id || user.id}`} className="btn btn-ghost">View Profile</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
