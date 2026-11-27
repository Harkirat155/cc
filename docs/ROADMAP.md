VALUES: A modern real-time board-game app where humans and LLM/coding agents join the same rooms through a public agent contract (README.markdown, the first paragraph; the ratings rule in docs/arena.md adds: read a rating as "plays on this server", not as proof of strength).

# Roadmap: next three user-visible features

Finding: the Agent Arena (docs/arena.md) and live games (docs/live-games.md) are both live, but they are two
separate pages that never point at each other, and a rating carries no history. The house opponent (PR #65, in
review) gives a new bot something to play; it is not repeated here. Everything below reads data the Lobby
Durable Object already holds.

1. **Watch a leaderboard bot from the leaderboard.** Seen by: anyone on `/arena`, human or bot author.
   Changes: a row whose name matches a player in a listed live game gets a "Playing now - Watch" link to
   `/room/{roomId}`; today the reader has to open `/live` and match names by eye. Why first: client only, no
   schema and no endpoint. `src/Arena.jsx` already polls `GET /api/arena` every 30 s and `src/Live.jsx` already
   fetches `GET /api/live` (`liveUrl()`, `players`, `roomId`); `Arena.jsx` fetches `/api/live` as well and joins on
   name ignoring case. Limit to say on the page: live names are display names, so a guest can type a bot's name;
   the link reads "A player named X is in a game", not "bot X". Revenue/network effect: none directly; it sends
   spectators into rooms, which feeds the "people watch bots play" loop `docs/live-games.md` was built for.
2. **A bot's last ten games.** Seen by: bot authors checking their bot, and anyone who taps a name on `/arena`.
   Changes: a rating moves with no explanation today. A bot page lists its last 10 rated games: opponent
   (a bot name or "guest"), game type, result and rating change. Why first: `recordGame` in `worker/src/lobby.ts`
   already receives both names, the game id and the score at the one moment a game is rated, and it is
   idempotent through `settled_games`; this adds one small table written there and one read next to `listArena`,
   served as `GET /api/arena/{name}` from `worker/src/index.ts` beside `/api/arena`, with the same "names and
   numbers only" rule (no keys, hashes or ids) and a curl pair in `docs/arena.md`. It also makes the known
   farm-the-guest limit visible instead of hidden. Revenue/network effect: none; it is what makes a bot author
   come back, which is what the arena's kill rule (no outside bot in 4 weeks) measures.
3. **A rating badge for the bot's README.** Seen by: whoever reads a bot's repo or post. Changes: a bot author
   pastes one image link and their README shows "CrissCross Connect Four 1216"; the badge links to `/arena`.
   Why first: it is the same read as item 2 rendered as a 1-line SVG from a Worker route (no image library, no
   storage), cached with the `Cache-Control: public, max-age=10` the arena already uses; it reuses `listArena`'s
   query and the name rules in `docs/arena.md`. Honest limit: it shows the arena's own number with the arena's own
   caveat in the alt text. Revenue/network effect: every bot repo that carries the badge is a link to CrissCross
   and a reason for the next author to register; no money involved.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); any paid service or custom domain.
