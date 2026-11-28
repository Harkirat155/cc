# Roadmap: next three user-visible features

## Built

- Watch a leaderboard bot from the leaderboard: "A player named X is in a game · Watch" on `/arena` (PR #67).
- A bot's last ten games: `GET /api/arena/{name}` and an expandable row on `/arena` (PR #69).
- A rating badge for the bot's README: `GET /api/arena/badge/{name}.svg` (PR #68).
- A page for each bot, `/arena/{name}`: last 10 games, "Playing now · Watch", badge Markdown per game type; the badge links to it (item 1, built; the old expanding row on `/arena` is replaced by the link).
- A "Just finished" strip on `/arena`: the last 20 rated bot sides from `GET /api/arena-feed` (item 3, built; shows rating after, not change, because the change is not stored).

- Open seats: a listed room with one seat filled shows on `/arena` and `/live` as "Waiting: {name} · {game} · Join" (`open` array on `GET /api/live`; item 2, built).

- Arena tidy (PR #74), a daily puzzle at `/daily` (PR #75), replays of rated games (PR #77), and link previews for
  `/daily`, `/arena`, `/lobby`, `/live` and `/agents` (PR #78).

Finding (2026-11-28): the daily puzzle is the only reason to come back each day, but a solve leaves nothing that
carries over to tomorrow, and a shared replay link unfurls as the generic card. Next, keep daily players, make the
board readable to everyone, and let a replay travel. All three reuse what exists: the daily engine and its
localStorage record, the shared GameBoard, and the stored replays.

1. **A daily streak.** Seen by: anyone who solved yesterday's puzzle. Changes: `/daily` shows "Day N in a row" from
   the solves already kept on this device (localStorage only, nothing sent), the result line gains the streak, and a
   solved or given-up day offers "Try yesterday's". Data: the date and the existing local record; no server change.
2. **A Connect Four board a screen reader can read.** Seen by: a screen-reader user on `/daily` or in a game.
   Changes: each column describes its discs bottom to top ("Column 3: red, yellow, 2 empty") as well as "Drop piece
   in column 3"; the last move is announced. Data: the board state already rendered. (Was the accessibility debt.)
   Built: column buttons name their discs, a full column reads "full", and a polite live region announces each move.
3. **Replay links that unfurl (explore).** Seen by: someone a bot author sends a replay to. Changes: the Worker serves
   `/r/{id}` as a small HTML page whose title and description name both bots, the game and the result, with the
   static card image, and sends the browser on to `/replay/{id}`. Kill rule: no visits to `/r/` in tally within 4
   weeks of launch. Data: the stored replay row; read-only.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); any paid service or custom domain.

