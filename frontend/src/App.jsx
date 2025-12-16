// frontend/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "./context/AuthContext.jsx";
import NavBar from "./components/NavBar.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import EventDetails from "./pages/EventDetails.jsx";
import EditNews from "./pages/EditNews.jsx";
import MessagesPage from './pages/Messages.jsx';

import AdminDashboard from "./pages/AdminDashboard";

import SearchResultsPage from "./pages/SearchResults.jsx";
import RecommendationsPanel from "./components/RecommendationsPanel.jsx";
import SearchBar from "./components/SearchBar.jsx";
import ResumeParser from "./pages/ResumeParser";

// Dashboard
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import Directory from "./pages/Directory.jsx";
import Events from "./pages/Events.jsx";
import Mentorship from "./pages/Mentorship.jsx";
import Jobs from "./pages/Jobs.jsx";
import JobsList from "./pages/JobsList.jsx";
import JobDetails from "./pages/JobDetails.jsx";
import News from "./pages/News.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Profile from "./pages/Profile.jsx";
import JobApplications from "./pages/JobApplications.jsx";
import EditJob from "./pages/EditJob.jsx";
import NewsDetails from "./pages/NewsDetails.jsx";

// profile & messages pages
import EditProfile from "./pages/EditProfile.jsx";
import PublicProfile from "./pages/PublicProfile.jsx";
import Inbox from "./pages/Inbox.jsx";
import MyProfile from "./pages/MyProfile.jsx";

// Floating AI chat (always-mounted at app root)
import FloatingAIChat from "./components/FloatingAIChat.jsx";

if (!window.showToast) {
  window.showToast = (msg) => {
    const div = document.createElement("div");
    div.className =
      "fixed bottom-6 right-6 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] text-sm animate-fade-in";
    div.innerText = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  };
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Admin route (top-level) - protected for admin role */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected dashboard area */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard/resume-parser" element={<ResumeParser />} />
          <Route path="/dashboard/search" element={<SearchResultsPage />} />

          {/* Default dashboard route */}
          <Route index element={<Navigate to="directory" replace />} />

          {/* Dashboard-level routes (relative paths) */}
          <Route path="directory" element={<Directory />} />
          <Route path="news/:id/edit" element={<EditNews />} />

          {/* Events */}
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetails />} />

          {/* Mentorship */}
          <Route path="mentorship" element={<Mentorship />} />

          {/* Jobs */}
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetails />} />
          <Route path="jobs/:id/edit" element={<EditJob />} />
          <Route path="jobs/:id/applications" element={<JobApplications />} />
          <Route path="jobs-list" element={<JobsList />} />

          {/* News */}
          <Route path="news" element={<News />} />
          <Route path="news/:id" element={<NewsDetails />} />

          {/* Leaderboard */}
          <Route path="leaderboard" element={<Leaderboard />} />

          {/* Messages (dashboard) */}
          <Route path="messages" element={<Inbox />} />
          <Route path="messages/:id" element={<MessagesPage />} />

          {/* Profile routes */}
          <Route path="profile" element={<MyProfile />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="profile/:id" element={<PublicProfile />} />
        </Route>

        {/* Some standalone routes (kept for compatibility) */}
        <Route path="/events/:id" element={<EventDetails />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/news/:id" element={<NewsDetails />} />

        {/* fallback */}
        <Route path="*" element={<LandingPage />} />
      </Routes>

      {/* ALWAYS-MOUNT the floating AI chat so it's available on every page */}
      <FloatingAIChat />
    </AuthProvider>
  );
}
