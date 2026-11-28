import { monthsBetween, monthWeeks, dayState } from "./dailyGrid";

describe("monthsBetween", () => {
  it("is one month when launch and today share it", () => {
    expect(monthsBetween("2026-11-27", "2026-11-28")).toEqual(["2026-11"]);
  });
  it("crosses a year boundary, newest first", () => {
    expect(monthsBetween("2026-11-27", "2027-02-03")).toEqual(["2027-02", "2027-01", "2026-12", "2026-11"]);
  });
});

describe("monthWeeks", () => {
  it("pads Monday-first: November 2026 starts on a Sunday", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1][0]).toBe("2026-11-02");
  });
  it("ends on the last day with trailing padding, every week 7 wide", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
  });
  it("knows a leap February", () => {
    expect(monthWeeks("2028-02").flat().filter(Boolean)).toHaveLength(29);
  });
});

describe("dayState", () => {
  const store = { days: ["2026-11-27"], pastTries: { "2026-11-26": 2 }, date: "2026-11-28", tries: 3, solved: false };
  it("solved wins over tries", () => expect(dayState("2026-11-27", store)).toBe("solved"));
  it("tried from pastTries or today's tries above one", () => {
    expect(dayState("2026-11-26", store)).toBe("tried");
    expect(dayState("2026-11-28", store)).toBe("tried");
  });
  it("a fresh try 1 on today is not tried", () => {
    expect(dayState("2026-11-28", { days: [], pastTries: {}, date: "2026-11-28", tries: 1 })).toBe("not tried");
  });
  it("an empty record is not tried", () => expect(dayState("2026-11-29", { days: [], pastTries: {} })).toBe("not tried"));
});
