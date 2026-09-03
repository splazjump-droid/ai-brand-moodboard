import { describe, it, expect } from "vitest";
import { projectName } from "./smoke";

describe("скаффолд", () => {
  it("собирается и видит алиас @/", () => {
    expect(projectName).toBe("ai-brand-moodboard");
  });
});
