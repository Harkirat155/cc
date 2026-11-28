import React from "react";
import { Link } from "react-router-dom";
import { tally } from "../lib/tally";
import useOnline from "../hooks/useOnline";

const DOOR =
  "flex min-h-[4.5rem] flex-col items-start justify-center gap-0.5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-left transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20";

const Body = ({ title, hint }) => (
  <>
    <span className="text-sm font-medium text-foreground">{title}</span>
    <span className="text-xs text-foreground/60">{hint}</span>
  </>
);

// First-visit doors: the four things to do besides pushing stones on an empty board.
const HomeDoors = ({ onComputer, onFriend }) => {
  const online = useOnline();
  return (
  <nav aria-label="Ways to play" className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
    <Link to="/daily" className={DOOR} onClick={() => tally("cc", "door_daily")}>
      <Body title="Today’s puzzle" hint="A new one each day" />
    </Link>
    <Link to="/rush" className={DOOR} onClick={() => tally("cc", "door_rush")}>
      <Body title="Puzzle Rush" hint="3 minutes, how many?" />
    </Link>
    <button
      type="button"
      className={DOOR}
      onClick={() => { tally("cc", "door_computer"); onComputer(); }}
    >
      <Body title="Play the computer" hint="Easy to hard" />
    </button>
    <button
      type="button"
      className={`${DOOR} disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={!online}
      onClick={() => { tally("cc", "door_friend"); onFriend(); }}
    >
      <Body title="Play a friend" hint={online ? "Send a link" : "Needs a signal"} />
    </button>
  </nav>
  );
};

export default HomeDoors;
