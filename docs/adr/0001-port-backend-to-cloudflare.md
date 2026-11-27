# 0001. Port the backend from Fly.io to Cloudflare Workers + Durable Objects

- Status: Proposed (planning only; no code built yet)
- Date: 2026-11-27
- Supersedes: DEPLOY_BACKEND.md "Fly.io is the supported target"
- Review (2026-11-27): a cross-family review (Grok) checked this ADR against the code. It added the seat-loss risk
  and the seat token, the Fly deprecation window and manifest v2, billed-meter measurement, and split the bricks
  (12 became 16). All seven findings were checked against the code and applied.

## Context

The backend is one long-lived Node 24 process (Express 5 + Socket.IO 4) in a Docker image on Fly
(`fly.toml`, `Dockerfile`, one 256 MB shared machine in `sin`). All game state is process memory, so it is
single-instance by design (DEPLOY_BACKEND.md:3). The frontend is static on GitHub Pages and reads the backend
URL from `VITE_SOCKET_SERVER` / `VITE_API_BASE` (`src/utils/socketManager.js:18`, `src/Game.jsx:107-109`).
Goal: nothing paid, no card, same gameplay. The owner wants Fly gone.

### Inventory (branch loop/adr-do-port, origin/main 5d4ec38)

HTTP routes (`server/app.js`). Middleware: shutdown gate (:43), hand-rolled CORS (:46-63, methods GET,POST,OPTIONS,
header Content-Type), gzip (:67), JSON body cap 32 kb (:73).

| # | Route | Where | Behaviour |
|---|---|---|---|
| 1 | GET `/health` | app.js:85, metrics.js:111 | 200 healthy / 503; reads in-memory metrics |
| 2 | GET `/metrics` | app.js:91, metrics.js:32 | counters, rooms, lobby, uptime; unauthenticated |
| 3 | GET `/agent/manifest.json` | app.js:96, agentManifest.js:85 | static doc; backend URL from `x-forwarded-*`/Host (:67-72) |
| 4 | POST `/feedback` | app.js:103 | validates rating 1-5, message >=5 chars; ring buffer (feedbackStore.js:53, max 200) + Sheets append (googleSheetsClient.js:64); 201 `{status,id,sheetsSync}` |

Socket.IO. Client to server: **17 events** (+ built-in `disconnect`). Server to client: **12 events**.

| Client to server (ack?) | Where |
|---|---|
| `createRoom` (ack, optional payload) | handlers/roomHandlers.js:21 |
| `joinRoom` (ack) | roomHandlers.js:65 |
| `updateDisplayName` | roomHandlers.js:161 |
| `leaveRoom` (ack) | roomHandlers.js:183 |
| `makeMove` | handlers/gameHandlers.js:59 |
| `resetGame`, `resetScores` | gameHandlers.js:108, :138 |
| `switchGame` (ack) | gameHandlers.js:150 |
| `requestNewGame`, `cancelNewGameRequest` | gameHandlers.js:190, :203 |
| `joinLobby` (ack), `leaveLobby` (ack), `getLobbyState` (ack) | handlers/lobbyHandlers.js:27, :45, :56 |
| `voice:join`, `voice:leave`, `voice:mute-state`, `voice:signal` | handlers/voiceHandlers.js:12, :30, :44, :62 |

| Server to client | Where | Scope |
|---|---|---|
| `gameUpdate` | roomPublisher.js:146, :183 | room (debounced publish) |
| `gameReset` | gameHandlers.js:135, :182 | room |
| `startGame` | roomHandlers.js:155 | room |
| `lobbyUpdate` | lobbyManager.js:196, :213 | **every connected socket** (`io.emit`) |
| `matchFound`, `matchError` | utils/matchNotifier.js:14, :20, :35 | one socket |
| `voice:user-joined`, `voice:user-left`, `voice:mute-state` | voiceHandlers.js:23, :40, :55 | room minus sender |
| `voice:signal` | voiceHandlers.js:66 | one socket by id (WebRTC relay) |
| `error` (RATE_LIMITED) | rateLimiter.js:113 | one socket |
| `server:shutdown` | app.js:213 | all |

