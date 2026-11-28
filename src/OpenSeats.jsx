import React from "react";
import { Link } from "react-router-dom";

// Listed rooms with one seat filled (GET /api/live `open`). Names are display names; Join opens the room.
export default function OpenSeats({ open, names }) {
  if (!Array.isArray(open) || open.length === 0) return null;
  return (
    <section aria-label="Open seats">
      <h2 className="text-xl font-semibold">Open seats</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {open.map((o) => (
          <li key={o.roomId} className="flex items-center justify-between gap-4 rounded-2xl border border-foreground/10 p-3">
            <span className="min-w-0 truncate">Waiting: {o.name} · {names[o.gameId] || o.gameId}</span>
            <Link to={`/room/${encodeURIComponent(o.roomId)}`} className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Join</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
