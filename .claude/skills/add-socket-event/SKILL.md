---
name: add-socket-event
description: Add a new client⇄server Socket.IO event end-to-end in CrissCross. Use when the user asks to add, rename, or restructure a real-time event (room, lobby, voice, presence). Enforces the validate→touch→mutate→publish handler pattern and keeps client and server in sync.
---

# Adding a socket event

CrissCross relies on tight client/server agreement on event names and payload shapes. A change on one side without the other silently breaks rooms or causes drift.

## Pre-flight

- Read `CLAUDE.md` "Socket event names" and "Server handler discipline" sections.
- Confirm the event truly needs to be new — many features can be expressed by adding fields to an existing event or by emitting a different broadcast in response to an existing client event.
- Decide the category: `room*` / `lobby*` / `voice:*` / `gameUpdate`-shaped. Follow the naming pattern of the category.

## Step 1 — Define the contract

Write down (in your plan or PR description) before coding:

- **Event name** (client→server): camelCase, prefixed by category for voice (`voice:foo`).
- **Payload shape**: prefer `{ roomId, ... }` for room-scoped events.
- **Ack callback shape**: `{ success: true, ... }` or `{ error: '<message>' }`.
- **Broadcast triggered**: which `io.to(roomId).emit(...)` (if any) fires as a result, and its payload.
- **Rate limit class**: matches an existing one in `rateLimiter.js`, or a new one with justification.
- **Validation rules**: which `validation.js` helpers apply; add new ones if needed.

## Step 2 — Server handler

Pick the right file in `server/handlers/`:

- Room state mutations → `gameHandlers.js` or `roomHandlers.js`
- Lobby/matchmaking → `lobbyHandlers.js`
- WebRTC signaling/presence → `voiceHandlers.js`

Follow the canonical handler skeleton — copy-paste, don't improvise:

```js
socket.on('eventName', (payload, ack) => {
  const normalizedRoomId = validateRoomId(payload?.roomId);
  if (!normalizedRoomId) return ack?.({ error: 'Invalid room' });
  // ...other validation via helpers in handlers/validation.js

  const room = rooms.get(normalizedRoomId);
  if (!room) return ack?.({ error: 'Room not found' });

  touch(normalizedRoomId);

  // Mutate room.state minimally — do not replace whole objects unless intended.
  // ...

  publish(io, normalizedRoomId);  // or io.to(normalizedRoomId).emit('specificEvent', {...})
  ack?.({ success: true });
});
```

Rules:
- Validate **before** any state lookup.
- Return early on every failure; never throw out of a handler.
- Call `touch(roomId)` so LRU/GC sees the activity.
- End with `publish(io, roomId)` for state changes, or a targeted `emit` for non-state notifications.
- Use scoped loggers from `logger.js` (`socketLog.warn`, `roomLog.debug`); no `console.log`.
- Respect existing rate limit middleware in `rateLimiter.js`; add the event to the appropriate bucket.

Register the handler in `server/socketHandlers.js` (or its `handlers/index.js` aggregator) so it's wired on every connection.

## Step 3 — Server tests

Add a co-located test (`server/handlers/*.test.js` or extend `socketHandlers.test.js`). Cover:

- Happy path: ack returns success; correct broadcast fires with expected payload.
- Each validation failure path: invalid roomId, missing room, wrong player slot, malformed payload.
- Rate limit triggers reject the event.
- State mutation is minimal (don't unintentionally clobber unrelated fields).

Mock the socket with `jest.fn()`; invoke the registered handler directly. See `socketHandlers.test.js` for the established pattern.

## Step 4 — Client wiring

`src/hooks/useSocketGame.js` is the **only** place that registers socket listeners and exposes actions. Add:

- An **emit action** in the returned object: e.g. `myAction: (args) => { if (!socket?.connected) return; socket.emit('eventName', { roomId, ...args }, ackHandler); }`.
- If the server broadcasts a new event in response, register a listener inside the existing `addListener` setup (don't create a new useEffect that calls `socket.on` directly).
- Update local state via the existing setters; do not introduce parallel state stores.
- If the new event affects local-fallback (no-room) play, mirror the behavior under the `if (!isMultiplayer)` branch so single-machine play stays consistent.

## Step 5 — Component usage

Consume the new action from `useSocketGame()` in the component that needs it. Do not import `socketManager` or call `getSocket()` directly from components.

## Step 6 — Verification

1. `npm run lint && npm test` — both green.
2. `npm run dev:all`, open two browsers in the same room, exercise the event from each side, watch the network/socket frames in DevTools to confirm payload shapes.
3. Refresh one browser mid-flow — the event handler must tolerate seat restoration (the client id is reused; the socket id changes).
4. Spectator opens the room — verify they receive (or don't receive, by design) the broadcast.
5. Run `npm run check` before declaring done.

## Renaming an existing event

- Grep for the **exact** event name on both sides (`Grep "eventName"`). Update every site in the same change.
- Bump `protocolVersion` in the socket handshake and reject mismatched clients — otherwise an old client + new server (or vice versa) silently breaks.
- If the event is persisted in any reconnection logic, write a migration note in the PR description.

## Common pitfalls

- **Don't** open a second socket — components must go through `useSocketGame`.
- **Don't** skip the ack on the client side if the server provides one — silent failures are the most common source of bugs in this codebase.
- **Don't** mutate `room` or `room.state` shape without checking every other handler that reads it.
- **Don't** broadcast PII (display name is fine; client id is fine; do not include socket internals).
- **Do** prefer extending `gameUpdate` payload over inventing a new broadcast when the change is a state delta.
