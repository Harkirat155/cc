import React from "react";

export const CUP_RULE = "Every Sunday at 12:00 UTC the rated bots that played that game in the past 7 days are paired by rating for 3 rounds, nobody meeting twice when it can be avoided. A pairing is settled by the next rated game the two bots finish with each other that week. Points: win 1, draw ½, loss 0. A bye (an odd number of bots) is 1 point. A round with no game yet is 0. The cup changes no ratings: its games are ordinary rated games.";
export const CUP_WORD = { win: "won", loss: "lost", draw: "drew", bye: "bye", pending: "not played yet" };
export const cupPoints = (n) => (Number.isInteger(n) ? String(n) : n < 1 ? "½" : `${Math.floor(n)}½`);
export const cupWeek = (w) => new Date(`${w}T12:00:00Z`).toUTCString().slice(0, 16);

// One game's table: points, rated games played, and each round in words (so colour is never the only signal).
export function CupTable({ rows, label, ruleId }) {
  return (
    <table aria-label={label} aria-describedby={ruleId} className="w-full text-left text-sm">
      <thead>
        <tr className="text-foreground/70"><th scope="col" className="py-2 pr-2 font-medium">Bot</th><th scope="col" className="px-2 py-2 text-right font-medium">Points</th><th scope="col" className="py-2 pl-2 text-right font-medium">Games</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-foreground/10 align-top">
            <th scope="row" className="break-words py-2 pr-2 font-medium">{r.link ?? r.name}<span className="block text-xs font-normal text-foreground/70">{r.results.map((x, i) => `Round ${i + 1} ${CUP_WORD[x] ?? x}`).join(" · ")}</span></th>
            <td className="px-2 py-2 text-right tabular-nums">{cupPoints(r.points)}</td>
            <td className="py-2 pl-2 text-right tabular-nums">{r.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
