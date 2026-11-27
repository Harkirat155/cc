# Free-plan request meter: measured vs. ADR 0001 (brick 12a)

Measured 2026-11-27 against a local `wrangler dev`. ADR 0001's sizing paragraph is arithmetic only; this file
replaces its frame estimate with counts from real games on the real protocol.

## Command

```sh
cd worker
npx wrangler dev --local --port 8787 &     # stop it afterwards
node scripts/measure.mjs --base http://127.0.0.1:8787 --games 100
```

`scripts/measure.mjs` plays scripted, legal tic-tac-toe games over two Room sockets: create with `new`, join,
set display names, play to a win or draw, request one new game, close. It then runs 10 lobby matches on
`/ws/lobby`. Any game that does not reach a result exits 1. The billing rule it applies is quoted from the ADR:
"Incoming WebSocket messages bill 20:1 (100 messages = 5 requests); outgoing messages and protocol pings are
free; opening a socket is one request."

## Measured (100 room games, 10 lobby matches)

| | inbound frames | outbound frames | socket opens | billed requests |
|---|---|---|---|---|
| Room game, mean (p50, max) | 11 (10, 14) | 25.0 (23, 31) | 2 | 3 (3, 3) |
| Room games, total of 100 | 1,100 | 2,502 | 200 | 300 |
| Lobby match, mean | 2 | 6 | 2 | 3 |

Billed requests per game = socket opens + non-upgrade HTTP (0) + ceil(inbound / 20), counted per game. The
script reports this as `gamesPerDay` = 100,000 / 3 = **33,333**.

## Against the ADR's estimate

| | ADR 0001 (arithmetic) | Measured |
|---|---|---|
| Inbound frames per game | 60-100 | 11 |
| What dominates the bill | inbound messages | the 2 socket opens (2 of 3 billed requests) |
| Games/day on 100 k requests, room code shared | ~20 k | 33 k (per-game ceil); 39 k if the 20:1 rule applies to the day's total (255 billed per 100 games) |
| Games/day, players met in the lobby | — | ~16.7 k (3 lobby + 3 room) |

The ADR counted ~15 moves for a 9-cell game. A game is at most 9 moves, and a display name or reset is one
frame each, so inbound traffic is a small share of the bill. What costs money is the sockets: each new player
connection costs about as much as a whole game's moves. A rematch in an open room costs under one request,
because it opens no new socket. So making rematches easy stretches the free plan further than trimming frames.

## Caveats

- These are local counts from `wrangler dev`, not the billed meter. The 20:1 rule and "opens are one request"
  come from the ADR's reading of the pricing page; neither is confirmed against a dashboard here.
- GB-s (duration) was read from a deployed Worker in brick 12b, below.
- The TTL alarm (brick 11) and the lobby's debounce wake objects and add duration; they add no requests here.
- The scripts send no chat or typing frames. The real UI has a typing indicator. Each of those frames is
  inbound and bills at 20:1, so a chatty game costs more than measured.
- A reconnect after a dropped socket is another open: on flaky mobile networks this is the biggest unknown.

## Brick 12b: duration (GB-s) on a deployed Worker, 2026-11-27

`cc-api` version 8c98a6d7 was deployed to workers.dev with no traffic routed to it; Fly kept serving users.
`node worker/scripts/measure.mjs --base https://cc-api.harkirat-hira.workers.dev --games 30` played 30 games between
03:37:22Z and 03:38:47Z (mean wall 954 ms per game, 3 billed requests per game, as measured locally).
Cloudflare's GraphQL analytics were read about 12 minutes later with the query below, for 03:37Z to 03:50Z:

| Metric (Cloudflare field) | 30 games | Per game |
|---|---|---|
| Worker requests (`workersInvocationsAdaptive.requests`) | 79 | 2.6 |
| Durable Object requests (`durableObjectsInvocationsAdaptiveGroups`, two namespaces) | 63 + 14 = 77 | 2.6 |
| Active time (`activeTime`, µs) | 1,493,927 µs | 50 ms |
| CPU time (`cpuTime`, µs) | 21,342 µs | 0.7 ms |
| **Duration (`duration`, "GB*s, weighted by the configured memory limit")** | **0.191 GB-s** | **0.0064 GB-s** |

**Result.** The free plan allows 13,000 GB-s a day (ADR 0001), which is about **2 million games a day at 0.0064 GB-s each**.
Requests still bind first, at 33,333 games a day, so duration is not the limit, with about 60× headroom.
Active time is 50 ms per game, although a game lasts about a second of wall time. That fits the ADR's reading
that hibernated objects accrue no duration between messages.

**Caveats.**
- The periodic dataset reported 0 inbound and 56 outbound WebSocket messages, where the local count is 11 and 25 per
  game (330 and 750). The message counters look undercounted or sampled, so they do not confirm or refute the 20:1
  rule. Duration and active time are read from the same rows and could be undercounted too. Even a 10× undercount
  leaves 200 k games a day, still above the request ceiling.
- The scripted games are quick and send no chat or typing frames. Real games keep sockets open longer, which costs no
  duration while hibernated but does cost duration whenever a message wakes the object.

```graphql
# Pipe the wrangler OAuth token in as a Bearer header; never print it.
query($acct: string!, $since: Time!, $until: Time!) { viewer { accounts(filter: {accountTag: $acct}) {
  durableObjectsPeriodicGroups(limit: 50, filter: {datetimeMinute_geq: $since, datetimeMinute_leq: $until}) {
    sum { activeTime cpuTime duration inboundWebsocketMsgCount outboundWebsocketMsgCount } dimensions { namespaceId } }
  durableObjectsInvocationsAdaptiveGroups(limit: 50, filter: {datetime_geq: $since, datetime_leq: $until}) {
    sum { requests } dimensions { namespaceId } }
  workersInvocationsAdaptive(limit: 5, filter: {datetime_geq: $since, datetime_leq: $until, scriptName: "cc-api"}) {
    sum { requests } } } } }
```

```sh
TOKEN=$(env -u CLOUDFLARE_API_TOKEN npx wrangler auth token)   # do not echo it
curl -s https://api.cloudflare.com/client/v4/graphql -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -n --arg q "$(cat q.graphql)" --arg a "$ACCOUNT_ID" '{query:$q,variables:{acct:$a,since:"2026-11-27T03:37:00Z",until:"2026-11-27T03:50:00Z"}}')"
```

**Rollback.** No user traffic reaches `cc-api`. It can stay idle at no cost until the brick 15 cut-over, or be removed
with `wrangler delete cc-api`.
