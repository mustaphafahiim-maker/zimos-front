import { describe, expect, it } from "vitest";
import { hoursProblem, periodsOf, periodsOverlap, toSavedDay } from "./storeHoursPeriods";

const day = (open: string, close: string, closed = false) => ({ closed, open, close });

// Opening hours with up to 3 periods a day, as the dashboard edits and saves them.
describe("opening hours periods", () => {
  it("reads a day saved with one open/close as one period", () => {
    expect(periodsOf(day("09:00", "23:00"))).toEqual([{ open: "09:00", close: "23:00" }]);
    expect(periodsOf({ ...day("10:00", "14:00"), periods: [{ open: "10:00", close: "14:00" }, { open: "18:00", close: "23:00" }] })).toHaveLength(2);
  });

  it("finds overlaps, a period past midnight included, and allows a gap", () => {
    expect(periodsOverlap([{ open: "10:00", close: "14:00" }, { open: "18:00", close: "23:00" }])).toBe(false);
    expect(periodsOverlap([{ open: "10:00", close: "15:00" }, { open: "14:00", close: "20:00" }])).toBe(true);
    expect(periodsOverlap([{ open: "12:00", close: "15:00" }, { open: "20:00", close: "02:00" }])).toBe(false);
    expect(periodsOverlap([{ open: "20:00", close: "03:00" }, { open: "22:00", close: "23:00" }])).toBe(true);
    expect(periodsOverlap([{ open: "", close: "10:00" }])).toBe(true);
  });

  it("names the first open day with overlapping periods; closed days are not checked", () => {
    const bad = { ...day("10:00", "15:00"), periods: [{ open: "10:00", close: "15:00" }, { open: "14:00", close: "20:00" }] };
    const week = Array.from({ length: 7 }, () => day("09:00", "23:00"));
    expect(hoursProblem(week)).toBeNull();
    expect(hoursProblem(week.map((d, i) => (i === 3 ? bad : d)))).toBe(3);
    expect(hoursProblem(week.map((d, i) => (i === 3 ? { ...bad, closed: true } : d)))).toBeNull();
  });

  it("saves one period in the shape stores have today, several as periods with the first mirrored", () => {
    expect(toSavedDay({ ...day("09:00", "23:00"), periods: [{ open: "09:00", close: "23:00" }] })).toEqual(day("09:00", "23:00"));
    const two = [{ open: "10:00", close: "14:00" }, { open: "18:00", close: "23:00" }];
    expect(toSavedDay({ ...day("x", "y"), periods: two })).toEqual({ closed: false, open: "10:00", close: "14:00", periods: two });
  });
});
