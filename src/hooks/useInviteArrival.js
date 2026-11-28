import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { tally } from "../lib/tally";

// Arrivals through a shared /j/ invite link (the Worker adds ?via=j): counted once as room_link, then the marker is dropped from the
// address (replace, no new history entry) so a reload or a bookmark of the room never counts again. Same shape as the daily_link tally.
export default function useInviteArrival() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const q = new window.URLSearchParams(search);
    if (q.get("via") !== "j") return;
    tally("cc", "room_link");
    q.delete("via");
    const rest = q.toString();
    navigate(`${pathname}${rest ? `?${rest}` : ""}${hash}`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
