import { createWebSocketTicket } from '../services/liveUpdates.js';

export function createLiveUpdatesTicket(req, res) {
  return res.json({ ticket: createWebSocketTicket(req.user.id) });
}