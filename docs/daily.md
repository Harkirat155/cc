# Daily puzzle (`/daily`)

An explore bet: a puzzle that changes each day gives people a reason to return and a result line to share.

## Rule
One Connect Four puzzle a day, the same for everyone. New puzzle at 00:00 UTC. The side to move must win in N of its own moves (N is 2 or 3). The computer defends with its best reply; a move that lets the win slip shows "That lets them off the hook" and a Try again (unlimited, counted).

## Result line
`CrissCross daily 2026-11-28 · solved in 2 tries · harkirat155.github.io/cc/daily`, with a Copy button (hand-copy field if the clipboard refuses). Today's tries and solved state live in `localStorage` key `cc.daily`; a new UTC date starts fresh.

## Generator (`shared/daily.js`)
Pure functions. The UTC date seeds a PRNG (FNV-1a into mulberry32), which picks N and plays 6 to 19 random legal plies. An exact solver (`canWin`) keeps the position only if the side to move forces a win within N moves and not within N-1. Otherwise the next random attempt is tried (cap 20000, then throws). No server, nothing precomputed. Measured on 30 consecutive dates: max 5.3 ms, mean 1.3 ms.

The defender (`defenderReply`) takes a win if it has one, else any reply that escapes the forced win, else resists as long as possible.

## Kill rule
If no shared result line is observed in 4 weeks after launch, remove the page, the home link and `shared/daily.js`.
