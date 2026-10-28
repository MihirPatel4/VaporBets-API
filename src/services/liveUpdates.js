import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

//WebSocket ticket valid for 30 seconds
const TICKET_LIFETIME_MS = 30_000;
//map for user ID and expiration time
const tickets = new Map();
//store currently active WebSocket client connections
const clients = new Set();

export function createWebSocketTicket(userId) {
  //remove expired tickets
  const now = Date.now();
  for (const [ticket, record] of tickets) {
    if (record.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }

  //random hex value for each ticket
  const ticket = randomBytes(32).toString('hex');
  tickets.set(ticket, { userId, expiresAt: now + TICKET_LIFETIME_MS });
  return ticket;
}

//send update to each client
export function publishProbabilityUpdate(update) {
  const message = JSON.stringify({
    type: 'outcome.updated',
    eventId: update.eventId,
    marketId: update.marketId,
    outcomeId: update.outcomeId,
    probability: update.probability,
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (error) => {
        if (error) {
          console.error('Unable to send live probability update:', error.message);
        }
      });
    }
  }
}

//attach to VaporBets API server
export function attachLiveUpdates(server) {
  //WebSocket server should not open its own port
  const webSocketServer = new WebSocketServer({ noServer: true });

  //handler for HTTP upgrade event
  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    //close connection if URL path is not /live
    if (requestUrl.pathname !== '/live') {
      socket.destroy();
      return;
    }

    const ticket = requestUrl.searchParams.get('ticket');
    const record = ticket ? tickets.get(ticket) : null;
    //missing or expired ticket gets 401 response
    if (!record || record.expiresAt <= Date.now()) {
      if (ticket) {
        tickets.delete(ticket);
      }
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    //remove the valid ticket
    tickets.delete(ticket);
    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      //attach user ID to the new WebSocket client
      client.userId = record.userId;
      //notify server of the connection
      webSocketServer.emit('connection', client, request);
    });
  });

  //add client to clients set and remove when server closes
  webSocketServer.on('connection', (client) => {
    clients.add(client);
    client.on('close', () => clients.delete(client));
    client.on('error', (error) => {
      console.error('Client live-update WebSocket error:', error.message);
      clients.delete(client);
    });
  });
}