/**
 * NetworkManager - WebRTC peer-to-peer connections, state sync.
 * Imports: EventBus.
 * Exports: NetworkManager class.
 *
 * Connects to signaling server via WebSocket.
 * Creates RTCPeerConnection for each remote player.
 * Sends player state (position, rotation, fishing state) 10x/sec via DataChannel.
 * Receives remote player states and emits events.
 */

import eventBus from '../core/EventBus.js';

const STATE_SEND_INTERVAL = 100; // ms (10 Hz)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default class NetworkManager {
  /**
   * @param {string} signalingUrl - WebSocket URL of signaling server
   */
  constructor(signalingUrl) {
    this._signalingUrl = signalingUrl;
    this._ws = null;
    this._peers = new Map(); // peerId -> { connection, dataChannel, state }
    this._playerId = this._generateId();
    this._playerName = 'Angler_' + this._playerId.substring(0, 4);
    this._roomId = null;
    this._connected = false;
    this._localState = null;
    this._sendTimer = null;
  }

  get playerId() { return this._playerId; }
  get playerName() { return this._playerName; }
  get isConnected() { return this._connected; }
  get peerCount() { return this._peers.size; }

  setPlayerName(name) {
    this._playerName = name;
  }

  /**
   * Join a multiplayer room.
   */
  async joinRoom(roomId) {
    this._roomId = roomId;

    try {
      const url = `${this._signalingUrl}?room=${encodeURIComponent(roomId)}`;
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._connected = true;
        this._ws.send(JSON.stringify({
          type: 'join',
          roomId: this._roomId,
          playerId: this._playerId,
          playerName: this._playerName,
        }));
        eventBus.emit('network:connected', { roomId });
        this._startStateSend();
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleSignalingMessage(msg);
        } catch (e) { /* ignore */ }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._stopStateSend();
        eventBus.emit('network:disconnected');
      };

      this._ws.onerror = (err) => {
        console.warn('NetworkManager: WebSocket error', err);
        eventBus.emit('network:error', { error: err });
      };
    } catch (err) {
      console.warn('NetworkManager: Failed to connect', err);
    }
  }

  leaveRoom() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'leave' }));
      this._ws.close();
    }
    this._stopStateSend();
    this._disconnectAllPeers();
    this._connected = false;
    eventBus.emit('network:disconnected');
  }

  /**
   * Set local player state to broadcast.
   */
  setLocalState(state) {
    this._localState = state;
  }

  /**
   * Get all remote player states.
   */
  getRemoteStates() {
    const states = [];
    for (const [id, peer] of this._peers) {
      if (peer.state) {
        states.push({ playerId: id, ...peer.state });
      }
    }
    return states;
  }

  // =============================================
  // Signaling
  // =============================================
  async _handleSignalingMessage(msg) {
    switch (msg.type) {
      case 'playerJoined':
        await this._createPeerConnection(msg.playerId, true);
        eventBus.emit('network:playerJoined', { playerId: msg.playerId, playerName: msg.playerName });
        break;

      case 'playerLeft':
        this._removePeer(msg.playerId);
        eventBus.emit('network:playerLeft', { playerId: msg.playerId });
        break;

      case 'offer':
        await this._handleOffer(msg.fromId, msg.sdp);
        break;

      case 'answer':
        await this._handleAnswer(msg.fromId, msg.sdp);
        break;

      case 'ice':
        await this._handleIce(msg.fromId, msg.candidate);
        break;

      case 'state':
        // Direct state relay (fallback when DataChannel not available)
        this._updatePeerState(msg.playerId, msg.data);
        break;
    }
  }

  // =============================================
  // WebRTC Peer Connection
  // =============================================
  async _createPeerConnection(peerId, initiator) {
    if (this._peers.has(peerId)) return;

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { connection, dataChannel: null, state: null };
    this._peers.set(peerId, peer);

    // ICE candidate handling
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignaling({
          type: 'ice',
          targetId: peerId,
          candidate: event.candidate,
        });
      }
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        this._removePeer(peerId);
      }
    };

    // Data channel
    if (initiator) {
      const dc = connection.createDataChannel('gameState', { ordered: false, maxRetransmits: 0 });
      this._setupDataChannel(dc, peerId);
      peer.dataChannel = dc;

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      this._sendSignaling({
        type: 'offer',
        targetId: peerId,
        sdp: connection.localDescription,
      });
    } else {
      connection.ondatachannel = (event) => {
        peer.dataChannel = event.channel;
        this._setupDataChannel(event.channel, peerId);
      };
    }
  }

  _setupDataChannel(dc, peerId) {
    dc.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        this._updatePeerState(peerId, state);
      } catch (e) { /* ignore */ }
    };
    dc.onopen = () => {
      eventBus.emit('network:peerConnected', { playerId: peerId });
    };
    dc.onclose = () => {
      eventBus.emit('network:peerDisconnected', { playerId: peerId });
    };
  }

  async _handleOffer(fromId, sdp) {
    await this._createPeerConnection(fromId, false);
    const peer = this._peers.get(fromId);
    if (!peer) return;

    await peer.connection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);

    this._sendSignaling({
      type: 'answer',
      targetId: fromId,
      sdp: peer.connection.localDescription,
    });
  }

  async _handleAnswer(fromId, sdp) {
    const peer = this._peers.get(fromId);
    if (!peer) return;
    await peer.connection.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async _handleIce(fromId, candidate) {
    const peer = this._peers.get(fromId);
    if (!peer) return;
    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) { /* ignore */ }
  }

  _removePeer(peerId) {
    const peer = this._peers.get(peerId);
    if (!peer) return;
    if (peer.dataChannel) peer.dataChannel.close();
    peer.connection.close();
    this._peers.delete(peerId);
  }

  _disconnectAllPeers() {
    for (const [id] of this._peers) {
      this._removePeer(id);
    }
  }

  // =============================================
  // State broadcast
  // =============================================
  _startStateSend() {
    this._sendTimer = setInterval(() => {
      if (!this._localState) return;
      const data = JSON.stringify(this._localState);

      // Send via DataChannels
      for (const [id, peer] of this._peers) {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          try { peer.dataChannel.send(data); } catch (e) { /* ignore */ }
        }
      }

      // Fallback: send via signaling server
      if (this._peers.size === 0 || !this._hasOpenDataChannel()) {
        this._sendSignaling({ type: 'state', data: this._localState });
      }
    }, STATE_SEND_INTERVAL);
  }

  _stopStateSend() {
    if (this._sendTimer) {
      clearInterval(this._sendTimer);
      this._sendTimer = null;
    }
  }

  _hasOpenDataChannel() {
    for (const [, peer] of this._peers) {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') return true;
    }
    return false;
  }

  _updatePeerState(peerId, state) {
    let peer = this._peers.get(peerId);
    if (!peer) {
      peer = { connection: null, dataChannel: null, state: null };
      this._peers.set(peerId, peer);
    }
    peer.state = state;
    eventBus.emit('network:peerState', { playerId: peerId, state });
  }

  _sendSignaling(msg) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg));
    }
  }

  _generateId() {
    return Math.random().toString(36).substring(2, 10) +
           Math.random().toString(36).substring(2, 10);
  }

  dispose() {
    this.leaveRoom();
  }
}
