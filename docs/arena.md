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

Test bots: send `"unlisted": true` with the name (`{"name":"My Test Bot","unlisted":true}`) and the bot is rated as
usual but left off `GET /api/arena` and `GET /api/arena-feed`. Its own page, `GET /api/arena/{name}` (which then
carries `"unlisted": true`) and its badge still work. Stored in the additive table `unlisted_bots (name_lc)`; the
operator smoke bots `SmokeRecent42775`, `SmokeHouse14206` and `cc-launch-check` are seeded into it. Use it for smoke scripts.

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

## Just finished

`GET /api/arena-feed` returns the last 20 rated bot sides arena-wide, newest first:
`{"feed":[{"name":"My Bot","gameId":"ttt","result":"win","ratingAfter":1216,"at":1795000000000,"replayId":"<uuid>"}]}`. `replayId` is present only when the game has a stored replay (and never when either side is an unlisted bot); the page then shows a "Replay" link. One row per bot per game
(two rows when both sides are bots); `result` is from that bot's side; `[]` when nothing has finished (the page then says
"No rated games finished since 2026-11-28."). The rating change is not stored, so only `ratingAfter` is given. The route is
outside `/api/arena/:name`, so no bot name can shadow it. Names and numbers only. `Cache-Control: public, max-age=10`.
Shown above the tables on `/arena`; if the fetch fails the page shows a one-line note and the leaderboard still renders.

## Recent games

`GET /api/arena/{name}` returns a bot's last 10 rated games, newest first:
`{"name":"My Bot","games":[{"gameId":"ttt","opponent":"House (easy)","result":"win","ratingAfter":1216,"at":1795000000000}]}`.
`opponent` is a bot's name, a House name, or `"guest"`; `result` is `win`, `loss` or `draw` from this bot's side;
`ratingAfter` is its rating in that `gameId` after the game; `at` is epoch ms. The name is matched like the arena does
(`name_lc`, ignoring case). A name that fails the name rule, or is not registered, is 404 `{"error":"bot not found"}`
(the House has no page); a registered bot with no games is 200 with `games: []`. Names and numbers only: no keys, hashes, game ids or room ids.
`Cache-Control: public, max-age=10`. Each registered name on `/arena` links to the bot's page, `/arena/{name}`, which shows the same list, a "Playing now · Watch" link when a listed game has that name, and the badge Markdown per game type. The House has no page.

Each game row also carries `replayId` when a replay exists (older games omit it, and the page shows no link).

## Weekly cup

Every Sunday 12:00 UTC a cup is set up per game type. There is no cron (the account's 5 free cron triggers are taken): the first rated game or
`GET /api/arena/cup` at or after Sunday 12:00 UTC draws that Sunday's cup, and the Sunday before if a quiet week left it undrawn (`ensureCup` → `runCup` in `worker/src/lobby.ts`, counting only games
before the draw time), exactly as a cron would; `scheduled` in `worker/src/index.ts` stays for a trigger added back later. Entrants: listed (not unlisted) registered bots with a rated game of that type in the last 7 days; the House and guests never enter. Three
rounds, paired by rating at the draw (`pairRounds`, `worker/src/cup.ts`): nearest-rated first, nobody meets twice when a full round of new
pairings exists, an odd count gives the lowest-rated bot without one its bye. Pairings are fixed at the draw from the rating snapshot, not from cup
results. The draw cannot move a bot's socket, so it does not start games: a pairing is settled by the next rated game the two bots finish with
each other in that game type within 7 days of the draw (the bots arrange it, e.g. by joining a room by code). Points: win 1, draw 0.5, loss 0, bye 1, no game yet 0.
Ranked by points, then rating at the draw. A cup changes no rating: its games are ordinary rated games. Fewer than 2 entrants: the run is recorded, no pairings.
Stored in the additive tables `cup_runs`, `cup_entries`, `cup_pairings` (inserts only, written by the draw only); scores are read off `bot_games`, never stored.
The name `Cup` cannot be registered (409 `name reserved`), so `GET /api/arena/cup` never shadows a bot page.

`GET /api/arena/cup` returns `{"current":{"week":"2026-12-06","games":{"ttt":{"entrants":3,"table":[{"name","points","games","results":["win","draw","bye"],"opponents":["Grace Bot","Linus Bot",null]}],"winner":{"name","points"}|null}}},"last":{...}}`;
`current` and `last` are the two newest cups (`null` before they exist); `results` per round are `win|loss|draw|bye|pending`; `opponents[i]` is the bot paired with this one in round i+1 (`null` for a bye), so a `pending` round names whom to play; `winner` is the table's first row when it has points, else `null`. Names and numbers only.
`Cache-Control: public, max-age=10`. The page is `/arena/cup`; each bot's page shows its rows. Kill rule (ROADMAP): fewer than 4 distinct bots enter any of the first 4 cups.

```sh
curl -s https://cc-api.harkirat-hira.workers.dev/api/arena/cup
# {"current":null,"last":null}   before the first Sunday draw
```

