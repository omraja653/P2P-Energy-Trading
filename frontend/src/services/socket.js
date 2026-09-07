import { io } from 'socket.io-client';

// Same idea as services/api.js's VITE_API_URL: same-origin by default
// (works in dev via Vite's `/socket.io` proxy entry, and in any
// single-origin deployment where the same process serves both /api and
// Socket.io), but explicit and required once frontend/backend are on
// different origins — e.g. this app's Vercel+Render split, where the
// deployed frontend has no proxy to reach the Render backend and a
// same-origin socket would silently try to connect to Vercel's own
// domain instead. Set VITE_WS_URL in Vercel's project env vars to the
// Render backend's origin (no /api suffix — Socket.io's own path,
// /socket.io, is separate from the REST API's base path).
let socket = null;

export function getSocket() {
  if (!socket) {
    const wsURL = import.meta.env.VITE_WS_URL || window.location.origin;
    console.log('WebSocket URL:', wsURL);
    socket = io(wsURL, { autoConnect: false });
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
