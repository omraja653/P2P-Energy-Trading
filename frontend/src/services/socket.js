import { io } from 'socket.io-client';

// Same-origin, no explicit host — matches the relative-/api-path
// architecture (services/api.js's baseURL, vite.config.js's dev proxy).
// Whatever host/IP the browser used to load the page, the browser's own
// origin is where this connects, and Vite's `/socket.io` proxy entry (dev)
// or the same Express+http.Server process (prod, since server.js attaches
// Socket.io to the same httpServer that serves /api) forwards it to the
// real backend. Lazily created — the app doesn't need a live socket until
// a page actually asks for one.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ autoConnect: false });
  }
  return socket;
}

/**
 * Connects (if not already) and joins the caller's own user room, so
 * targeted events (order-status-changed, order-cancelled) reach them.
 * No JWT is sent on the socket handshake — flagged, not hidden: joining a
 * room only grants receipt of broadcast copies of events, not any
 * read/write capability. Every real mutation still goes through the
 * JWT-checked REST endpoints in services/api.js.
 */
export function connectAndJoin(userId) {
  const s = getSocket();
  if (!s.connected) s.connect();
  if (userId) s.emit('join', userId);
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect();
}
