import { listAll as listRegisteredGames } from '../shared/games/registry.js';

const PRODUCTION_BACKEND_URL = 'https://crisscross-backend.fly.dev';
const FRONTEND_ROOM_URL_FORMAT = 'https://harkirat155.github.io/cc/room/{roomId}';

const SOCKET_EVENT_CONTRACT = {
  createRoom: {
    direction: 'client->server',
    description: 'Create a room and seat the socket as X.',
    payload: { clientId: 'stable-session-client-id', displayName: 'Ada', gameId: 'ttt' },
    ack: { roomId: 'ABCDE', player: 'X' },
  },
  joinRoom: {
    direction: 'client->server',
    description: 'Join an existing room as O, restored seat, or spectator.',
    payload: { roomId: 'ABCDE', clientId: 'stable-session-client-id', displayName: 'Grace' },
    ack: { player: 'O' },
  },
  gameUpdate: {
    direction: 'server->client',
    description: 'Broadcast room game state after joins, moves, resets, or game switches.',
    payload: {
      roomId: 'ABCDE',
      gameId: 'ttt',
      board: ['', '', '', '', '', '', '', '', ''],
      turn: 'X',
      turnSlot: 0,
      winner: null,
      winnerSlot: null,
      status: 'active',
      scores: [0, 0],
      boardSpec: { kind: 'grid', rows: 3, cols: 3 },
      moveStyle: 'place',
    },
  },
  makeMove: {
    direction: 'client->server',
    description: 'Apply a legal move for the seated player whose turn it is.',
    payload: {
      roomId: 'ABCDE',
      index: 0,
      move: { type: 'place', cell: 0 },
    },
  },
  resetGame: {
    direction: 'client->server',
    description: 'Start a fresh round in the room while preserving scores.',
    payload: { roomId: 'ABCDE' },
    emits: ['gameUpdate', 'gameReset'],
  },
  switchGame: {
    direction: 'client->server',
    description: 'Switch a room to another supported game; seated players only.',
    payload: { roomId: 'ABCDE', gameId: 'connect4' },
    ack: { success: true, gameId: 'connect4' },
    emits: ['gameUpdate', 'gameReset'],
  },
  joinLobby: {
    direction: 'client->server',
    description: 'Enter FIFO matchmaking with an optional preferred game.',
    payload: { displayName: 'Ada', gameId: 'ttt' },
    ack: { success: true, position: 0 },
    emits: ['lobbyUpdate', 'matchFound'],
  },
};

function getRequestBackendUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host');
  return host ? `${protocol}://${host}` : PRODUCTION_BACKEND_URL;
}

function summarizeGame(rules) {
  return {
    id: rules.id,
    displayName: rules.displayName,
    boardSpec: rules.boardSpec,
    playerInfo: rules.playerInfo,
    moveStyle: rules.moveStyle || 'place',
  };
}

export function buildAgentManifest(req) {
  const backendUrl = getRequestBackendUrl(req);

  return {
    name: 'CrissCross Agent Manifest',
    manifestVersion: '1.0',
    app: {
      name: 'CrissCross',
      packageName: 'crisscross-tictactoe',
      version: '1.0.0',
    },
    backend: {
      detectedUrl: backendUrl,
      productionUrl: PRODUCTION_BACKEND_URL,
    },
    socket: {
      serverUrl: backendUrl,
      namespace: '/',
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      clientHint: `io("${backendUrl}", { transports: ["websocket", "polling"] })`,
    },
    supportedGames: listRegisteredGames().map(summarizeGame),
    roomUrlFormat: FRONTEND_ROOM_URL_FORMAT,
    eventContract: SOCKET_EVENT_CONTRACT,
    notes: [
      'Room and game state changes are subject to server-side Socket.IO rate limits.',
      'Agents are non-privileged clients; use documented public events only.',
      'This manifest is read-only and does not expose secrets, metrics, or admin state.',
    ],
  };
}
