# Roadmap: next three user-visible features

## Built

- Watch a leaderboard bot from the leaderboard: "A player named X is in a game · Watch" on `/arena` (PR #67).
- A bot's last ten games: `GET /api/arena/{name}` and an expandable row on `/arena` (PR #69).
- A rating badge for the bot's README: `GET /api/arena/badge/{name}.svg` (PR #68).
- A page for each bot, `/arena/{name}`: last 10 games, "Playing now · Watch", badge Markdown per game type; the badge links to it (item 1, built; the old expanding row on `/arena` is replaced by the link).

Finding: a bot author can now be rated, shown, badged and watched, but three loops stay open. A bot has no
address of its own (the history exists only inside an expanding row), a bot that wants a game has nobody to find
(a room is listed only once a game is under way), and the arena shows no sign of life between visits. Every item
below reads or extends data the Lobby Durable Object already holds. The house opponent (PR #65) is not repeated.

1. **A page for each bot, `/arena/{name}`. (Built.)** Seen by: a bot author sharing their bot, and anyone who follows the
   link from a README. Changes: the badge and the leaderboard name open a stable URL that shows the bot's last 10
   rated games, a "Playing now - Watch" link when a listed game has that name, and the ready-to-paste badge
   Markdown for each game type; today the history is reachable only by opening `/arena` and expanding a row
   (`toggle` in `src/Arena.jsx`), `src/App.jsx:58-63` has no per-bot route, and the badge Markdown links to the
   bare `/arena` (`badgeMd`, `src/Arena.jsx`; the same line in `docs/arena.md`). Why first: client only, no
   schema, no endpoint. It re-uses `GET /api/arena/{name}` (`worker/src/index.ts:100`), `watchRooms`/`roomFor` in
   `src/arenaWatch.js`, and the SPA deep-link fallback already used by `/room/:roomId` (`public/404.html`). The
   badge link target changes to the page. Exemplar: a lichess profile (`lichess.org/@/{bot}`) is the one URL a bot
   author puts in a README or a post; we take the stable address and the games list, and leave out follows,
   chat and messages. Honest limit: the page shows the last 10 games since 2026-11-28 and says so (the `SINCE`
   line in `Arena.jsx`); the House has no page (the name rule excludes it); a name is a display name, as in
   `docs/arena.md`. Revenue/network effect: none directly; a bot author with a link to share is the cheapest
   source of the next bot author, which the arena's kill rule (no outside bot in 4 weeks) measures.
2. **Open seats: bots waiting for an opponent.** Seen by: a bot author with nobody to play, and a human who
   wants to sit across from a bot now. Changes: a room created with `"listPublicly": true` and only one seat filled
   shows on `/arena` and `/live` as "Waiting: {name} · Connect Four · Join", with `GET /api/live` gaining an
   additive `open` list; today it is invisible, because `report()` in `worker/src/room.ts:260-262` lists a room only
   when `live(s) && s.moves > 0`, and `live()` (`worker/src/room.ts:608`) needs both seats. The only way to
   find an opponent is to know a room code or take the guest matchmaking queue (`enqueue`, `worker/src/lobby.ts:168`),
   which sends only a display name and no `botKey`, so a bot cannot ask the lobby for a rated game against another
   bot. Why first: one extra state in an existing registry (the `live` table already allows a null `o_name`,
   `reportLive` at `worker/src/lobby.ts:143`), no new route, additive column or none (a row with `moves = 0` is an
   open seat), same 10-minute staleness rule. Exemplar: lichess "Create a game" lobby lists open seeks that anyone
   can accept, and its bot API accepts challenges the same way; we take the open seek, and leave out
   time controls, rating ranges and challenge messages. Honest limit: a seat is first-come, so a bot can farm a
   guest that joins (the existing limit in `docs/arena.md`), and a listed name is a display name. Revenue/network
   effect: bot-vs-bot games are the arena's scarce supply; each open seat is a standing invitation to the next
   author, and each filled one becomes a spectatable game on `/live`.
3. **Recent rated games, arena-wide.** Seen by: a first-time visitor to `/arena` and a bot author asking "is
   anyone here?". Changes: a "Just finished" strip above the tables lists the last 20 rated games (names, game
   type, result, rating change, and a link to the bot's page from item 1); today the arena shows only standing
   ratings (`GET /api/arena`, `worker/src/index.ts:97`, top 20 per game), so a quiet arena and a dead one look the
   same. Why first: one read on `bot_games` (`worker/src/lobby.ts:41`, already written for every rated game, House
   rows skipped at `lobby.ts:96`), one route beside `/api/arena` (`GET /api/arena-feed`, outside the
   `/api/arena/:name` namespace so no bot name can shadow it), no schema, same "names and numbers only" rule
   and `Cache-Control: public, max-age=10`. Exemplar: a Kaggle game arena (Kaggle Simulations) lists the latest
   episodes per submission so a competitor sees activity without opening a profile; we take the latest-episodes
   list, and leave out replays, which need a stored move log we do not keep. Honest limit: the strip has a bot-side
   row per game (two rows when both sides are bots), says "since 2026-11-28", and is empty text, not zeros, when
   nothing has finished. Revenue/network effect: visible activity is what turns a first visit into a first
   registration; no money involved.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); game replays (no move log is stored); any paid service or custom domain.
