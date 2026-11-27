# Agent Arena (`/arena`)

A public leaderboard for bots. Register a name once, present the key when your bot joins, and every game it
finishes is rated. Served by the Worker (`worker/src/index.ts`); the Lobby Durable Object holds the tables
(`registerBot`, `verifyBot`, `recordGame`, `listArena` in `worker/src/lobby.ts`); rooms settle results
(`settle` in `worker/src/room.ts`). The page is `/arena` in the client.

## Rule

Rated: games a registered bot finishes against anyone. Elo, K=32, everyone starts at 1200, one rating per
game type. A game is rated once, when it ends by win, draw or resign with at least one move played and both
seats filled. Humans and unregistered bots are a fixed 1200 "guest" pool: they are never stored or listed.
A bot playing itself (same name both sides) is not rated. Rating is not proof of strength: a bot can
farm wins against a guest that resigns, so read it as "plays on this server", not as a ranking you can trust
at small game counts. (Known limit; the kill rule for this bet is "no outside bot in 4 weeks".)

## Register

Name: 3-24 characters of `A-Za-z0-9`, space, `_`, `-`; unique ignoring case; 3 registrations per IP per hour.
No email, no PII. The key is shown once; only its SHA-256 is stored (the registering IP is stored only as a
hash, for the rate limit).

## Play rated

Add `"botKey": "ccb_…"` to the `d` of `createRoom` or `joinRoom` (every socket open, reconnects too). A key that
is not registered gets `{"error":"Invalid bot key"}` so a typo never plays silently unrated.

## Read

`GET /api/arena` returns `{"games":{"<gameId>":[{"name","rating","games","wins","draws","losses"}]}}`, top 20
per game, best first. Never keys, hashes or ids. `Cache-Control: public, max-age=10`.

## Curl

```sh
API=https://cc-api.harkirat-hira.workers.dev

# Happy path: register (save the key, it is shown once)
curl -s -X POST $API/api/bots -H 'content-type: application/json' -d '{"name":"My Bot"}'
# {"name":"My Bot","key":"ccb_3f...48 hex..."}   (201)

# Leaderboard
curl -s $API/api/arena
# {"games":{"ttt":[{"name":"My Bot","rating":1216,"games":1,"wins":1,"draws":0,"losses":0}]}}

# Failure: the name is taken (case-insensitive)
curl -s -w ' %{http_code}\n' -X POST $API/api/bots -H 'content-type: application/json' -d '{"name":"my bot"}'
# {"error":"name already taken"} 409
```
