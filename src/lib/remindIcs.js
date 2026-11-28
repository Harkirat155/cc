// A calendar file made on the device: a daily event at the UTC reset (the daily puzzle's day key is the UTC date).
const URL_DAILY = "https://harkirat155.github.io/cc/daily/";
const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

export function remindIcs(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrissCross//Daily//EN",
    "BEGIN:VEVENT",
    "UID:cc-daily@harkirat155.github.io",
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(next)}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Today's CrissCross puzzle",
    `URL:${URL_DAILY}`,
    `DESCRIPTION:The new puzzle is up: ${URL_DAILY}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Today's CrissCross puzzle",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadRemind() {
  const url = URL.createObjectURL(new Blob([remindIcs()], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "crisscross-daily.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari drops the download if the URL is revoked at once
}
