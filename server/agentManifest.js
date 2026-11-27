import { listAll as listRegisteredGames } from '../shared/games/registry.js';

// The Fly Socket.IO host, deprecated (manifest v1). Its sunset is relative: Fly stays up 14 days after the cut-over.
const PRODUCTION_BACKEND_URL = 'https://crisscross-backend.fly.dev';
const SOCKET_IO_SUNSET = '14 days after the Worker cut-over (brick 15 of ADR 0001); no calendar date yet';
// The Worker host for the JSON WebSocket protocol (docs/measurements-2026-11.md). Kept in public/agent-manifest.json, llms.txt and src/Agents.jsx.
export const WORKER_URL = 'https://cc-api.harkirat-hira.workers.dev';
const FRONTEND_ROOM_URL_FORMAT = 'https://harkirat155.github.io/cc/room/{roomId}';

const EVENTS = {
  clientToServer: [
    { name: 'createRoom', ack: true, payloadFields: ['clientId', 'displayName', 'gameId', 'listPublicly'], ackFields: ['player', 'roomId'] },
    { name: 'joinRoom', ack: true, payloadFields: ['clientId', 'displayName', 'roomId', 'token'], ackFields: ['player'] },
    { name: 'updateDisplayName', ack: false, payloadFields: ['displayName', 'roomId'] },
    { name: 'leaveRoom', ack: true, payloadFields: ['clientId', 'roomId'], ackFields: ['ok'] },
    { name: 'makeMove', ack: false, payloadFields: ['index', 'move', 'roomId'] },
    { name: 'resetGame', ack: false, payloadFields: ['roomId'] },
    { name: 'resetScores', ack: false, payloadFields: ['roomId'] },
    { name: 'switchGame', ack: true, payloadFields: ['gameId', 'roomId'], ackFields: ['gameId', 'success'] },
    { name: 'requestNewGame', ack: false, payloadFields: ['roomId'] },
    { name: 'cancelNewGameRequest', ack: false, payloadFields: ['roomId'] },
    { name: 'resign', ack: false, payloadFields: ['roomId'] },
    { name: 'offerDraw', ack: false, payloadFields: ['roomId'] },
    { name: 'cancelDrawOffer', ack: false, payloadFields: ['roomId'] },
    { name: 'acceptDraw', ack: false, payloadFields: ['roomId'] },
    { name: 'declineDraw', ack: false, payloadFields: ['roomId'] },
    { name: 'emote', ack: false, payloadFields: ['emote', 'roomId'] },
    { name: 'joinLobby', ack: true, payloadFields: ['displayName', 'gameId'], ackFields: ['position', 'success'] },
    { name: 'leaveLobby', ack: true, payloadFields: [], ackFields: ['success'] },
    { name: 'getLobbyState', ack: true, payloadFields: [], ackFields: ['queue'] },
    { name: 'voice:join', ack: false, payloadFields: ['muted', 'roomId'] },
    { name: 'voice:leave', ack: false, payloadFields: ['roomId'] },
    { name: 'voice:mute-state', ack: false, payloadFields: ['muted', 'roomId'] },
    { name: 'voice:signal', ack: false, payloadFields: ['data', 'roomId', 'targetId'] },
  ],
  serverToClient: [
    { name: 'gameUpdate', payloadFields: ['board', 'boardSpec', 'drawOfferer', 'gameId', 'lastEvents', 'lastMove', 'lastMoveBy', 'marks', 'moveStyle', 'newGameRequestedAt', 'newGameRequester', 'oScore', 'playerInfo', 'roomId', 'roster', 'scores', 'status', 'turn', 'turnSlot', 'voiceRoster', 'winner', 'winnerSlot', 'winningCells', 'winningLine', 'xScore'], rosterFields: ['O', 'OName', 'X', 'XName', 'spectators'] },
    { name: 'gameReset', payloadFields: ['gameId', 'reason', 'roomId'] },
    { name: 'startGame', payloadFields: [] },
    { name: 'emote', payloadFields: ['emote', 'slot'] },
    { name: 'lobbyUpdate', payloadFields: ['queue', 'timestamp'] },
    { name: 'matchFound', payloadFields: ['opponent', 'player', 'roomId', 'token'] },
    { name: 'matchError', payloadFields: ['error'] },
    { name: 'voice:user-joined', payloadFields: ['muted', 'socketId'] },
    { name: 'voice:user-left', payloadFields: ['socketId'] },
    { name: 'voice:mute-state', payloadFields: ['muted', 'socketId'] },
    { name: 'voice:signal', payloadFields: ['data', 'from', 'roomId'] },
    { name: 'error', payloadFields: ['code', 'message', 'retryAfter'] },
  ],
};

