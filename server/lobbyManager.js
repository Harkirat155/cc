// Optimized Lobby Manager with efficient matching and queue management
// Supports multiple game modes with separate queues

import config from './config.js';
import { lobbyLog as log } from './logger.js';
import { incCounter } from './metrics.js';

// Debounce timers for broadcasting (per mode)
const broadcastTimeouts = {};

class LobbyManager {
  constructor() {
    // Queues per game mode: { classic: [], ultimate: [] }
    this.queues = {
      classic: [],
      ultimate: [],
    };
    // Fast lookup: socketId -> { queueIndex, gameMode }
    this.playerIndex = new Map();
  }

  /**
   * Add a player to the matchmaking queue for a specific mode
   * @param {string} socketId 
   * @param {string} displayName 
   * @param {string} gameMode - 'classic' or 'ultimate'
   * @returns {{ success: boolean, error?: string, position?: number }}
   */
  addPlayer(socketId, displayName, gameMode = 'classic') {
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

    // Ensure valid game mode
    const validMode = this.queues[gameMode] ? gameMode : 'classic';
    const queue = this.queues[validMode];

    // Check queue size limit
    if (queue.length >= config.lobbyMaxQueueSize) {
      return { success: false, error: 'Matchmaking queue is full, please try again later' };
    }

    // Check if already in any queue
    if (this.playerIndex.has(socketId)) {
      return { success: false, error: 'Already in lobby' };
    }

    const player = {
      socketId,
      displayName: trimmedName,
      joinedAt: Date.now(),
      gameMode: validMode,
    };

    const position = queue.length;
    queue.push(player);
    this.playerIndex.set(socketId, { queueIndex: position, gameMode: validMode });

    log.debug('Player joined lobby', { socketId, displayName: trimmedName, gameMode: validMode, position });

    return { success: true, position };
  }

  /**
   * Remove a player from any queue
   * @param {string} socketId 
   * @returns {boolean}
   */
  removePlayer(socketId) {
    const playerInfo = this.playerIndex.get(socketId);
    if (!playerInfo) return false;

    const { gameMode } = playerInfo;
    const queue = this.queues[gameMode];
    const index = queue.findIndex(p => p.socketId === socketId);
    
    if (index === -1) {
      this.playerIndex.delete(socketId);
      return false;
    }

    // Remove from index
    this.playerIndex.delete(socketId);

    // Swap with last element and pop (O(1) removal)
    const lastIndex = queue.length - 1;
    if (index !== lastIndex) {
      const lastPlayer = queue[lastIndex];
      queue[index] = lastPlayer;
      this.playerIndex.set(lastPlayer.socketId, { queueIndex: index, gameMode });
    }
    queue.pop();

    log.debug('Player left lobby', { socketId, gameMode });
    return true;
  }

  /**
   * Get current queue state for a specific mode
   * @param {string} gameMode
   */
  getQueueState(gameMode = 'classic') {
    const validMode = this.queues[gameMode] ? gameMode : 'classic';
    const queue = this.queues[validMode];
    
    // Sort by joinedAt for consistent FIFO display
    return [...queue]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(p => ({
        socketId: p.socketId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
        gameMode: p.gameMode,
      }));
  }

  /**
   * Attempt to match players from the queue for a specific mode (FIFO by joinedAt)
   * @param {string} gameMode
   * @returns {{ matched: boolean, players?: [Player, Player], gameMode?: string }}
   */
  matchPlayers(gameMode = 'classic') {
    const validMode = this.queues[gameMode] ? gameMode : 'classic';
    const queue = this.queues[validMode];
    
    if (queue.length < 2) {
      return { matched: false };
    }

    // Sort by joinedAt to ensure FIFO matching
    queue.sort((a, b) => a.joinedAt - b.joinedAt);
    
    // Rebuild index after sort
    queue.forEach((p, i) => {
      this.playerIndex.set(p.socketId, { queueIndex: i, gameMode: validMode });
    });

    // Take first two players
    const player1 = queue.shift();
    const player2 = queue.shift();

    // Update indices for remaining players
    this.playerIndex.delete(player1.socketId);
    this.playerIndex.delete(player2.socketId);
    
    // Rebuild remaining indices
    queue.forEach((p, i) => {
      this.playerIndex.set(p.socketId, { queueIndex: i, gameMode: validMode });
    });

    incCounter('matchesMade');
    log.info('Players matched', {
      player1: player1.displayName,
      player2: player2.displayName,
      gameMode: validMode,
    });

    return {
      matched: true,
      players: [player1, player2],
      gameMode: validMode,
    };
  }

  /**
   * Check if socket is in any queue
   */
  isInQueue(socketId) {
    return this.playerIndex.has(socketId);
  }

  /**
   * Get player info
   */
  getPlayer(socketId) {
    const playerInfo = this.playerIndex.get(socketId);
    if (!playerInfo) return null;
    
    const { gameMode } = playerInfo;
    const queue = this.queues[gameMode];
    return queue.find(p => p.socketId === socketId) || null;
  }

  /**
   * Get queue size for a specific mode
   */
  getQueueSize(gameMode = 'classic') {
    const validMode = this.queues[gameMode] ? gameMode : 'classic';
    return this.queues[validMode].length;
  }

  /**
   * Get total queue size across all modes
   */
  getTotalQueueSize() {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }

  /**
   * Clear all queues (for testing)
   */
  clearQueue() {
    this.queues = { classic: [], ultimate: [] };
    this.playerIndex.clear();
  }
}

// Singleton
export const lobbyManager = new LobbyManager();

/**
 * Broadcast lobby state with debouncing to prevent spam
 * @param {Server} io 
 * @param {string} gameMode
 */
export function broadcastLobbyState(io, gameMode = 'classic') {
  const validMode = lobbyManager.queues[gameMode] ? gameMode : 'classic';
  
  // Debounce rapid updates per mode
  if (broadcastTimeouts[validMode]) {
    clearTimeout(broadcastTimeouts[validMode]);
  }

  broadcastTimeouts[validMode] = setTimeout(() => {
    broadcastTimeouts[validMode] = null;
    const state = lobbyManager.getQueueState(validMode);
    io.emit('lobbyUpdate', {
      queue: state,
      gameMode: validMode,
      timestamp: Date.now(),
    });
  }, config.lobbyMatchDebounceMs);
}

/**
 * Broadcast immediately without debouncing
 * @param {Server} io
 * @param {string} gameMode
 */
export function broadcastLobbyStateImmediate(io, gameMode = 'classic') {
  const validMode = lobbyManager.queues[gameMode] ? gameMode : 'classic';
  
  if (broadcastTimeouts[validMode]) {
    clearTimeout(broadcastTimeouts[validMode]);
    broadcastTimeouts[validMode] = null;
  }
  
  const state = lobbyManager.getQueueState(validMode);
  io.emit('lobbyUpdate', {
    queue: state,
    gameMode: validMode,
    timestamp: Date.now(),
  });
}
