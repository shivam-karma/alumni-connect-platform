// frontend/src/api.js
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // important: send cookies
  headers: { "Content-Type": "application/json" },
});

// Simple response interceptor to bubble up errors (optional)
api.interceptors.response.use(
  r => r,
  err => {
    // you can centralize 401 handling here if you want
    return Promise.reject(err);
  }
);

export default api;
