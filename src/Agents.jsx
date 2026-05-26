import React, { useState } from "react";
import { Link } from "react-router-dom";
import "@shared/games/index.js";
import { listAll } from "@shared/games/registry.js";

const BACKEND_URL = "https://crisscross-backend.fly.dev";
const DISCOVERY_LINKS = [
  { label: "llms.txt", file: "llms.txt" },
  { label: "Agent manifest", file: "agent-manifest.json" },
];
const GAME_DETAILS = {
  ttt: { board: "3×3 grid, row-major cells 0–8.", move: '{ type: "place", cell: 4 }', note: "Use an empty absolute cell index." },
  connect4: { board: "6×7 grid, row-major board after each drop.", move: '{ type: "place", cell: 3 }', note: "For Connect Four, cell is the column index 0–6." },
  checkers: { board: "8×8 grid, row-major cells 0–63; pieces are { type, owner }.", move: '{ type: "transfer", from: 42, to: 33, captures: [24] }', note: "captures is optional and only needed for jumps." },
};
const SUPPORTED_GAMES = listAll().map((game) => ({ ...game, ...GAME_DETAILS[game.id] }));

const CONNECT_EXAMPLE = `import { io } from "socket.io-client";

const socket = io("https://crisscross-backend.fly.dev", {
  transports: ["websocket", "polling"]
});
let mySlot = null;

socket.emit("joinRoom", {
  roomId: "ABCDE",
  clientId: "agent-alpha-001",
  displayName: "Agent Alpha"
}, ({ player, error }) => {
  if (error) throw new Error(error);
  mySlot = player === "X" ? 0 : player === "O" ? 1 : null;
});

socket.on("gameUpdate", (state) => {
  if (state.status !== "active" || state.turnSlot !== mySlot) return;
  socket.emit("makeMove", {
    roomId: state.roomId,
    move: { type: "place", cell: 4 }
  });
});`;

const EVENT_EXAMPLES = `socket.emit("createRoom", {
  clientId: "human-or-agent-stable-id",
  displayName: "Ada",
  gameId: "ttt"
}, ({ roomId, player, error }) => {});

socket.emit("joinRoom", {
  roomId: "ABCDE",
  clientId: "agent-alpha-001",
  displayName: "Agent Alpha"
}, ({ player, error }) => {});

socket.emit("switchGame", {
  roomId: "ABCDE",
  gameId: "connect4"
}, ({ success, gameId, error }) => {});

socket.emit("makeMove", {
  roomId: "ABCDE",
  move: { type: "place", cell: 4 }
});`;

const UPDATE_EXAMPLE = `{
  "roomId": "ABCDE",
  "gameId": "ttt",
  "board": ["X", "", "", "", "O", "", "", "", ""],
  "turn": "X",
  "turnSlot": 0,
  "status": "active",
  "scores": [0, 0],
  "playerInfo": [
    { "slot": 0, "label": "X", "color": "sky" },
    { "slot": 1, "label": "O", "color": "rose" }
  ],
  "roster": { "X": "socket-id", "O": "socket-id", "spectators": [] }
}`;

function staticUrl(file) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${base}${file.replace(/^\//, "")}`;
}

function CodeBlock({ title, code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="min-w-0 rounded-3xl border border-foreground/10 bg-background/80 p-5 shadow-sm shadow-foreground/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60">{title}</h3>
        <button type="button" onClick={copy} aria-label={`Copy ${title} example`} className="rounded-full border border-foreground/10 px-3 py-1 text-xs font-medium text-foreground/70 transition hover:border-foreground/20 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100"><code>{code}</code></pre>
    </section>
  );
}

function Agents() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-[2rem] border border-foreground/10 bg-foreground/[0.03] p-6 sm:p-8">
          <Link to="/" className="text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline">← Back to CrissCross</Link>
          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground/50">Agent access</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Connect humans and agents in the same room.</h1>
            <p className="mt-5 text-lg leading-8 text-foreground/70">
              CrissCross rooms are plain Socket.IO sessions. A human can create a room in the app, share the five-character code or room link, and an agent can join that same room through the backend.
            </p>
          </div>
        </header>

        <section aria-labelledby="backend" className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-foreground/10 p-5">
            <h2 id="backend" className="text-xl font-semibold">Backend URL</h2>
            <p className="mt-3 text-foreground/70">Use this Socket.IO origin for hosted multiplayer rooms.</p>
          </div>
          <div className="min-w-0 rounded-3xl bg-slate-950 p-5 text-slate-100"><code className="break-all text-base">{BACKEND_URL}</code></div>
        </section>

        <section aria-labelledby="flows" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-foreground/10 p-6">
            <h2 id="flows" className="text-2xl font-semibold">Human flow</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-foreground/75">
              <li>Open the app and choose a game.</li>
              <li>Create a room to receive a five-character code.</li>
              <li>Share the code or the <code>/room/ABCDE</code> link with another player or agent.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-foreground/10 p-6">
            <h2 className="text-2xl font-semibold">Agent flow</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-foreground/75">
              <li>Connect to the backend with Socket.IO.</li>
              <li>Emit <code>joinRoom</code> with roomId, clientId, and displayName.</li>
              <li>Listen for <code>gameUpdate</code>; when it is your turn, emit <code>makeMove</code>.</li>
            </ol>
          </div>
        </section>

        <section aria-labelledby="examples" className="space-y-4">
          <h2 id="examples" className="text-2xl font-semibold">Copyable examples</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <CodeBlock title="Socket.IO agent" code={CONNECT_EXAMPLE} />
            <CodeBlock title="Events and payloads" code={EVENT_EXAMPLES} />
          </div>
          <CodeBlock title="gameUpdate payload shape" code={UPDATE_EXAMPLE} />
        </section>

        <section aria-labelledby="games" className="rounded-3xl border border-foreground/10 p-6">
          <h2 id="games" className="text-2xl font-semibold">Supported game ids and moves</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SUPPORTED_GAMES.map((game) => (
              <article key={game.id} className="min-w-0 rounded-2xl bg-foreground/[0.03] p-4">
                <h3 className="text-lg font-semibold">{game.displayName}</h3>
                <p className="mt-1 text-sm text-foreground/60"><code>{game.id}</code></p>
                <p className="mt-4 text-sm leading-6 text-foreground/70">{game.board}</p>
                <pre className="mt-4 max-w-full overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100"><code>{game.move}</code></pre>
                <p className="mt-3 text-sm text-foreground/65">{game.note}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-foreground/10 py-6 text-sm text-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>Seated players are X/O today; prefer turnSlot, winnerSlot, scores, and playerInfo for agents.</p>
          <nav aria-label="Agent discovery links" className="flex flex-wrap gap-3">
            {DISCOVERY_LINKS.map((link) => <a key={link.file} href={staticUrl(link.file)} className="underline-offset-4 hover:text-foreground hover:underline">{link.label}</a>)}
          </nav>
        </footer>
      </div>
    </main>
  );
}

export default Agents;
