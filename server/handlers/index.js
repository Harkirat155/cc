// Barrel file for socket handlers

export { registerRoomHandlers } from './roomHandlers.js';
export { registerGameHandlers } from './gameHandlers.js';
export { registerVoiceHandlers } from './voiceHandlers.js';
export { registerLobbyHandlers, handleMatch } from './lobbyHandlers.js';
export { validateRoomId, validateDisplayName, validateIndex, validateGameId } from './validation.js';
