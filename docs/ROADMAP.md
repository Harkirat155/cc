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

- A month of daily puzzles (built, not yet live): `/daily` has a quiet "Past puzzles" link to `/daily/archive`, a Monday-first month
  grid per UTC month from launch to today, newest first (`src/DailyArchive.jsx`, helpers in `src/dailyGrid.js`). Each day links to
  `/daily/{date}` (today to `/daily`) and reads "solved", "tried" or "not tried" from the `cc.daily` record on this device.
  Nothing new is stored or sent; one `daily_archive` tally per page open. Streak rule unchanged.

- A shared daily link opens the shared puzzle: `/d/{date}` now sends the browser to `/daily/{date}?via=d`, which plays
  that date's puzzle (launch day to today UTC; anything else shows today's with a note). Tries on past dates are kept
  per date in the `cc.daily` record (`pastTries`), and a past solve never changes today's record.

- See the winning line: a solved or given-up day offers "Show the solution", stepping one winning line a move per
  press on the same board, derived from `shared/daily.js` (`solutionLine`), nothing stored (item 1, built).

- A different game on some days (item 3, live 2026-11-28, Pages 83c32ef, cc-api c35f38bb): every fourth UTC day (day number % 4 === 3, first on
  2026-11-30) the daily is a Tic-Tac-Toe position, win now or block their only threat, one move, from
  `gameForDate` / `tttPuzzleForDate` in `shared/daily.js`; the Worker's `/d/{date}` card names the same game. Same
  solve, tries, share text (it adds "Tic-Tac-Toe") and "Play someone now" (an open Tic-Tac-Toe seat, else `/lobby`).
  Connect Four events are unchanged; Tic-Tac-Toe days tally `daily_solve_ttt`, `daily_link_ttt` (arrivals through
  `/d/`) and `daily_play_ttt`. Kill rule: over 4 weeks of live Tic-Tac-Toe days, `daily_link_ttt` or
  `daily_solve_ttt` per Tic-Tac-Toe day below `daily_link` or `daily_solve` per Connect Four day. Checkers not built.

- A Five in a Row day in the daily (item 3, live 2026-11-28, Pages 1877e1d, cc-api 3c3050a0): every fourth UTC day (day number % 4 === 1, first on
  2026-12-02; 2026-11-28 stays Connect Four because it was already served) the daily is "make the five that wins now", one
  move with exactly one winning cell and no immediate five for the opponent, from `gameForDate` / `fivePuzzleForDate` in
  `shared/daily.js` (rules of `shared/games/five.js`). The page shows the 7x7 window of the 15x15 board that holds every
  stone, so cells are 44 px targets at 390 px wide; cells and the solution step are named by row and column. Same solve,
  tries, streak, share text and "Play someone now" (an open Five in a Row seat, else `/lobby`); tallies `daily_solve_five`,
  `daily_link_five`, `daily_play_five`. Kill rule: over 4 weeks of live Five in a Row days, `daily_solve_five` per such day
  below `daily_solve_ttt` per Tic-Tac-Toe day.

- "Play someone now" after the daily is done (not in the solution view): joins an open Connect Four seat from `GET /api/live`, else `/lobby` (item 2, built). Data: tally `cc` events `daily_play` (clicks) and `daily_solve` (first solves); kill rule: `daily_play` under 5% of `daily_solve` within 4 weeks of launch.

- Five in a Row, a fourth game (live since 2026-11-28 with Pages 83c32ef; id `five`, built in a2ae58b and 8b6ec3b,
  before it was queued here by mistake): a 15x15 place-a-mark game, five or more in a line wins, full board draws, no opening rules, from
  `shared/games/five.js` through the registry (rooms, lobby, house opponent, agent manifest). New rooms by game are
  counted by the `room_create_<gameId>` tally on `cc`, sent at the game screen's create-room call in `src/Game.jsx` (added
  here; none existed before, only `finished_<gameId>`; lobby matches and house games are not counted by it). Kill rule: `room_create_five` under 5 % of all `room_create_*`
  within 4 weeks of launch.

- Quick emotes (live since b49da0d: six fixed emotes 👍 👏 😮 😅 🤔 🔥, one per second per seat); 2026-11-28 adds spectator view,
  seat placement (3 s beside the sender's seat on every screen), screen-reader labels and announcements, 44 px buttons,
  buttons hidden on the Fly backend, and a `react` tally per send (built in PR #93, not live yet). Spectators get no buttons
  and the server drops their sends.

## Next

Finding (2026-11-28, after the Tic-Tac-Toe day): the daily now has a streak, a solution, a shared link and two games, but
Arena bots only ever meet when their authors happen to be online. Next, in need order:

2. **A weekly Arena cup (explore).** Seen by: bot authors and spectators on `/arena`. Changes: every Sunday 12:00 UTC the
   Worker pairs (drawn by the first rated game or cup visit after noon; no free cron slot) the connected rated bots of each game in a Swiss round of 3 games each; `/arena/cup` shows this
   week's table and last week's winner, and each bot page shows its cup results. Data: additive cup tables in the Lobby
   Durable Object (no D1 in this Worker), written by the draw only; ratings unchanged. Kill rule: fewer than 4 distinct bots enter any of the first 4
   cups.

Not here: anything on the house opponent (PR #65); rated human play (humans are a fixed guest pool by design in
`docs/arena.md`); any paid service or custom domain.

