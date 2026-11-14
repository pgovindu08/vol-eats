import { describe, expect, it } from "vitest";
import { distanceFromMinKao, openStatus } from "./stubs";

// Nov 14 2026 is a Saturday (EST, UTC-5); Nov 15 a Sunday.
const et = (d: string, hhmm: string) => new Date(`2026-11-${d}T${hhmm}:00-05:00`);

describe("Food tab stand-ins", () => {
  it("measures walking distance from Min Kao", () => {
    const d = distanceFromMinKao("loc-rockytop")!;
    expect(d.miles).toBeGreaterThan(0.2);
    expect(d.miles).toBeLessThan(1.5);
    expect(d.walkMinutes).toBeGreaterThan(3);
    expect(distanceFromMinKao("loc-unknown")).toBeNull();
  });

  it("reports open, opening later, and closed days in Eastern time", () => {
    expect(openStatus("loc-rockytop", et("14", "12:00"))).toEqual({ open: true, label: "Open until 8:00 PM" });
    expect(openStatus("loc-rockytop", et("14", "08:00"))).toEqual({ open: false, label: "Opens 10:00 AM" });
    expect(openStatus("loc-rockytop", et("14", "21:00")).label).toBe("Opens tomorrow 10:00 AM");
    expect(openStatus("loc-chickfila", et("15", "12:00")).label).toBe("Opens tomorrow 7:30 AM"); // closed Sundays
    expect(openStatus("loc-chickfila", et("14", "19:00")).label).toBe("Opens Mon 7:30 AM"); // Sat evening skips Sunday
  });
});
