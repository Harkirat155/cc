import { remindIcs } from "./remindIcs";

describe("remindIcs", () => {
  const lines = (now) => remindIcs(now).split("\r\n");

  it("starts the daily event at the next UTC midnight", () => {
    expect(lines(new Date("2026-11-28T10:30:00Z"))).toContain("DTSTART:20261129T000000Z");
    expect(lines(new Date("2026-11-28T00:00:00Z"))).toContain("DTSTART:20261129T000000Z");
    expect(lines(new Date("2026-12-31T23:59:59Z"))).toContain("DTSTART:20270101T000000Z");
  });

  it("is a CRLF calendar with a stable UID, a daily rule, a 15 minute length and an alarm at start", () => {
    const out = remindIcs(new Date("2026-11-28T10:30:00Z"));
    const l = out.split("\r\n");
    expect(out.endsWith("\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l).toContain("PRODID:-//CrissCross//Daily//EN");
    expect(l).toContain("UID:cc-daily@harkirat155.github.io");
    expect(l).toContain("DTSTAMP:20261128T103000Z");
    expect(l).toContain("RRULE:FREQ=DAILY");
    expect(l).toContain("DURATION:PT15M");
    expect(l).toContain("SUMMARY:Today's CrissCross puzzle");
    expect(l).toContain("URL:https://harkirat155.github.io/cc/daily/");
    expect(l).toContain("ACTION:DISPLAY");
    expect(l).toContain("TRIGGER:PT0M");
    expect(l).toContain("END:VEVENT");
    expect(l).toContain("END:VCALENDAR");
  });
});
