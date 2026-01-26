/**
 * Match notification service
 * Single Responsibility: Notify players about match results
 */

/**
 * Notify players of a successful match
 * @param {Server} io - Socket.IO server instance
 * @param {string} roomId - Room ID
 * @param {Object} player1 - First player details
 * @param {Object} player2 - Second player details
 * @param {string} gameMode - Game mode
 */
export function notifyPlayersOfMatch(io, roomId, player1, player2, gameMode = 'classic') {
  io.to(player1.socketId).emit('matchFound', {
    roomId,
    player: 'X',
    opponent: player2.displayName,
    gameMode,
  });
  
  io.to(player2.socketId).emit('matchFound', {
    roomId,
    player: 'O',
    opponent: player1.displayName,
    gameMode,
  });
}

/**
 * Notify players of a match failure
 * @param {Server} io - Socket.IO server instance
 * @param {Array} players - Array of player objects
 * @param {string} error - Error message
 */
export function notifyPlayersOfMatchFailure(io, players, error) {
  players.forEach(player => {
    io.to(player.socketId).emit('matchError', { error });
  });
}
