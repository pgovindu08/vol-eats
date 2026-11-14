import { describe, expect, it } from "vitest";
import { addDays, atMealTime, dayStatus, logsByDay, shortDay, weekDays } from "./log-days";
import { schoolDate } from "./meal-period";
import type { FoodLog } from "./types";

describe("log calendar helpers", () => {
  it("builds Monday–Sunday weeks, across month ends", () => {
    expect(weekDays("2026-11-14")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(weekDays("2026-11-30")[0]).toBe("2026-11-30"); // a Monday
    expect(weekDays("2026-12-02")[6]).toBe("2026-12-06");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("rates a day against the calorie target (±10% is a hit)", () => {
    expect(dayStatus(0, 2000)).toBe("empty");
    expect(dayStatus(1799, 2000)).toBe("under");
    expect(dayStatus(1800, 2000)).toBe("hit");
    expect(dayStatus(2200, 2000)).toBe("hit");
    expect(dayStatus(2201, 2000)).toBe("over");
  });

  it("logs to a past day land on that day in Eastern time", () => {
    for (const p of ["breakfast", "lunch", "dinner"] as const) {
      expect(schoolDate(new Date(atMealTime("2026-11-11", p)))).toBe("2026-11-11");
    }
    const log = (logged_at: string) => ({ logged_at }) as FoodLog;
    const grouped = logsByDay([log(atMealTime("2026-11-11", "dinner")), log(atMealTime("2026-11-12", "breakfast"))]);
    expect(Object.keys(grouped).sort()).toEqual(["2026-11-11", "2026-11-12"]);
  });

  it("formats short day labels", () => {
    expect(shortDay("2026-11-11")).toBe("Wed, Nov 11");
  });
});

import { demoHistory, DEMO_PROFILE } from "@/mock/demo-profile";
import { sumLogs } from "./macros";

describe("demo history", () => {
  it("fills the 6 days before today with a mix of on target, under and over", () => {
    const byDay = logsByDay(demoHistory("2026-11-14"));
    expect(Object.keys(byDay).sort()).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
    const statuses = Object.values(byDay).map((l) => dayStatus(sumLogs(l).calories, DEMO_PROFILE.target_calories));
    expect(new Set(statuses)).toEqual(new Set(["hit", "under", "over"]));
  });
});
