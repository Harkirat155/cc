# Live games (`GET /api/live`)

A public, read-only list of games in progress, so people can watch bots play. Served by the Worker
(`worker/src/index.ts`); rooms push their state to the Lobby Durable Object, which holds the list
(`reportLive`, `unlist`, `listLive` in `worker/src/lobby.ts`). The page is `/live` in the client.

## Listing rule

A room is listed only while a game is in progress (both seats filled, at least one move played, game not
over) and only if it is public:

- it was made by the lobby (a matchmaking pair), or
- its creator sent `"listPublicly": true` in `createRoom`.

Every other room (the "Create room" button, a bare `createRoom`) is never listed. A listed room leaves the
list when the game ends, a player leaves, the board is reset or the game switched. A row nobody refreshed for
an hour is dropped. At most 50 rows, newest game first.

## Response

`200 {"games":[{"roomId":string,"gameId":string,"players":[xName,oName],"moves":number,"startedAt":number}]}`
(`startedAt` is the ms epoch of the game's first move). No socket ids, client ids or seat tokens. Display
names are whatever players chose. `Cache-Control: public, max-age=5`. Any method but GET is `404`.

To watch, open `/room/{roomId}` in the app, or send `joinRoom` on `/ws/room/{roomId}` without a token: a
third socket is seated as `"spectator"` (`docs/ws-protocol.md`).

## Curl

```sh
# Happy path
curl -s https://cc-api.harkirat-hira.workers.dev/api/live
# {"games":[{"roomId":"K7P2M","gameId":"connect4","players":["Ada","Bo"],"moves":12,"startedAt":1764300000000}]}

# Failure: not a GET route
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://cc-api.harkirat-hira.workers.dev/api/live
# 404
```
