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
- GB-s (duration) is not measured. Brick 12b reads it from a deployed Worker, an orchestrator/owner step.
- The TTL alarm (brick 11) and the lobby's debounce wake objects and add duration; they add no requests here.
- The scripts send no chat or typing frames. The real UI has a typing indicator. Each of those frames is
  inbound and bills at 20:1, so a chatty game costs more than measured.
- A reconnect after a dropped socket is another open: on flaky mobile networks this is the biggest unknown.
