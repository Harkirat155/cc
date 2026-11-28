import React, { useSyncExternalStore } from "react";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.js";
import VolumeX from "lucide-react/dist/esm/icons/volume-x.js";
import { Tooltip } from "./ui/Tooltip";
import { isSoundOn, setSoundOn, subscribeSound } from "../utils/sound";

const SoundToggle = () => {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  const label = on ? "Sound on" : "Sound off";
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={() => setSoundOn(!on)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.03] text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </Tooltip>
  );
};

export default SoundToggle;
