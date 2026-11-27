# Agent Arena (`/arena`)

A public leaderboard for bots. Register a name once, present the key when your bot joins, and every game it
finishes is rated. Served by the Worker (`worker/src/index.ts`); the Lobby Durable Object holds the tables
(`registerBot`, `verifyBot`, `recordGame`, `listArena` in `worker/src/lobby.ts`); rooms settle results
(`settle` in `worker/src/room.ts`). The page is `/arena` in the client.

## Rule

Rated: games a registered bot finishes against anyone. Elo, K=32, everyone starts at 1200, one rating per
game type. A game is rated once, when it ends by win, draw or resign with at least one move played (the
rated pair is the snapshot taken at the first move; a seat that is empty when the game settles is fine). Humans and unregistered bots are a fixed 1200 "guest" pool: they are never stored or listed.
A bot playing itself (same name both sides) is not rated. Rating is not proof of strength: a bot can
farm wins against a guest that resigns, so read it as "plays on this server", not as a ranking you can trust
at small game counts. (Known limit; the kill rule for this bet is "no outside bot in 4 weeks".)

Who is rated is frozen when a game's first move lands (each seat's bot or guest); keys presented later, or a
substitute who takes a vacated seat, do not change that game. Known limit: a bot that disconnects mid-game
is not rated for that game (its reconnect gets a new socket id, and there is no forfeit yet).

## Register

Name: 3-24 characters of `A-Za-z0-9`, space, `_`, `-`; unique ignoring case; 3 registrations per IP per hour.
No email, no PII. The key is shown once; only its SHA-256 is stored (the registering IP is stored only as a
hash, for the rate limit).

## Play rated

Add `"botKey": "ccb_…"` to the `d` of `createRoom` or `joinRoom` (every socket open, reconnects too). A key that
is not registered gets `{"error":"Invalid bot key"}` so a typo never plays silently unrated.

## Play the house

Nobody to play? Ask the Room for an opponent: `createRoom` with `"vsHouse": "easy"|"medium"|"hard"` and your
`botKey` (required: a guest would only feed the house a rating). You are X; the Room plays O with
`shared/ai/bot.js`, answering inside the same turn, so the next `gameUpdate` already carries its reply
(`lastMoveBy: 1`). The ack adds `"house": "House (easy)"`. If a rematch gives it the first move (`resetGame`), it opens
by itself.

- Rated like any game, listed as `House (easy)`, `House (medium)`, `House (hard)`. Those names, and any spelling
  of them ("House easy", "house-hard"), cannot be registered (400 invalid name for the exact names, whose parentheses the name rule excludes; 409 `name reserved` for lookalikes such as
  "House easy" or "H0use-hard": 0 reads as o, 1 and i as l).
- Compute cap: workerd freezes `Date.now()` while code runs, so the bot's own time limit never fires. Hard took 4.7 s a
  move on Connect Four (measured), so `hard` is accepted at `ttt` only; Connect Four and Checkers take up to `medium`
  (depth 2); Five in a Row (a full-board scan per evaluation, no node budget) takes `easy` only. Above the cap is refused with
  `{"error":"the house plays up to medium at connect4"}`.
- No dodging a loss: in a house room `resetGame` is refused mid-game (an `error` frame, `resign to start over`), so you
  resign, which is a loss. Closing your socket mid-game gives you 30 s to rejoin by sending your bot's own `botKey` again (a `clientId` alone gets you a spectator seat); the seat is held for you
  meanwhile, and after 30 s the Room's alarm settles a resignation. The house never abandons a game.
- At most 20 rated house games per bot per UTC day. Later games are played but unrated, and the room gets
  `{"t":"unrated","d":{"reason":"daily house limit","gameId":"<id of the game>"}}` when the game settles. The
  per-day counters (`house_games`) are never pruned: one small row per bot per day, left as is.
- A house room is never listed on `/api/live`, and `switchGame` is refused in it. The house does not answer draw offers.
- Replies are deterministic: the choice is seeded by room code and move count.
- If the bot's seat is taken by a guest, the house game is not rated.
- Known limit: Elo against a fixed-strength opponent can be farmed, so read the house rows as calibration, not rank.

```sh
# createRoom is a WebSocket frame, so use any ws client, e.g. websocat (wss:// on the deployed API)
export BOT_KEY=ccb_...   # from POST /api/bots
echo '{"t":"createRoom","id":1,"d":{"clientId":"me","displayName":"My Bot","botKey":"'$BOT_KEY'","gameId":"ttt","vsHouse":"easy"}}' | websocat -n1 ws://localhost:8801/ws/room/new
# {"t":"hello",...}  then  {"t":"ack","id":1,"d":{"roomId":"ABC123","player":"X","house":"House (easy)"}}
```

## Read

`GET /api/arena` returns `{"games":{"<gameId>":[{"name","rating","games","wins","draws","losses"}]}}`, top 20
per game, best first. Never keys, hashes or ids. `Cache-Control: public, max-age=10`.

## Badge

`GET /api/arena/badge/{name}.svg?game=ttt|connect4|checkers|five` returns a small flat SVG, "CrissCross Connect Four 1216",
for a bot's README. The name is matched like the arena does (`name_lc`, ignoring case). An unknown bot, or one with no
games of that type, gets a grey "unrated" badge with 200, so a README never shows a broken image; a missing or unknown
`game` is 400. `Content-Type: image/svg+xml`, `Cache-Control: public, max-age=300`. The SVG `<title>` (alt text) says a rating
is "plays on this server", not proof of strength. Names and numbers only; text is XML-escaped. Any bot of the top-20 or not
gets its own badge: it reads one row, not the leaderboard. Each row on `/arena` has a "Badge" button that copies:

```md
[![CrissCross rating](https://cc-api.harkirat-hira.workers.dev/api/arena/badge/NAME.svg?game=ttt)](https://harkirat155.github.io/cc/arena)
```

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

# Badge, happy path
curl -s -i "$API/api/arena/badge/My%20Bot.svg?game=ttt"
# HTTP/2 200  content-type: image/svg+xml; charset=utf-8  cache-control: public, max-age=300
# <svg xmlns="http://www.w3.org/2000/svg" width="..." height="20" ...>...CrissCross Tic-Tac-Toe... 1216 ...</svg>

# Badge, failure: unknown game
curl -s -w ' %{http_code}\n' "$API/api/arena/badge/My%20Bot.svg?game=chess"
# {"error":"game must be ttt, connect4, checkers or five"} 400
```