## Replays

`GET /api/replay/{replayId}` returns one rated game: `{"id","gameId":"ttt","players":["My Bot","House (easy)"],"first":0,"result":"X","moves":[{"type":"place","cell":4},...],"at":1795000000000}`.
`players` are the X and O sides (`"guest"` for a human or unregistered bot); `first` is the seat that moved first (0 = X); `result` is `X`, `O` or `draw`;
`moves` are in play order (checkers: `{"type":"transfer","from","to","captures":[...]}`). An unknown id, or a game rated before replays shipped, is
404 `{"error":"replay not found"}`. `Cache-Control: public, max-age=3600`. The client page `/replay/{replayId}` rebuilds each position with the
rules modules in `shared/games/` and steps through them with Previous and Next. Linked from "Just finished" and from each bot-page game row.

Stored in `replays` (plus `replay_links`, which ties a `bot_games` row to it), written in `recordGame` in the same transaction as the rating, from the move list the
Room holds at settlement. Additive: inserts only, never altered or pruned; only games rated after this shipped have one. The id is the unguessable settlement id.

Stored in `bot_games`, one row per bot per rated game, written in the same step as the rating (`recordGame`). The table is
new as of 2026-11-28: games rated before then have no rows and do not appear. One row per bot per rated game, kept (never pruned or edited); the House side gets no row.

## Badge

`GET /api/arena/badge/{name}.svg?game=ttt|connect4|checkers|five` returns a small flat SVG, "CrissCross Connect Four 1216",
for a bot's README. The name is matched like the arena does (`name_lc`, ignoring case). An unknown bot, or one with no
games of that type, gets a grey "unrated" badge with 200, so a README never shows a broken image; a missing or unknown
`game` is 400. `Content-Type: image/svg+xml`, `Cache-Control: public, max-age=300`. The SVG `<title>` (alt text) says a rating
is "plays on this server", not proof of strength. Names and numbers only; text is XML-escaped. Any bot of the top-20 or not
gets its own badge: it reads one row, not the leaderboard. Each row on `/arena` has a "Badge" button that copies:

```md
[![CrissCross rating](https://cc-api.harkirat-hira.workers.dev/api/arena/badge/NAME.svg?game=ttt)](https://harkirat155.github.io/cc/arena/NAME)
```

## Curl

```sh
API=https://cc-api.harkirat-hira.workers.dev

# Happy path: register (save the key, it is shown once)
curl -s -X POST $API/api/bots -H 'content-type: application/json' -d '{"name":"My Bot"}'
# {"name":"My Bot","key":"ccb_3f...48 hex..."}   (201)

# Register a test bot that stays off the leaderboard and the feed
curl -s -X POST $API/api/bots -H 'content-type: application/json' -d '{"name":"My Test Bot","unlisted":true}'
# {"name":"My Test Bot","key":"ccb_..."}   (201); a bad name is 400 {"error":"name must be 3-24 characters: ..."}

# Leaderboard
curl -s $API/api/arena
# {"games":{"ttt":[{"name":"My Bot","rating":1216,"games":1,"wins":1,"draws":0,"losses":0}]}}

# Failure: the name is taken (case-insensitive)
curl -s -w ' %{http_code}\n' -X POST $API/api/bots -H 'content-type: application/json' -d '{"name":"my bot"}'
# {"error":"name already taken"} 409

# Just finished, happy path
curl -s $API/api/arena-feed
# {"feed":[{"name":"My Bot","gameId":"ttt","result":"win","ratingAfter":1216,"at":1795000000000}]}

# Just finished, failure: GET only
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/api/arena-feed
# 404

# Recent games, happy path
curl -s $API/api/arena/My%20Bot
# {"name":"My Bot","games":[{"gameId":"ttt","opponent":"House (easy)","result":"win","ratingAfter":1216,"at":1795000000000}]}

# Recent games, failure: unknown bot
curl -s -w ' %{http_code}\n' $API/api/arena/No%20Such%20Bot
# {"error":"bot not found"} 404

# Replay, happy path (id from a row's replayId)
curl -s $API/api/replay/REPLAY_ID
# {"id":"...","gameId":"ttt","players":["My Bot","House (easy)"],"first":0,"result":"X","moves":[{"type":"place","cell":4}],"at":1795000000000}

# Replay, failure: unknown id
curl -s -w ' %{http_code}\n' $API/api/replay/no-such-game
# {"error":"replay not found"} 404

# Badge, happy path
curl -s -i "$API/api/arena/badge/My%20Bot.svg?game=ttt"
# HTTP/2 200  content-type: image/svg+xml; charset=utf-8  cache-control: public, max-age=300
# <svg xmlns="http://www.w3.org/2000/svg" width="..." height="20" ...>...CrissCross Tic-Tac-Toe... 1216 ...</svg>

# Badge, failure: unknown game
curl -s -w ' %{http_code}\n' "$API/api/arena/badge/My%20Bot.svg?game=chess"
# {"error":"game must be ttt, connect4, checkers or five"} 400
```
