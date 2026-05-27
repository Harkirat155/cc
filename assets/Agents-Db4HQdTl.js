import{q as e,L as n,x as d}from"./vendor-Cv4JD_Zf.js";import{l as c}from"./index-Dn-BI8eM.js";const i="https://crisscross-backend.fly.dev",m=[{label:"llms.txt",file:"llms.txt"},{label:"Agent manifest",file:"agent-manifest.json"}],x={ttt:{board:"3×3 grid, row-major cells 0–8.",move:'{ type: "place", cell: 4 }',note:"Use an empty absolute cell index."},connect4:{board:"6×7 grid, row-major board after each drop.",move:'{ type: "place", cell: 3 }',note:"For Connect Four, cell is the column index 0–6."},checkers:{board:"8×8 grid, row-major cells 0–63; pieces are { type, owner }.",move:'{ type: "transfer", from: 42, to: 33, captures: [24] }',note:"captures is optional and only needed for jumps."}},p=c().map(o=>({...o,...x[o.id]})),h=`import { io } from "socket.io-client";

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
});`,f=`socket.emit("createRoom", {
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
});`,u=`{
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
}`;function g(o){return`${"/cc/".replace(/\/?$/,"/")}${o.replace(/^\//,"")}`}function t({title:o,code:s}){const[a,r]=d.useState(!1),l=async()=>{if(!(typeof navigator>"u"||!navigator.clipboard))try{await navigator.clipboard.writeText(s),r(!0),setTimeout(()=>r(!1),1200)}catch{r(!1)}};return e.jsxs("section",{className:"min-w-0 rounded-3xl border border-foreground/10 bg-background/80 p-5 shadow-sm shadow-foreground/5",children:[e.jsxs("div",{className:"mb-3 flex items-center justify-between gap-3",children:[e.jsx("h3",{className:"text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60",children:o}),e.jsx("button",{type:"button",onClick:l,"aria-label":`Copy ${o} example`,className:"rounded-full border border-foreground/10 px-3 py-1 text-xs font-medium text-foreground/70 transition hover:border-foreground/20 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",children:a?"Copied":"Copy"})]}),e.jsx("pre",{className:"max-w-full overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100",children:e.jsx("code",{children:s})})]})}function y(){return e.jsx("main",{className:"min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8",children:e.jsxs("div",{className:"mx-auto flex w-full max-w-5xl flex-col gap-10",children:[e.jsxs("header",{className:"rounded-[2rem] border border-foreground/10 bg-foreground/[0.03] p-6 sm:p-8",children:[e.jsx(n,{to:"/",className:"text-sm font-medium text-foreground/60 underline-offset-4 hover:text-foreground hover:underline",children:"← Back to CrissCross"}),e.jsxs("div",{className:"mt-8 max-w-3xl",children:[e.jsx("p",{className:"text-sm font-semibold uppercase tracking-[0.24em] text-foreground/50",children:"Agent access"}),e.jsx("h1",{className:"mt-3 text-4xl font-semibold tracking-tight sm:text-5xl",children:"Connect humans and agents in the same room."}),e.jsx("p",{className:"mt-5 text-lg leading-8 text-foreground/70",children:"CrissCross rooms are plain Socket.IO sessions. A human can create a room in the app, share the five-character code or room link, and an agent can join that same room through the backend."})]})]}),e.jsxs("section",{"aria-labelledby":"backend",className:"grid gap-4 md:grid-cols-[0.8fr_1.2fr]",children:[e.jsxs("div",{className:"rounded-3xl border border-foreground/10 p-5",children:[e.jsx("h2",{id:"backend",className:"text-xl font-semibold",children:"Backend URL"}),e.jsx("p",{className:"mt-3 text-foreground/70",children:"Use this Socket.IO origin for hosted multiplayer rooms."})]}),e.jsx("div",{className:"min-w-0 rounded-3xl bg-slate-950 p-5 text-slate-100",children:e.jsx("code",{className:"break-all text-base",children:i})})]}),e.jsxs("section",{"aria-labelledby":"flows",className:"grid gap-4 md:grid-cols-2",children:[e.jsxs("div",{className:"rounded-3xl border border-foreground/10 p-6",children:[e.jsx("h2",{id:"flows",className:"text-2xl font-semibold",children:"Human flow"}),e.jsxs("ol",{className:"mt-4 list-decimal space-y-3 pl-5 text-foreground/75",children:[e.jsx("li",{children:"Open the app and choose a game."}),e.jsx("li",{children:"Create a room to receive a five-character code."}),e.jsxs("li",{children:["Share the code or the ",e.jsx("code",{children:"/room/ABCDE"})," link with another player or agent."]})]})]}),e.jsxs("div",{className:"rounded-3xl border border-foreground/10 p-6",children:[e.jsx("h2",{className:"text-2xl font-semibold",children:"Agent flow"}),e.jsxs("ol",{className:"mt-4 list-decimal space-y-3 pl-5 text-foreground/75",children:[e.jsx("li",{children:"Connect to the backend with Socket.IO."}),e.jsxs("li",{children:["Emit ",e.jsx("code",{children:"joinRoom"})," with roomId, clientId, and displayName."]}),e.jsxs("li",{children:["Listen for ",e.jsx("code",{children:"gameUpdate"}),"; when it is your turn, emit ",e.jsx("code",{children:"makeMove"}),"."]})]})]})]}),e.jsxs("section",{"aria-labelledby":"examples",className:"space-y-4",children:[e.jsx("h2",{id:"examples",className:"text-2xl font-semibold",children:"Copyable examples"}),e.jsxs("div",{className:"grid gap-4 lg:grid-cols-2",children:[e.jsx(t,{title:"Socket.IO agent",code:h}),e.jsx(t,{title:"Events and payloads",code:f})]}),e.jsx(t,{title:"gameUpdate payload shape",code:u})]}),e.jsxs("section",{"aria-labelledby":"games",className:"rounded-3xl border border-foreground/10 p-6",children:[e.jsx("h2",{id:"games",className:"text-2xl font-semibold",children:"Supported game ids and moves"}),e.jsx("div",{className:"mt-5 grid gap-4 md:grid-cols-3",children:p.map(o=>e.jsxs("article",{className:"min-w-0 rounded-2xl bg-foreground/[0.03] p-4",children:[e.jsx("h3",{className:"text-lg font-semibold",children:o.displayName}),e.jsx("p",{className:"mt-1 text-sm text-foreground/60",children:e.jsx("code",{children:o.id})}),e.jsx("p",{className:"mt-4 text-sm leading-6 text-foreground/70",children:o.board}),e.jsx("pre",{className:"mt-4 max-w-full overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100",children:e.jsx("code",{children:o.move})}),e.jsx("p",{className:"mt-3 text-sm text-foreground/65",children:o.note})]},o.id))})]}),e.jsxs("footer",{className:"flex flex-col gap-3 border-t border-foreground/10 py-6 text-sm text-foreground/60 sm:flex-row sm:items-center sm:justify-between",children:[e.jsx("p",{children:"Seated players are X/O today; prefer turnSlot, winnerSlot, scores, and playerInfo for agents."}),e.jsx("nav",{"aria-label":"Agent discovery links",className:"flex flex-wrap gap-3",children:m.map(o=>e.jsx("a",{href:g(o.file),className:"underline-offset-4 hover:text-foreground hover:underline",children:o.label},o.file))})]})]})})}export{y as default};
