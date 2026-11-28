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

- A daily streak: "Day N in a row" from the solves kept on the device, and "Try yesterday's" (item 1, built).
- A Connect Four board a screen reader can read: column buttons name their discs, a polite live region announces moves (item 2, built).
- Replay links that unfurl: the Worker's `/r/{id}` card, counted as `replay_link` (item 3, built).
- Share your daily result: a "Share result" button on `/daily` shares `CrissCross Daily {date} · solved in N tries ·
  N days in a row` plus the Worker link `/d/{date}`, which unfurls as that day's puzzle card and sends the browser on
  to `/daily?via=d`; arrivals count as `daily_link` (item 4, built). Only the date is in the link, so no result number
  is read from a URL. Kill rule: No daily_link tally hits within 4 weeks (by 2026-12-26).

- A shared daily link opens the shared puzzle: `/d/{date}` now sends the browser to `/daily/{date}?via=d`, which plays
  that date's puzzle (launch day to today UTC; anything else shows today's with a note). Tries on past dates are kept
  per date in the `cc.daily` record (`pastTries`), and a past solve never changes today's record.

- See the winning line: a solved or given-up day offers "Show the solution", stepping one winning line a move per
  press on the same board, derived from `shared/daily.js` (`solutionLine`), nothing stored (item 1, built).

- A different game on some days (item 3, built, not yet live): every fourth UTC day (day number % 4 === 3, first on
  2026-11-30) the daily is a Tic-Tac-Toe position, win now or block their only threat, one move, from
  `gameForDate` / `tttPuzzleForDate` in `shared/daily.js`; the Worker's `/d/{date}` card names the same game. Same
  solve, tries, share text (it adds "Tic-Tac-Toe") and "Play someone now" (an open Tic-Tac-Toe seat, else `/lobby`).
  Connect Four events are unchanged; Tic-Tac-Toe days tally `daily_solve_ttt`, `daily_link_ttt` (arrivals through
  `/d/`) and `daily_play_ttt`. Kill rule: over 4 weeks of live Tic-Tac-Toe days, `daily_link_ttt` or
  `daily_solve_ttt` per Tic-Tac-Toe day below `daily_link` or `daily_solve` per Connect Four day. Checkers not built.

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
- "Play someone now" after the daily is done (not in the solution view): joins an open Connect Four seat from `GET /api/live`, else `/lobby` (item 2, built). Data: tally `cc` events `daily_play` (clicks) and `daily_solve` (first solves); kill rule: `daily_play` under 5% of `daily_solve` within 4 weeks of launch.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); any paid service or custom domain.

