import React, { useState } from "react";

export const SINCE = "2026-11-28"; // when per-game history started being recorded; earlier games have no rows
export const BOT_NAME = /^[A-Za-z0-9 _-]{3,24}$/; // the House names fail this and have no page
export const RULE = "Rated: games a registered bot finishes against anyone. Elo, K=32, everyone starts at 1200. Humans and unregistered bots count as a fixed 1200 opponent and are never listed.";
const RESERVED = /^house(easy|medlum|hard)$/; // mirrors worker/src/lobby.ts: compared after 0->o, 1/i->l and stripping everything else
// Same gate as registration: only a name that could have been registered has a page.
export const validName = (n) => BOT_NAME.test(n) && n === n.trim() && !RESERVED.test(n.toLowerCase().replace(/0/g, "o").replace(/[1i]/g, "l").replace(/[^a-z]/g, ""));
export const VERB ={ win: "Won", loss: "Lost", draw: "Drew" };

// The Worker answers HTTP on the same origin it serves sockets from; a ws(s):// base maps to http(s)://.
export function apiBase() {
  const base = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_SOCKET_SERVER || "").trim().replace(/\/$/, "");
  return base.replace(/^ws/, "http");
}
export const badgeBase = () => apiBase() || "https://cc-api.harkirat-hira.workers.dev";

// Markdown for a bot's README: the badge image links to the bot's page.
export const badgeMd = (base, name, game) => `[![CrissCross rating](${base}/api/arena/badge/${encodeURIComponent(name)}.svg?game=${game})](https://harkirat155.github.io/cc/arena/${encodeURIComponent(name)})`;

export const gameLine = (g, names) => `${VERB[g.result] ?? g.result} vs ${g.opponent} · ${names[g.gameId] || g.gameId} · ${g.ratingAfter}`;

// Copy button for the badge Markdown; when the clipboard refuses, the text is shown to copy by hand.
export function BadgeCopy({ name, game, label = "Badge", gameName = game }) {
  const [state, setState] = useState(""); // "" | "ok" | "failed"
  const md = badgeMd(badgeBase(), name, game);
  const copy = async () => {
    try { await navigator.clipboard.writeText(md); setState("ok"); window.setTimeout(() => setState(""), 2000); }
    catch { setState("failed"); }
  };
  return (
    <>
      <button type="button" className="ml-2 text-xs font-normal text-foreground/70 underline underline-offset-4" onClick={copy}>{state === "ok" ? "Copied" : state === "failed" ? "Copy failed: select the text below" : label}</button>
      {state === "failed" && (
        <input readOnly aria-label={`Badge Markdown for ${name}, ${gameName}`} value={md} onFocus={(e) => e.target.select()} className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-1 text-xs font-normal" />
      )}
    </>
  );
}

// Path of a game's replay page; link it only from a row that has a replayId (older games have no stored moves).
export const replayPath = (id) => `/replay/${encodeURIComponent(id)}`;
