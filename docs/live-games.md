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
10 minutes (no move played) is dropped until its next move. At most 50 rows, newest game first.

## Response

`200 {"games":[{"roomId":string,"gameId":string,"players":[xName,oName],"moves":number,"startedAt":number}]}`
(`startedAt` is the ms epoch of the game's first move). No socket ids, client ids or seat tokens. Display
names are whatever players chose. `Cache-Control: public, max-age=5`. Any method but GET is `404`.

## Open seats

The same response carries `"open":[{"roomId":string,"gameId":string,"name":string,"since":number}]`, additive:
`games` is unchanged. A listed room (same rule as above) with exactly one seat filled, no move played, and the empty seat free for anyone
(not held by a lobby match's seat token or for a creator who is reconnecting) is an open seat; `since` is when the
room began waiting, as the room knows it (it resets if the room restarts): `/arena` and `/live` show "Waiting: {name} · {game} · Join", and Join opens `/room/{roomId}`. It
leaves `open` when the second seat fills (it then appears in `games` after its first move), the creator leaves,
the game ends or the row goes 10 minutes without a refresh. Stored as a `live` row with `moves = 0`; no new
table. A seat is first-come: whoever joins first plays, so a name is a display name, not proof of identity.

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