Frontend socket usage: one singleton `io()` (`src/utils/socketManager.js:31`, transports websocket+polling,
10 reconnect attempts). The client emits 16 of the 17 events (`getLobbyState` is never emitted;
`src/hooks/useSocketGame.js:229-667`, `src/hooks/useVoiceChat.js:86-221`) and listens to 9 server events
(`src/hooks/socketHandlers.js:186-191`, `useVoiceChat.js:146-170`); it never reads `error`, `server:shutdown`
or `voice:mute-state`, and never reads `socket.recovered`. **Acks are load-bearing**: 7 emits use callbacks
(`useSocketGame.js:229, 264, 281, 304, 569`). External agents are told to use `socket.io-client` against the
backend (`src/Agents.jsx:18-60`, manifest in agentManifest.js): that public contract changes too.

State, all in process memory (nothing persists a restart):

| State | Where | Notes |
|---|---|---|
| `rooms` Map, `socketRooms` Map | roomManager.js:18, :21 | LRU cap `ROOM_LIMIT` 500 (:44); room code from utils/roomIdGenerator.js |
| GC | roomGC.js:15-33 | every 10 s, deletes rooms idle > 120 s (`lastTouched`) |
| Lobby queue (array + index Map) | lobbyManager.js:10-15, singleton :181 | FIFO match, 100 ms debounced broadcast (:187), `LOBBY_MAX_QUEUE_SIZE` 100 |
| Rate limiter | rateLimiter.js:10, :20 | per-socket sliding window, 50 events/s, 30 s ban; cleanup timer :131 |
| Publish debounce | roomPublisher.js:9 | per-room pending timers |
| Metrics counters, feedback ring | metrics.js:23, feedbackStore.js:53 | lost on restart today |
| Sheets client (cached JWT) | googleSheetsClient.js:52 | `googleapis` library |
| Shutdown hooks | gracefulShutdown.js | SIGTERM drain, 10 s; irrelevant on Workers |

Env vars: PORT, NODE_ENV, CORS_ORIGIN, ROOM_LIMIT, ROOM_TTL_MS, ROOM_GC_INTERVAL_MS, RATE_LIMIT_WINDOW_MS,
RATE_LIMIT_MAX_EVENTS, RATE_LIMIT_BAN_DURATION_MS, LOBBY_MAX_QUEUE_SIZE, LOBBY_MATCH_DEBOUNCE_MS,
SOCKET_PING_TIMEOUT, SOCKET_PING_INTERVAL, SOCKET_MAX_HTTP_BUFFER_SIZE, LOG_LEVEL, ENABLE_DEBUG_LOGS,
SHUTDOWN_TIMEOUT_MS, FEEDBACK_MAX_ENTRIES (`server/config.js:15-52`); secrets GOOGLE_SERVICE_ACCOUNT_EMAIL,
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_FEEDBACK_RANGE
(googleSheetsClient.js:5-10). Values are never in this ADR.

### Answers to the questions that shape the decision

