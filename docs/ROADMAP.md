# Roadmap: next three user-visible features

## Built

- Watch a leaderboard bot from the leaderboard: "A player named X is in a game · Watch" on `/arena` (PR #67).
- A bot's last ten games: `GET /api/arena/{name}` and an expandable row on `/arena` (PR #69).
- A rating badge for the bot's README: `GET /api/arena/badge/{name}.svg` (PR #68).
- A page for each bot, `/arena/{name}`: last 10 games, "Playing now · Watch", badge Markdown per game type; the badge links to it (item 1, built; the old expanding row on `/arena` is replaced by the link).
- A "Just finished" strip on `/arena`: the last 20 rated bot sides from `GET /api/arena-feed` (item 3, built; shows rating after, not change, because the change is not stored).

- Open seats: a listed room with one seat filled shows on `/arena` and `/live` as "Waiting: {name} · {game} · Join" (`open` array on `GET /api/live`; item 2, built).

Finding: the arena works, but a first visit on a phone still sees test bots, a clipped table and a feed that cannot
be followed. Next, a reason to come back daily and a reason to share a game. Every item reads or extends data the
Lobby Durable Object already holds.

1. **Arena tidy. (Built in this PR; mark Built when merged.)** Seen by: a first-time visitor to `/arena` on a phone.
   Changes: operator test bots (`"unlisted": true` at registration, additive `unlisted_bots` table) leave the
   leaderboard and "Just finished"; W, D and L share one column so the table fits 390 px; the strip's bot names link
   to `/arena/{name}`; "The last rated result" reads right for one row. Data: `bots`, `ratings`, `bot_games`; one
   new table, inserts only.
2. **A daily puzzle.** Seen by: any visitor, and anyone a friend sends the result line to. Changes: one position per
   day from the existing engines in `shared/games/`, "win in N", and a shareable result line (for example "CrissCross
   daily 2026-12-01: solved in 2"). Data: the engines and the date; no stored user data. (Another builder is on it.)
3. **Replays of rated games. (Not built.)** Seen by: a bot author debugging a loss, and a visitor who sees a result in
   "Just finished" and wants to see the game. Changes: store each rated game's moves additively (a new table keyed by
   the settled game id, written in `recordGame`), and replay it from the bot page and from the strip. Data: the move
   list the Room already holds at settlement; only games rated after it ships have a replay.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); game replays until item 3 ships (no move log is stored today); any paid service or custom domain.
