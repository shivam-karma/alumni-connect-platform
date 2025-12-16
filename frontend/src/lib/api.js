// frontend/src/lib/api.js
import axios from "axios";

/**
 * Centralized API helper for the frontend.
 * Improvements added:
 * - Normalizes API_BASE (removes trailing slash) to avoid double-slash bugs.
 * - Adds optional debug logging for requests/responses (only when NODE_ENV !== 'production').
 * - Detects non-JSON/html responses (text/html from Express "Cannot GET /..." pages) and
 *   attaches the raw text to the error object as `error.responseText` to make debugging easier.
 * - Exports a small `fetchDebug` helper that returns a uniform shape:
 *     { ok: boolean, status: number, data: any, text: string|null }
 *   so components can choose to use it when they want tolerant parsing/diagnostics.
 */

// 🟦 Backend Base URL (highest priority → lowest)
let API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  window.__API_BASE__ ||
  "http://localhost:5000";

// normalize: remove trailing slash to avoid 'http://host//' when using `/${path}`
if (API_BASE.endsWith("/")) API_BASE = API_BASE.slice(0, -1);

const isDev = typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : true;

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true, // ⬅️ send cookies if backend uses them
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔒 Attach JWT token (if stored)
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // don't break requests for localStorage errors
      console.warn("Token attach error:", err);
    }

    if (isDev) {
      // minimal, useful request debug
      // eslint-disable-next-line no-console
      console.debug("[api] =>", config.method?.toUpperCase(), config.baseURL + (config.url || ""), config);
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// 🚨 Global response handler + 401 handler + HTML/text detection
api.interceptors.response.use(
  (res) => {
    // If backend returned text/html (e.g. Express's "Cannot GET /api/..." HTML page),
    // axios will set response.data to a string. Attach content type for debug.
    try {
      const ct = res.headers && res.headers["content-type"];
      if (isDev && ct && ct.includes("text/html")) {
        // eslint-disable-next-line no-console
        console.warn(`[api] non-json response (content-type: ${ct})`, {
          url: (res.config && res.config.baseURL ? res.config.baseURL + res.config.url : res.config?.url),
          status: res.status,
          snippet: typeof res.data === "string" ? res.data.slice(0, 1000) : res.data,
        });
      }
    } catch (err) {
      // ignore logging errors
    }

    return res;
  },
  async (err) => {
    const status = err?.response?.status;

    // If server returned a text/html page (Express default 404), attach it to the error
    try {
      const ct = err?.response?.headers?.["content-type"] || "";
      if (ct.includes("text/html") && typeof err?.response?.data === "string") {
        // raw HTML text from server (useful for debugging "Cannot GET /api/..." cases)
        err.responseText = err.response.data;
        // Also keep a short snippet in logs
        if (isDev) {
          // eslint-disable-next-line no-console
          console.error("[api] server returned HTML (possible missing route)", {
            url: (err?.config?.baseURL ? err.config.baseURL + err.config.url : err?.config?.url),
            status,
            snippet: err.response.data.slice(0, 1000),
          });
        }
      }
    } catch (attachErr) {
      // ignore
    }

    if (status === 401) {
      // Session expired — clear token + redirect to login (avoid redirect loops)
      try {
        // eslint-disable-next-line no-console
        console.warn("[api] 401 – Session expired. Clearing token and redirecting to /login");
        localStorage.removeItem("token");
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      } catch (redirErr) {
        // ignore redirect errors
      }
    }

    return Promise.reject(err);
  }
);

/**
 * Useful helper for components that want tolerant parsing / better diagnostics.
 * Returns a uniform shape:
 *   { ok: boolean, status: number, data: any, text: string|null }
 *
 * IMPORTANT: do NOT send a JSON body when `data` is `null` or `undefined`.
 * Axios may serialize `null` to `"null"` which express.json() (strict parser)
 * rejects. So this helper omits `data` entirely when it's null/undefined.
 *
 * Example:
 *   const res = await fetchDebug('/api/connections/incoming');
 *   if (!res.ok) { console.warn(res.text || res.data); }
 */
export async function fetchDebug(path, { method = "GET", data = undefined, headers = {} } = {}) {
  // Build request opts but only include data if provided (not null/undefined)
  const opts = {
    method,
    url: path,
    headers,
    // validateStatus lets us handle non-2xx without throwing
    validateStatus: () => true,
  };

  if (data !== undefined && data !== null) {
    opts.data = data;
  }

  try {
    const res = await api.request(opts);

    const ct = (res.headers && res.headers["content-type"]) || "";
    if (ct.includes("application/json")) {
      return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, text: null };
    } else {
      // non-json — return raw text in `text` field (axios already gives string)
      const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      return { ok: res.status >= 200 && res.status < 300, status: res.status, data: null, text };
    }
  } catch (err) {
    // network or unexpected error
    // attach any available response text
    const fallbackText = err?.responseText || err?.response?.data || err?.message || String(err);
    return Promise.reject({ message: "Network/error in fetchDebug", original: err, text: fallbackText });
  }
}

export function getApiBase() {
  return API_BASE;
}

export default api;
