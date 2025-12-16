// frontend/src/lib/socket.js
import { io } from "socket.io-client";
import { getApiBase } from "./api";

/**
 * Simple socket client factory — re-usable across components.
 * Returns a socket.io client instance (connected).
 * It will reuse same base and include credentials.
 */
let cached = null;
export default function socketClient() {
  if (cached && cached.connected) return cached;
  try {
    const base = (getApiBase && typeof getApiBase === "function") ? getApiBase() : window.location.origin;
    const url = base.replace(/\/$/, "");
    const token = localStorage.getItem("token");
    cached = io(url, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
    cached.on("connect_error", (err) => {
      console.warn("Socket connect_error", err);
    });
    return cached;
  } catch (e) {
    console.warn("socketClient init failed", e);
    return {
      on: () => {},
      emit: () => {},
      disconnect: () => {},
    };
  }
}
