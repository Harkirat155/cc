# WebSocket protocol (ADR 0001, brick 4a)

JSON frames over one WebSocket, replacing Socket.IO. Game rules and payload shapes are unchanged from the
Socket.IO contract; only the envelope is new. `shared/wsProtocol.test.js` checks that the headings below equal
the events the server registers (17 client to server, plus 6 Worker only) and emits (12 server to client, plus 1 Worker only).

## Sockets (Worker)

The Worker serves two upgrade routes (`worker/src/index.ts`): `/ws/lobby`, and `/ws/room/:code` (`/ws/room/new` has
the Worker pick a free code, then the client sends `createRoom`). `VITE_SOCKET_SERVER` is the base URL; the client
shim (`src/utils/wsSocket.js`) opens the lobby socket first, moves to the room route on `createRoom`, `joinRoom` or
`matchFound`, and on every Room socket open (first and each reconnect) sends `joinRoom` with `clientId` and, after
a lobby match, the seat `token`. Any other path is 404. Saved curls: `docs/e2e.md`.

## Envelope

Every frame is one JSON text message: `{"t":"<event>","id"?:n,"d"?:{...}}`.

- `t` (string): event name. `d` (object): the payload; omitted when the event has none.
- `id` (integer, client-chosen, unique per socket): present only on a frame that wants an ack.
- Ack frame, server to client, once per acked request: `{"t":"ack","id":n,"d":{...}}`. `d` is exactly the
  object the Socket.IO ack callback received (`{"error":"..."}` on failure). Not an event; it has no section.
- `hello`, Worker only: `{"t":"hello","d":{"sid":string}}` is the first frame the server sends on every socket
  (Room and Lobby), before any ack or event. `sid` is that socket's server id, the one in `roster`,
  `voiceRoster` and the lobby queue's `socketId`. The shim sets `socket.id` to it and does not pass it to app
  listeners; each route swap opens a new socket and so a new `sid`. Not an Express event, so it has no section.
- No ack is ever sent for a frame without `id`. A client times out an ack on its own clock.
- Seat token (new in v2): `matchFound.d.token` is one-time. Every Room socket open sends `joinRoom` with
  `clientId` plus that `token`; the Room binds it once.
- Unparseable or unknown frames are ignored, as the Socket.IO server ignores unknown events.
- Room ids are 5 chars, trimmed and upper-cased, `[A-Z0-9]`. Display names are trimmed to 20 chars, min 2
  (invalid means absent). Game ids are lower-cased and must be registered. (`server/handlers/validation.js:11-47`)

### Error frames

- Rate limit, unacked, any event: `{"t":"error","d":{"code":"RATE_LIMITED","message":string,"retryAfter":number}}`
  and the offending frame is dropped (`server/rateLimiter.js:113`). This is the `error` event below.
- Handler failure on an acked event: the ack carries `{"error":string}` (or `{"success":false,"error":string}`
  for `switchGame`, `joinLobby`, `leaveLobby`). Unacked events drop silently on bad input, as today.

## Client to server (17, plus 6 Worker only)

### `createRoom`
Frame: `{"t":"createRoom","id":n,"d"?:{"clientId"?:string,"displayName"?:string,"gameId"?:string}}`.
Ack: `{"roomId":string,"player":"X"}`; error `{"error":"Unable to create room, please try again"}`. Then `gameUpdate`.
Source: server/handlers/roomHandlers.js:21

### `joinRoom`
Frame: `{"t":"joinRoom","id":n,"d":{"roomId":string,"clientId"?:string,"displayName"?:string,"token"?:string}}`.
Ack: `{"player":"X"|"O"|"spectator"}`; errors `{"error":"Invalid room ID"}`, `{"error":"Room not found"}`.
Emits `startGame` when both seats fill, then `gameUpdate`. `token` is v2 only.
Source: server/handlers/roomHandlers.js:65

### `updateDisplayName`
Frame: `{"t":"updateDisplayName","d":{"roomId":string,"displayName":string}}`. No ack, no error frame; ignored unless seated. Then `gameUpdate`.
Source: server/handlers/roomHandlers.js:161

### `leaveRoom`
Frame: `{"t":"leaveRoom","id":n,"d":{"roomId":string,"clientId"?:string}}`.
Ack: `{"ok":true}`; errors `{"error":"Invalid room ID"}`, `{"error":"Room not found"}`, `{"error":"Not in room"}`.
Source: server/handlers/roomHandlers.js:183

