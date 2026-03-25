/**
 * SignalingServer - Cloudflare Worker signaling server code.
 * This file is the WORKER SOURCE to be deployed to Cloudflare Workers.
 * It handles WebSocket connections for WebRTC signaling.
 * 
 * For local dev, NetworkManager falls back to a simple WebSocket relay.
 * Deploy this to Cloudflare Workers for production.
 * 
 * Protocol:
 * - Client connects via WebSocket
 * - Sends: { type: 'join', roomId, playerId, playerName }
 * - Receives: { type: 'playerJoined', playerId, playerName }
 * - Sends: { type: 'offer', targetId, sdp }
 * - Sends: { type: 'answer', targetId, sdp }
 * - Sends: { type: 'ice', targetId, candidate }
 * - Receives: forwarded offers/answers/ice from other players
 * - Sends: { type: 'leave' }
 */

// Cloudflare Worker Durable Object for room state
export class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    this.clients = new Map(); // playerId -> WebSocket
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    let playerId = null;

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(server, msg);
        if (msg.type === 'join') {
          playerId = msg.playerId;
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });

    server.addEventListener('close', () => {
      if (playerId) {
        this.clients.delete(playerId);
        this._broadcast({ type: 'playerLeft', playerId }, playerId);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  _handleMessage(ws, msg) {
    switch (msg.type) {
      case 'join':
        // Notify existing players about new player
        this._broadcast({
          type: 'playerJoined',
          playerId: msg.playerId,
          playerName: msg.playerName,
        }, msg.playerId);

        // Send existing player list to new player
        for (const [id, socket] of this.clients) {
          ws.send(JSON.stringify({
            type: 'playerJoined',
            playerId: id,
          }));
        }

        this.clients.set(msg.playerId, ws);
        break;

      case 'offer':
      case 'answer':
      case 'ice':
        // Forward to target player
        const target = this.clients.get(msg.targetId);
        if (target) {
          target.send(JSON.stringify({
            ...msg,
            fromId: msg.playerId || this._getIdBySocket(ws),
          }));
        }
        break;

      case 'state':
        // Broadcast player state to all others
        const senderId = this._getIdBySocket(ws);
        this._broadcast({
          type: 'state',
          playerId: senderId,
          data: msg.data,
        }, senderId);
        break;

      case 'leave':
        const leaverId = this._getIdBySocket(ws);
        if (leaverId) {
          this.clients.delete(leaverId);
          this._broadcast({ type: 'playerLeft', playerId: leaverId }, leaverId);
        }
        break;
    }
  }

  _broadcast(msg, excludeId) {
    const data = JSON.stringify(msg);
    for (const [id, socket] of this.clients) {
      if (id !== excludeId) {
        try { socket.send(data); } catch (e) { /* dead socket */ }
      }
    }
  }

  _getIdBySocket(ws) {
    for (const [id, socket] of this.clients) {
      if (socket === ws) return id;
    }
    return null;
  }
}

// Cloudflare Worker entry point
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room') || 'default';

    // Get or create Durable Object for this room
    const id = env.SIGNALING_ROOM.idFromName(roomId);
    const room = env.SIGNALING_ROOM.get(id);
    return room.fetch(request);
  },
};
