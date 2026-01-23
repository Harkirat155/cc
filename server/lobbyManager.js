// Optimized Lobby Manager with efficient matching and queue management

import config from './config.js';
import { lobbyLog as log } from './logger.js';
import { incCounter } from './metrics.js';

// Debounce timer for broadcasting
let broadcastTimeout = null;

class LobbyManager {
  constructor() {
    // Queue of waiting players: Array<{socketId, displayName, joinedAt}>
    this.queue = [];
    // Fast lookup: socketId -> queue index (for O(1) removal)
    this.playerIndex = new Map();
  }

  /**
   * Add a player to the matchmaking queue
   * @param {string} socketId 
   * @param {string} displayName 
   * @returns {{ success: boolean, error?: string, position?: number }}
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

    // Check queue size limit
    if (this.queue.length >= config.lobbyMaxQueueSize) {
      return { success: false, error: 'Matchmaking queue is full, please try again later' };
    }

    // Check if already in queue
    if (this.playerIndex.has(socketId)) {
      return { success: false, error: 'Already in lobby' };
    }

    const player = {
      socketId,
      displayName: trimmedName,
      joinedAt: Date.now(),
    };

    const position = this.queue.length;
    this.queue.push(player);
    this.playerIndex.set(socketId, position);

    log.debug('Player joined lobby', { socketId, displayName: trimmedName, position });

    return { success: true, position };
  }

  /**
   * Remove a player from the queue
   * Uses swap-and-pop for O(1) removal when order doesn't matter for removal
   * @param {string} socketId 
   * @returns {boolean}
   */
  removePlayer(socketId) {
    const index = this.playerIndex.get(socketId);
    if (index === undefined) return false;

    // Remove from index
    this.playerIndex.delete(socketId);

    // Swap with last element and pop (O(1) removal)
    const lastIndex = this.queue.length - 1;
    if (index !== lastIndex) {
      // Move last element to this position
      const lastPlayer = this.queue[lastIndex];
      this.queue[index] = lastPlayer;
      this.playerIndex.set(lastPlayer.socketId, index);
    }
    this.queue.pop();

    log.debug('Player left lobby', { socketId });
    return true;
  }

  /**
   * Get current queue state for broadcasting
   * Returns sorted by join time for consistent display
   */
  getQueueState() {
    // Sort by joinedAt for consistent FIFO display
    return [...this.queue]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(p => ({
        socketId: p.socketId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
      }));
  }

  /**
   * Attempt to match players from the queue (FIFO by joinedAt)
   * @returns {{ matched: boolean, players?: [Player, Player] }}
   */
  matchPlayers() {
    if (this.queue.length < 2) {
      return { matched: false };
    }

    // Sort by joinedAt to ensure FIFO matching
    this.queue.sort((a, b) => a.joinedAt - b.joinedAt);
    
    // Rebuild index after sort
    this.playerIndex.clear();
    this.queue.forEach((p, i) => this.playerIndex.set(p.socketId, i));

    // Take first two players
    const player1 = this.queue.shift();
    const player2 = this.queue.shift();

    // Update indices for remaining players
    this.playerIndex.delete(player1.socketId);
    this.playerIndex.delete(player2.socketId);
    
    // Rebuild remaining indices
    this.queue.forEach((p, i) => this.playerIndex.set(p.socketId, i));

    incCounter('matchesMade');
    log.info('Players matched', {
      player1: player1.displayName,
      player2: player2.displayName,
    });

    return {
      matched: true,
      players: [player1, player2],
    };
  }

  /**
   * Check if socket is in queue
   */
  isInQueue(socketId) {
    return this.playerIndex.has(socketId);
  }

  /**
   * Get player info
   */
  getPlayer(socketId) {
    const index = this.playerIndex.get(socketId);
    if (index === undefined) return null;
    return this.queue[index] || null;
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Clear the queue (for testing)
   */
  clearQueue() {
    this.queue = [];
    this.playerIndex.clear();
  }
}

// Singleton
export const lobbyManager = new LobbyManager();

/**
 * Broadcast lobby state with debouncing to prevent spam
 * @param {Server} io 
 */
export function broadcastLobbyState(io) {
  // Debounce rapid updates
  if (broadcastTimeout) {
    clearTimeout(broadcastTimeout);
  }

  broadcastTimeout = setTimeout(() => {
    broadcastTimeout = null;
    const state = lobbyManager.getQueueState();
    io.emit('lobbyUpdate', {
      queue: state,
      timestamp: Date.now(),
    });
  }, config.lobbyMatchDebounceMs);
}

/**
 * Broadcast immediately without debouncing
 */
export function broadcastLobbyStateImmediate(io) {
  if (broadcastTimeout) {
    clearTimeout(broadcastTimeout);
    broadcastTimeout = null;
  }
  
  const state = lobbyManager.getQueueState();
  io.emit('lobbyUpdate', {
    queue: state,
    timestamp: Date.now(),
  });
}
