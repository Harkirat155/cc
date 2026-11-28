import { useEffect, useRef, useSyncExternalStore } from "react";
import { isSoundOn, playSound, soundFor, subscribeSound, unlockOnGesture } from "../utils/sound";

const SETTLE_MS = 1500; // state arriving this soon after a join or reconnect is a replay, not a move

// Plays move and result sounds from game-state changes. `baseKey` (room id + connection)
// changing starts a settle window, so joining, switching rooms and reconnect replays stay silent.
export default function useGameSounds(gameState, viewerSlot, baseKey) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  const prev = useRef({ key: baseKey, state: null, since: Date.now() });
  useEffect(() => unlockOnGesture(), []);
  useEffect(() => {
    const p = prev.current;
    const since = p.key === baseKey ? p.since : Date.now();
    const settled = Date.now() - since > SETTLE_MS;
    const sound = settled ? soundFor(p.state, gameState, viewerSlot, !on) : null;
    prev.current = { key: baseKey, state: gameState, since };
    if (sound) playSound(sound);
  }, [gameState, baseKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
