// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

/**
 * useSocket(userId?)
 *
 * - Automatically (re)authenticates the socket with `auth:handshake` when a userId is provided.
 * - Reuses a singleton socket instance so multiple components share the same connection.
 * - Exposes: on(event, handler), off(event, handler), emit(event, payload), connected (bool), socket (raw).
 *
 * NOTE: Configure socket URL with Vite env var VITE_SOCKET_URL, otherwise defaults to http://localhost:5000
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// singleton socket + refcount to avoid multiple connections
let singleton = {
  socket: null,
  consumers: 0,
};

/** create socket (if not exists) */
function createSocket() {
  if (singleton.socket) return singleton.socket;

  const sock = io(SOCKET_URL, {
    autoConnect: true,
    reconnectionAttempts: Infinity,
    transports: ["websocket", "polling"],
    withCredentials: true,
  });

  singleton.socket = sock;
  return sock;
}

/** close socket when no consumers remain */
function maybeCloseSocket() {
  if (!singleton.socket) return;
  if (singleton.consumers <= 0) {
    try {
      singleton.socket.disconnect();
    } catch (e) {
      // ignore
    }
    singleton.socket = null;
    singleton.consumers = 0;
  }
}

export default function useSocket(userId = null) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // stable callbacks to add/remove listeners
  const on = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
    return () => socketRef.current.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.off(event, handler);
  }, []);

  const emit = useCallback((event, payload) => {
    if (!socketRef.current) return;
    try {
      socketRef.current.emit(event, payload);
    } catch (e) {
      console.warn("socket emit failed", e);
    }
  }, []);

  useEffect(() => {
    // create / reuse socket
    const sock = createSocket();
    singleton.consumers += 1;
    socketRef.current = sock;

    // connection state handlers
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = (err) => {
      console.warn("socket connect_error", err);
    };

    sock.on("connect", handleConnect);
    sock.on("disconnect", handleDisconnect);
    sock.on("connect_error", handleConnectError);

    // if provided userId, perform handshake to let server map user -> socket
    if (userId) {
      try {
        sock.emit("auth:handshake", { userId: String(userId) });
      } catch (e) {
        console.warn("auth handshake failed", e);
      }
    }

    return () => {
      // remove handlers
      try {
        sock.off("connect", handleConnect);
        sock.off("disconnect", handleDisconnect);
        sock.off("connect_error", handleConnectError);
      } catch (e) {}

      // decrement consumer count and maybe close socket
      singleton.consumers = Math.max(0, (singleton.consumers || 1) - 1);
      // don't aggressively close in dev if other hooks exist
      maybeCloseSocket();
      socketRef.current = null;
    };
    // userId intentionally not in deps so auth handshake only runs on mount;
    // if you want to re-handshake on userId change include it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // if userId changes after mount, send handshake again
  useEffect(() => {
    if (!socketRef.current) return;
    if (!userId) return;
    try {
      socketRef.current.emit("auth:handshake", { userId: String(userId) });
    } catch (e) {
      console.warn("auth handshake failed on userId change", e);
    }
  }, [userId]);

  return {
    on,
    off,
    emit,
    connected,
    socket: socketRef.current,
  };
}
