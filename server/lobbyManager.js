// Matchmaking lobby management
// Single Responsibility: Manage lobby queue, match players, broadcast state

class LobbyManager {
  constructor() {
    // Queue of waiting players: [{socketId, displayName, joinedAt}]
    this.queue = [];
    // Map socketId -> {displayName, joinedAt}
    this.playerMetadata = new Map();
  }

  /**
   * Add a player to the matchmaking queue
   * @param {string} socketId - Socket.IO socket ID
   * @param {string} displayName - Player's chosen display name
   * @returns {{success: boolean, error?: string, position?: number}}
   */
  addPlayer(socketId, displayName) {
    // Validation
    if (!socketId || typeof socketId !== 'string') {
      return { success: false, error: 'Invalid socket ID' };
    }
    
    const trimmedName = String(displayName || '').trim();
    if (trimmedName.length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters' };
    }
    if (trimmedName.length > 20) {
      return { success: false, error: 'Display name must be 20 characters or less' };
    }

    // Check if already in queue
    if (this.playerMetadata.has(socketId)) {
      return { success: false, error: 'Already in lobby' };
    }

    const player = {
      socketId,
      displayName: trimmedName,
      joinedAt: Date.now(),
    };

    this.queue.push(player);
    this.playerMetadata.set(socketId, player);

    return {
      success: true,
      position: this.queue.length - 1,
    };
  }

  /**
   * Remove a player from the queue
   * @param {string} socketId
   * @returns {boolean} true if player was removed
   */
  removePlayer(socketId) {
    if (!this.playerMetadata.has(socketId)) {
      return false;
    }

    this.queue = this.queue.filter(p => p.socketId !== socketId);
    this.playerMetadata.delete(socketId);
    return true;
  }

  /**
   * Get the current queue state for broadcasting
   * @returns {Array} Array of {socketId, displayName, joinedAt}
   */
  getQueueState() {
    return this.queue.map(p => ({
      socketId: p.socketId,
      displayName: p.displayName,
      joinedAt: p.joinedAt,
    }));
  }

  /**
   * Attempt to match two players from the queue (FIFO)
   * @returns {{matched: boolean, players?: Array}} Match result
   */
  matchPlayers() {
    if (this.queue.length < 2) {
      return { matched: false };
    }

    // FIFO matching: take first two players
    const player1 = this.queue.shift();
    const player2 = this.queue.shift();

    // Clean up metadata
    this.playerMetadata.delete(player1.socketId);
    this.playerMetadata.delete(player2.socketId);

    return {
      matched: true,
      players: [player1, player2],
    };
  }

  /**
   * Check if a socket is in the queue
   * @param {string} socketId
   * @returns {boolean}
   */
  isInQueue(socketId) {
    return this.playerMetadata.has(socketId);
  }

  /**
   * Get player info by socketId
   * @param {string} socketId
   * @returns {Object|null}
   */
  getPlayer(socketId) {
    return this.playerMetadata.get(socketId) || null;
  }

  /**
   * Get current queue size
   * @returns {number}
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Clear entire queue (for testing or admin purposes)
   */
  clearQueue() {
    this.queue = [];
    this.playerMetadata.clear();
  }
}

// Singleton instance
export const lobbyManager = new LobbyManager();

/**
 * Broadcast current lobby state to all sockets in the lobby
 * @param {Server} io - Socket.IO server instance
 */
export function broadcastLobbyState(io) {
  const state = lobbyManager.getQueueState();
  io.emit('lobbyUpdate', {
    queue: state,
    timestamp: Date.now(),
  });
}
