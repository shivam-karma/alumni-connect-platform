// frontend/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protects a route by role.
 * Usage:
 * <ProtectedRoute requiredRole="admin"><AdminDashboard/></ProtectedRoute>
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!currentUser) {
    // not logged in -> redirect to login
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // logged in but doesn't have required role
    return <div className="p-6">Access denied — you need the <strong>{requiredRole}</strong> role.</div>;
  }

  // allowed
  return children;
}
