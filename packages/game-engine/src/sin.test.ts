import { describe, expect, it } from "vitest";
import { hasSin } from "./sin.js";
import { player } from "./testUtils.js";

describe("hasSin", () => {
  it("cruz disponible y nunca voló → tiene SIN", () => {
    expect(hasSin(player({ crossState: "available", hasEverFlown: false }))).toBe(true);
  });

  it("cruz usada → pierde SIN", () => {
    expect(hasSin(player({ crossState: "used", hasEverFlown: false }))).toBe(false);
  });

  it("voló → pierde SIN aunque tenga cruz disponible en teoría", () => {
    expect(hasSin(player({ crossState: "available", hasEverFlown: true }))).toBe(false);
  });
});