1. **Socket.IO on Workers.** The official `socket.io` server needs Node `http`; it does not run on Workers. The
   one shim, `socket.io-serverless` (https://www.npmjs.com/package/socket.io-serverless, jokester, v0.2.1,
   ~51 weekly downloads, last synced Oct 2024), runs two Durable Objects (engine.io + socket.io) but **does not
   support acknowledgements, connection state recovery, or restoring rooms after hibernation**
   (per the npm listing and the author's write-up; I did not read its source). We need acks (7 call sites) and
   rooms, so it is rejected. A Socket.IO-protocol shim of our own would be a larger job than changing the
   contract. **The client moves to plain WebSockets, one Durable Object per room, with the Hibernation API.**
   Contract change: 17 + 12 events, 5 of them acked, re-expressed as JSON frames `{t, id?, ...}` with a
   request id for acks. The `io()` client is used in one file (socketManager.js) plus the Agents page.
2. **Lobby.** Yes, global: one queue, one broadcast to all lobby clients (lobbyManager.js:181, :196).
   One singleton `Lobby` DO (`idFromName("lobby")`). Load: one frame per join/leave/match plus a debounced
   `lobbyUpdate` fan-out. Outbound frames are free (below); inbound join/leave are tiny. Only clients on the
   lobby screen connect to it (today `io.emit` hits everyone), so load drops. Soft cap ~1,000 req/s per DO
   is far above a hobby game.
3. **Sheets auth.** Yes in principle. A service-account JWT is RS256 over a PKCS8 key; Workers have WebCrypto
   `crypto.subtle.importKey("pkcs8")` + `sign("RSASSA-PKCS1-v1_5")`. Replace `googleapis` (Node-only, heavy)
   with two `fetch` calls (token endpoint, then `values:append`). Not yet proven live; brick 10 proves it
   with a local stub and one manual real append. Use `ctx.waitUntil` so the 201 is not blocked.
4. **CORS.** Default is `'*'` (`server/config.js:25`), reused by Socket.IO (app.js:178). The port locks it:
   `ALLOWED_ORIGINS` has no default; the Worker rejects a WebSocket upgrade whose `Origin` is not listed
   (browsers always send it) and answers CORS only for listed origins. Production value
   `https://harkirat155.github.io` (DEPLOY_BACKEND.md). Unset means deny, not `*`.
5. **Prior art.** `origin/copilot/migrate-backend-to-rust` (4 commits, 30 files, +4241 lines, forked at
   f174f8f) is an axum + `socketioxide` rewrite in `server-rust/`.
   It targets a VM/Docker host, not Workers, so it does not answer this goal. Reusable: nothing as code. It
   confirms the event list (it emits `createRoom`, `joinRoom`, `startGame`, `gameReset`, `matchFound`,
   `lobbyUpdate`, voice:*) and that the model translates one-to-one (it covers voice). Its
   `socket_handlers.rs` has no rate limiter (no match for rate-limit code). It is a stale partial port, so
   its only value is as a second reading of the event list. Do not merge or rebase it.

### Cloudflare free-tier limits (fetched 2026-11-27)

- Durable Objects pricing, https://developers.cloudflare.com/durable-objects/platform/pricing/ : Free allows
  **SQLite-backed DOs only**; **100,000 requests/day**; **13,000 GB-s/day**; 5 M rows read/day; 100 k rows
  written/day; 5 GB stored. Incoming WebSocket messages bill **20:1** (100 messages = 5 requests); **outgoing
  messages and protocol pings are free**; opening a socket is one request. Hibernation-eligible idle objects are
  not billed duration. Over any limit, operations fail until 00:00 UTC.
- DO limits, https://developers.cloudflare.com/durable-objects/platform/limits/ : 30 s CPU per invocation (reset
  per message), 32 MiB max received WebSocket message, 100 DO classes on Free, soft ~1,000 req/s per object, 5 GB
  account storage. The page contradicts itself on per-object storage (10 GB vs "1 GB on Free"): unverified; we
  need kilobytes.
- Hibernation, https://developers.cloudflare.com/durable-objects/best-practices/websockets/ : "Billable Duration
  (GB-s) charges do not accrue during hibernation"; clients stay connected while the object is evicted.
  **Alarms, `setTimeout` and `setInterval` prevent hibernation.** No hard per-object connection cap is stated
  ("thousands").
- Workers limits, https://developers.cloudflare.com/workers/platform/limits/ : **100,000 requests/day**, **10 ms CPU
  per HTTP request**, 50 subrequests, 128 MB, 5 Cron Triggers, 64 env vars. Free-plan DO CPU limit is not on this
  page (see DO limits above).
- Not verified: whether signup needs a card (no fetched page says; owner confirms in the dashboard before brick 1);
  exact hibernation idle timeout; WebSocket-message billing for Worker-side (non-DO) sockets.

Sizing (arithmetic on the numbers above, not measured): 100 k requests/day is ~2 M inbound messages/day at 20:1,
minus connects. A 9-cell game is ~15 moves, so ~60-100 inbound frames per game including resets and display
names: ~20 k games/day. Duration: 13,000 GB-s at 128 MB is ~29 h of un-hibernated object time/day, so keep
objects hibernating between moves (no timers).