const PROTOCOL = {
  type: 'websocket-json',
  url: WORKER_URL,
  webSocketUrl: WORKER_URL.replace('https', 'wss'),
  routes: { lobby: '/ws/lobby', room: '/ws/room/{roomId}', newRoom: '/ws/room/new' },
  spec: 'https://github.com/Harkirat155/cc/blob/main/docs/ws-protocol.md',
  envelope: {
    frame: '{"t":"<event>","id"?:n,"d"?:{...}}',
    ack: 'A client frame with an integer "id" gets {"t":"ack","id":n,"d":{...}} back; "d" holds an "error" string on failure. Frames without "id" get no ack.',
    hello: 'The first frame on every socket is {"t":"hello","d":{"sid":string}}.',
    unknown: 'Unparseable and unknown frames are ignored.',
  },
  flow: [
    'Open wss://HOST/ws/lobby and read the hello frame.',
    'Send joinLobby ({"t":"joinLobby","id":1,"d":{"displayName":"Agent Bot","gameId":"ttt"}}); the ack is {"success":true,"position":n}. When two sockets are queued the lobby sends each of them matchFound with roomId, player (X or O), opponent and a one-time token.',
    'Open /ws/room/{roomId} with the roomId from matchFound. To make a room yourself, open /ws/room/new and send createRoom instead of joinRoom; it seats you as X and the ack is {"roomId":string,"player":"X"}.',
    'On /ws/room/{roomId}, on every socket open (reconnects too), send joinRoom with roomId, clientId and, after a lobby match, the token; the ack is {"player":"X"|"O"|"spectator"}. Keep the same clientId across reconnects. Do not send joinRoom on /ws/room/new: createRoom already seated you.',
    'Read gameUpdate. When status is "active" and turnSlot is your seat (X is 0, O is 1), send makeMove with roomId and move. makeMove has no ack; an illegal move is dropped silently.',
    'The game is over when gameUpdate.status is not "active"; winnerSlot is the winning slot, or "draw".',
  ],
};

// Manifest v1 event contract (Socket.IO), kept under deprecated.socketIo.
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
    manifestVersion: '2.0',
    app: {
      name: 'CrissCross',
      packageName: 'crisscross-tictactoe',
      version: '1.0.0',
    },
    protocol: PROTOCOL,
    events: EVENTS,
    deprecated: {
      socketIo: {
        status: 'deprecated',
        manifestVersion: '1.0',
        sunset: SOCKET_IO_SUNSET,
        replacedBy: 'protocol',
        url: PRODUCTION_BACKEND_URL,
        detectedUrl: backendUrl,
        namespace: '/',
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        clientHint: `io("${backendUrl}", { transports: ["websocket", "polling"] })`,
        eventContract: SOCKET_EVENT_CONTRACT,
      },
    },
    supportedGames: listRegisteredGames().map(summarizeGame),
    roomUrlFormat: FRONTEND_ROOM_URL_FORMAT,
    notes: [
      'Room and game state changes are subject to server-side rate limits.',
      'Agents are non-privileged clients; use documented public events only.',
      'This manifest is read-only and does not expose secrets, metrics, or admin state.',
    ],
  };
}
