import React from "react";
import { useNavigate } from "react-router-dom";
import useOpponent from "../hooks/useOpponent";

// The one plain line for a feature that needs the network, with a way back to play that does not.
export default function NoSignal({ children }) {
  const navigate = useNavigate();
  const { setOpponent } = useOpponent();
  const play = () => { setOpponent({ mode: "computer" }); navigate("/"); };
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-foreground/10 p-4 text-foreground/70">
      <p>{children ? `${children} ` : ""}No signal: play the computer or a friend on this phone.</p>
      <button type="button" onClick={play} className="min-h-11 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Play the computer</button>
    </div>
  );
}