### `makeMove`
Frame: `{"t":"makeMove","d":{"roomId":string,"move"?:object,"index"?:integer 0-8}}`. `move` wins; legacy `index` becomes `{"type":"place","cell":index}`. No ack; illegal moves drop silently. Then `gameUpdate`.
Source: server/handlers/gameHandlers.js:59

### `resetGame`
Frame: `{"t":"resetGame","d":{"roomId":string}}`. No ack. Emits `gameUpdate` then `gameReset`.
Source: server/handlers/gameHandlers.js:108

### `resetScores`
Frame: `{"t":"resetScores","d":{"roomId":string}}`. No ack. Then `gameUpdate`.
Source: server/handlers/gameHandlers.js:138

### `switchGame`
Frame: `{"t":"switchGame","id":n,"d":{"roomId":string,"gameId":string}}`.
Ack: `{"success":true,"gameId":string}`; errors `{"success":false,"error":"Invalid room ID"|"Invalid game"|"Room not found"|"Only seated players can switch games"}`.
Emits `gameUpdate` then `gameReset` with `reason:"gameSwitch"`.
Source: server/handlers/gameHandlers.js:150

### `requestNewGame`
Frame: `{"t":"requestNewGame","d":{"roomId":string}}`. No ack. Then `gameUpdate`.
Source: server/handlers/gameHandlers.js:190

### `cancelNewGameRequest`
Frame: `{"t":"cancelNewGameRequest","d":{"roomId":string}}`. No ack. Then `gameUpdate`.
Source: server/handlers/gameHandlers.js:203

### `resign`
Frame: `{"t":"resign","d":{"roomId":string}}`. No ack. Seated players only, while the game is active with both seats filled; otherwise ignored. The other seat wins and its score rises by one. Then `gameUpdate`. Worker only.
Source: worker/src/room.ts

### `offerDraw`
Frame: `{"t":"offerDraw","d":{"roomId":string}}`. No ack. Seated players only, while the game is active with both seats filled. Sets `drawOfferer` to the sender's socket id; the offer clears when the offerer leaves or disconnects. Then `gameUpdate`. Worker only.
Source: worker/src/room.ts

### `cancelDrawOffer`
Frame: `{"t":"cancelDrawOffer","d":{"roomId":string}}`. No ack. Only the offerer can cancel. Then `gameUpdate`. Worker only.
Source: worker/src/room.ts

### `acceptDraw`
Frame: `{"t":"acceptDraw","d":{"roomId":string}}`. No ack. Only the seat that did not offer can accept; the game ends as a draw, scores unchanged. Then `gameUpdate`. Worker only.
Source: worker/src/room.ts

### `declineDraw`
Frame: `{"t":"declineDraw","d":{"roomId":string}}`. No ack. Only the seat that did not offer can decline; it clears the offer. Then `gameUpdate`. A move, `resetGame` or `switchGame` also clears a pending offer. Worker only.
Source: worker/src/room.ts

### `emote`
Frame: `{"t":"emote","d":{"roomId":string,"emote":"👍"|"👏"|"😮"|"😅"|"🤔"|"🔥"}}`. No ack. Seated players only; any other value is dropped, and so is an emote less than 1 s after the same socket's last one. Relayed to the other sockets as `emote`. Worker only.
Source: worker/src/room.ts

### `joinLobby`
Frame: `{"t":"joinLobby","id":n,"d"?:{"displayName"?:string,"gameId"?:string}}`.
Ack: `{"success":true,"position":number}`; error `{"success":false,"error":string}`. May trigger `matchFound` or `matchError`.
Source: server/handlers/lobbyHandlers.js:27

### `leaveLobby`
Frame: `{"t":"leaveLobby","id":n}`. Ack: `{"success":true}`; error `{"success":false,"error":"Not in lobby"}`.
Source: server/handlers/lobbyHandlers.js:45

### `getLobbyState`
Frame: `{"t":"getLobbyState","id":n}`. Ack: `{"queue":[{"socketId":string,"displayName":string,"gameId":string,"joinedAt":number}]}`. The current client never sends it.
Source: server/handlers/lobbyHandlers.js:56