## Decision

Port the backend to **one Worker (TypeScript, Hono) plus two Durable Object classes**: `Room` (one per room
code, WebSocket Hibernation, SQLite storage) and `Lobby` (singleton). Replace Socket.IO with a small JSON
WebSocket protocol on both server and client (`src/utils/socketManager.js` becomes a thin client with ack
by request id, reconnect and backoff). Move the game rules (`server/gameLogic.js`, `shared/`) unchanged; they
are pure. Keep the Fly service as source of truth and rollback until cut-over; the web app switches by
`VITE_SOCKET_SERVER`/`VITE_API_BASE` only. Those two point at the Worker; the agent docs, `llms.txt` and the
Agents page keep naming the Fly Socket.IO host. Fly stays up for a **14-day deprecation window** from cut-over, then the
JSON protocol is published as agent manifest v2 (v1 is Socket.IO at Fly, `manifestVersion` '1.0',
agentManifest.js:90). The client picks the shim when `VITE_SOCKET_SERVER` is a `wss://` URL, so no third flag.
Seats: `matchFound` carries a one-time seat token, and every Room socket open sends `joinRoom` with `clientId`
plus the token. CORS is an explicit allow-list with no wildcard default.

Shape: `worker/src/index.ts` (routes, CORS, upgrade routing `/ws/room/:code`, `/ws/lobby`), `room.ts`,
`lobby.ts`, `feedback.ts`, `wrangler.jsonc` (`new_sqlite_classes` migration, never `new_classes`, which would need
Paid). Tests: Vitest + `@cloudflare/vitest-pool-workers`.

### Substitution table

| Node / Express piece | On Workers |
|---|---|
| `express`, routes, JSON cap (app.js:73) | Hono; body cap check on `/feedback` |
| hand-rolled CORS (app.js:46) | Hono middleware with allow-list, no `*` |
| `compression` | automatic at the edge; delete |
| `socket.io` server, rooms, acks | Worker routes upgrade to `Room`/`Lobby` DO; `acceptWebSocket`, `webSocketMessage`; ack = `{t:"ack", id}` frame |
| `rooms` / `socketRooms` Maps, LRU (roomManager.js) | one DO per room code; state in DO SQLite so it survives hibernation; LRU cap dropped (DOs are isolated) |
| room code generator + collision check | Worker picks code, asks `Room` DO `init` (fails if already set); retry |
| `roomGC` interval (roomGC.js:15) | a single alarm per room, re-armed on activity; fires once at TTL then `deleteAll()` (alarm only while idle-waiting, accepted cost) |
| `lobbyManager` singleton, `io.emit` broadcast | `Lobby` DO, queue in SQLite, 100 ms debounce via alarm; `matchFound` carries the new room code, the player's seat and a one-time seat token; the `Room` DO binds the token; clients open the Room socket and send `joinRoom` |
| `connectionStateRecovery` (app.js:186, 2 min) | dropped; replaced by `joinRoom` with `clientId` (+ token) on every socket open (the seat rebind of roomHandlers) |
| `matchNotifier` socket ids | per-socket tags (`serializeAttachment`) |
| rate limiter (rateLimiter.js:20) | per-connection counters in the DO (limit is per socket, so DO-local is exact); same 50/s, 30 s ban |
| `roomPublisher` debounce timers | coalesce within one message turn; no timers where avoidable (timers block hibernation) |
| `voice:*` relay | `Room` DO forwards to the target socket tag; WebRTC stays peer-to-peer |
| `metrics.js`, `/metrics`, `/health` | Worker handler; counters in the Lobby DO or dropped; `/metrics` becomes allow-listed or removed (open today) |
| `feedbackStore` ring | DO SQLite table in `Lobby`, trimmed to 200 |
| `googleapis` JWT | WebCrypto RS256 + `fetch` (answer 3) |
| `agentManifest` | Worker route; backend URL from `new URL(req.url)`; publish the JSON protocol as manifest v2 after cut-over (v1 stays on Fly for the window) |
| `gracefulShutdown`, `logger` | delete; Workers Logs |
| `Dockerfile`, `fly.toml`, DEPLOY_BACKEND.md | delete after cut-over; `wrangler deploy` doc |
| `process.env` | `env` bindings; secrets via `wrangler secret put` |

