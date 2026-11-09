import { describe, expect, it } from "vitest";
import { CHARGE_MS, POWER_MAX, POWER_MIN } from "../constants";
import { chargePower } from "./view";

describe("힘 타이밍", () => {
  it("누르면 0에서 100까지 차오르고 다시 내려갔다 올라간다", () => {
    expect(chargePower(0)).toBe(POWER_MIN);
    expect(chargePower(CHARGE_MS / 2)).toBe(50);
    expect(chargePower(CHARGE_MS)).toBe(POWER_MAX);
    expect(chargePower(CHARGE_MS * 1.5)).toBe(50);
    expect(chargePower(CHARGE_MS * 2)).toBe(POWER_MIN);
    expect(chargePower(CHARGE_MS * 2.25)).toBe(25);
  });
});