### `voice:join`
Frame: `{"t":"voice:join","d":{"roomId":string,"muted"?:boolean}}`. No ack. Emits `voice:user-joined` to the room minus sender, then `gameUpdate`.
Source: server/handlers/voiceHandlers.js:12

### `voice:leave`
Frame: `{"t":"voice:leave","d":{"roomId":string}}`. No ack. Emits `voice:user-left` to the room minus sender, then `gameUpdate`.
Source: server/handlers/voiceHandlers.js:30

### `voice:mute-state`
Frame: `{"t":"voice:mute-state","d":{"roomId":string,"muted":boolean}}`. No ack. Emits `voice:mute-state` to the room minus sender, then `gameUpdate`.
Source: server/handlers/voiceHandlers.js:44

### `voice:signal`
Frame: `{"t":"voice:signal","d":{"roomId":string,"targetId":string,"data":any}}`. No ack; dropped unless `targetId` and `data` are set. Relayed as `voice:signal`.
Source: server/handlers/voiceHandlers.js:62

## Server to client (12, plus 1 Worker only)

All server frames are unacked and carry no `id`.

### `gameUpdate`
`{"t":"gameUpdate","d":{...}}` to the room. Express batches per tick; the Worker sends one after each handled frame. `d` is the full room state: `board`, `turn`, `winner`, `winningLine`, `xScore`, `oScore`, `turnSlot`, `winnerSlot`, `scores:[n,n]`, `status`, `winningCells`, `playerInfo`, `marks`, `boardSpec`, `moveStyle`, `lastMove`, `lastEvents`, `lastMoveBy`, `newGameRequester`, `newGameRequestedAt`, `drawOfferer` (socket id of the pending draw offer or null), `roomId`, `gameId`, `roster:{X,O,XName,OName,spectators:[string]}`, `voiceRoster:{[socketId]:{muted:boolean}}`.
Source: server/roomPublisher.js:146, :183

### `gameReset`
`{"t":"gameReset","d":{"roomId":string,"gameId"?:string,"reason"?:"gameSwitch"}}` to the room.
Source: server/handlers/gameHandlers.js:135, :182

### `startGame`
`{"t":"startGame"}` to the room when both seats are filled; no `d`.
Source: server/handlers/roomHandlers.js:155

### `emote`
`{"t":"emote","d":{"slot":0|1,"emote":string}}` to every other joined socket when a seated player sends `emote`. Not stored; clients show it for about 2.5 s. Worker only.
Source: worker/src/room.ts

### `lobbyUpdate`
`{"t":"lobbyUpdate","d":{"queue":[{"socketId":string,"displayName":string,"gameId":string,"joinedAt":number}],"timestamp":number}}` to every lobby socket, debounced.
Source: server/lobbyManager.js:196, :213

### `matchFound`
`{"t":"matchFound","d":{"roomId":string,"player":"X"|"O","opponent":string,"token":string}}` to one socket. `token` is v2 only (one-time seat token).
Source: server/utils/matchNotifier.js:14, :20

### `matchError`
`{"t":"matchError","d":{"error":string}}` to each matched socket when room creation failed.
Source: server/utils/matchNotifier.js:35

### `voice:user-joined`
`{"t":"voice:user-joined","d":{"socketId":string,"muted":boolean}}` to the room minus sender.
Source: server/handlers/voiceHandlers.js:23

### `voice:user-left`
`{"t":"voice:user-left","d":{"socketId":string}}` to the room minus sender.
Source: server/handlers/voiceHandlers.js:40

### `voice:mute-state`
`{"t":"voice:mute-state","d":{"socketId":string,"muted":boolean}}` to the room minus sender.
Source: server/handlers/voiceHandlers.js:55

### `voice:signal`
`{"t":"voice:signal","d":{"from":string,"data":any,"roomId":string}}` to the one socket named by `targetId`.
Source: server/handlers/voiceHandlers.js:66

### `error`
`{"t":"error","d":{"code":"RATE_LIMITED","message":string,"retryAfter":number}}` to the offending socket. See Error frames.
Source: server/rateLimiter.js:113

### `server:shutdown`
Express (Fly) host only; the Worker never sends it.
`{"t":"server:shutdown","d":{"message":"Server is restarting"}}` to all sockets.
Source: server/app.js:213