## Rejected alternatives

1. **Socket.IO shim `socket.io-serverless`.** No acks, no state recovery, rooms lost on hibernation, tiny adoption.
2. **Write our own Socket.IO protocol server on DOs.** Keeps the client but means re-implementing engine.io
   (heartbeat, upgrade, framing) for a 12/17 event app. Worse than a JSON protocol we own.
3. **Stay on Fly.** The owner's constraint. Also not free-no-card (recalled, not fetched today).
4. **Cloudflare Containers or a free VM.** Runs the code unchanged but is not the free Workers plan
   (Containers need Paid; not re-fetched today) and keeps a long-lived process.
5. **Rust port (`copilot/migrate-backend-to-rust`).** Different host target; stale, partial.
6. **One DO for all rooms.** Single-threaded bottleneck and no isolation; per-room DOs hibernate independently.

## Consequences

Positive: no always-on machine, free plan, idle rooms cost nothing, CORS finally locked, state survives eviction.

Negative:
- **The agent wire contract breaks**: `socket.io-client` agents pinned to the Fly host
  (`src/Agents.jsx:6`, `public/llms.txt:9-19`, `public/agent-manifest.json:19-31`) must move to the JSON
  protocol in manifest v2. The web app and the agents cut over separately: the app flips first with
  `VITE_SOCKET_SERVER`/`VITE_API_BASE`; agents get 14 days on Fly.
- **Fly stays up for 14 days after cut-over, and Fly costs money while the owner wants nothing paid.** Fourteen
  days is the shortest window that is honest to agents polling the manifest rarely; a shorter one breaks them
  unannounced. Cost is one 256 MB shared machine for two weeks (recalled, not fetched; check the invoice
  estimate before cut-over). Owner can shorten it, at the price of breaking agents sooner.
- Socket.IO's 2-minute state recovery is gone. Reconnect now relies on `joinRoom` with `clientId` and a token.
- Alarms and timers prevent hibernation, so room TTL and lobby debounce cost duration; budget is large but
  measure it (brick 12).
- Free-plan daily limits are hard failures at 00:00 UTC; need a visible "busy" state in the client.
- Two implementations coexist during the port; tests on shared pure logic mitigate this.
- No persistence guarantee beyond DO storage; same as today (rooms are ephemeral).

## Ordered bricks (each ~1 h, own branch/PR, own proof)

1. **Worker skeleton + `/health`.** `worker/`, `wrangler.jsonc` with SQLite DO migration, Hono, health route.
   Proof: Vitest in the workers pool asserts the `/health` JSON keys match `getHealthStatus`; `curl
   localhost:8787/health` happy path.
2. **CORS allow-list.** Proof: Vitest: listed origin echoed, unlisted gets no header, unset env denies,
   upgrade with a bad `Origin` gets 403; curls for each.
3. **`POST /feedback`** validation and responses (without Sheets). Proof: parity cases for 400/201 against
   app.js:103-170 expectations; curls for happy and bad rating.
4. **Protocol spec + client shim, behind the flag.** `docs/ws-protocol.md` with all 17+12 events as frames,
   and the `socketManager.js` replacement with ack-by-id. It is used only when `VITE_SOCKET_SERVER` is a
   `wss://` URL, so the default build is unchanged. Proof: Jest test with a fake WebSocket for ack, timeout,
   reconnect; a test that the spec's event names equal the 17 client and 12 server events registered in the
   server code (a missing event fails it).
5. **`Room` DO: create/join/leave/update name, seats.** Proof: workers-pool test with two sockets; state
   survives a forced hibernation; the clientId seat rebind ported from `server/socketHandlers.test.js:36`
   (same clientId cannot hold X and O after a reconnect).
6. **`Room` DO: moves, reset, switchGame, new-game requests, scores.** Reuse `gameLogic.js`. Proof: port the
   cases from `handlers/gameHandlers.test.js`.
7. **Rate limit in the `Room` DO.** Same 50/s, 30 s ban, `error` frame with `RATE_LIMITED` and `retryAfter`
   (rateLimiter.js:113). The existing tests never emit the error. Proof: a burst of 60 frames in one second
   gets the error frame, is banned, and is allowed again after 30 s (fake clock).
8. **`Lobby` DO + `matchFound` with seat token.** Proof: two sockets matched into a Room; each opens the Room
   socket, sends `joinRoom` with its token, and holds the seat `matchFound` named (X or O); a reused token is
   refused; queue cap; port `lobbyManager.test.js`.
9. **Voice relay.** Proof: relay test between two tags for `voice:signal`; `voiceRoster` in the `gameUpdate`
   after join, leave and mute (voiceHandlers.js:27, 41, 58).
10. **Google Sheets via WebCrypto.** Proof: Sheets request stubbed and checked for a valid RS256 signature
    with a test key; one manual real append by the owner.
11. **Room TTL alarm.** Proof: test that an idle room is deleted and an active one is not.
12. **Measurements.** Run a scripted 100-game run against `wrangler dev` and count frames locally; apply the
    20:1 ratio in the report (wrangler dev reports local counts, not the billed meter). Read GB-s from a
    deployed Worker's analytics (workers.dev, free). Proof: report with baseline vs the sizing above.
13. **Client protocol switch.** Point `VITE_SOCKET_SERVER` and `VITE_API_BASE` at the Worker in a build; the
    client sends `joinRoom` with `clientId` and token on every Room socket open (the app never does after
    `matchFound` today: Game.jsx:236, useSocketGame.js:160). This PR adds the Playwright runner (not in
    package.json). Proof: Playwright two-browser game and lobby match against the Worker; saved curls.
14. **Agent docs and manifest v2.** `Agents.jsx`, `llms.txt`, `agent-manifest.json`, `agentManifest.js`:
    publish the JSON protocol as `manifestVersion` '2.0', with the Fly Socket.IO host listed as deprecated
    with its end date. Proof: a test that the manifest's events equal the spec; a scripted agent plays a
    game over plain WebSocket against the Worker.
15. **Cut-over and rollback rehearsal.** Deploy, flip the two `VITE_` vars, flip back. Fly stays up. Proof:
    both directions play a full game; owner signs off.
    **Done 2026-11-28** (owner delegated sign-off to the loop): a `backend=worker` dispatch (run 46065904490) put the
    live site on the Worker; two browsers played a full game there, and the agent script passed against it. The deploy
    default is now the Worker; rollback is `gh workflow run deploy.yml -f backend=fly` while Fly stays up.
16. **Decommission after the 14-day window** (and 14 quiet days on Fly). Remove `fly.toml`, `Dockerfile`,
    rewrite DEPLOY_BACKEND.md, mark Accepted.

## Top risks

1. The contract rewrite (4-10) is the bulk of the work; any missed ack or event breaks play silently. Mitigate
   with the protocol spec as a checked list of all 29 events.
2. Hibernation: in-memory state lost on eviction, and alarms/timers keep objects awake. Mitigate by storing
   everything in SQLite and testing eviction in brick 5.
3. Free daily caps (100 k requests, 13,000 GB-s) fail hard; unverified card requirement at signup.
4. **Seat loss after matchmaking.** The server seats both lobby sockets itself (lobbyHandlers.js:123-128) and
   the client never emits `joinRoom` after `matchFound` (handleMatchFound sets `roomId` and `player` only,
   socketHandlers.js:125-131; auto-join is skipped, Game.jsx:236). Socket.IO's connection state recovery (2
   min, app.js:186) keeps that seat across reconnects, and a DO port loses it. Mitigate: one-time seat token
   in `matchFound`, bound by the Room DO, and `joinRoom` with `clientId` on every socket open. Brick 8
   proves the seat `matchFound` named.
5. **Agents break on cut-over.** Mitigated by the 14-day Fly window and manifest v2; the cost is Fly money
   for two weeks.
6. **Measuring on the wrong meter.** `wrangler dev` shows local counts only; brick 12 applies 20:1 and reads
   GB-s from a deployed Worker.
