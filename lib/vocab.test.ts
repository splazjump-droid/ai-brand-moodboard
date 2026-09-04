import { describe, it, expect } from "vitest";
import { CHARACTER_CHIPS, AESTHETIC_CHIPS, directionsForChips } from "./vocab";
import { findDirection, DIRECTIONS } from "./catalog";

const ALL = [...CHARACTER_CHIPS, ...AESTHETIC_CHIPS];

describe("словарь чипов", () => {
  it("по шесть чипов в каждом списке", () => {
    expect(CHARACTER_CHIPS).toHaveLength(6);
    expect(AESTHETIC_CHIPS).toHaveLength(6);
  });

  it("каждый чип ссылается на существующие направления", () => {
    for (const chip of ALL) {
      expect(chip.directionIds.length, chip.label).toBeGreaterThanOrEqual(2);
      for (const id of chip.directionIds) {
        expect(findDirection(id), `чип «${chip.label}» ссылается на неизвестное направление ${id}`).toBeDefined();
      }
    }
  });

  it("id чипов уникальны в обоих списках вместе", () => {
    expect(new Set(ALL.map((c) => c.id)).size).toBe(ALL.length);
  });

  it("подписи на русском", () => {
    for (const chip of ALL) expect(chip.label).toMatch(/[а-яё]/i);
  });

  it("каждое направление достижимо хотя бы одним чипом", () => {
    const reachable = new Set(ALL.flatMap((c) => c.directionIds));
    for (const d of DIRECTIONS) {
      expect(reachable.has(d.id), `направление ${d.id} не достижимо ни одним чипом`).toBe(true);
    }
  });

  it("directionsForChips собирает направления без повторов", () => {
    const result = directionsForChips([CHARACTER_CHIPS[0].id, CHARACTER_CHIPS[0].id]);
    expect(new Set(result.map((d) => d.id)).size).toBe(result.length);
  });

  it("directionsForChips молча пропускает неизвестный чип", () => {
    expect(directionsForChips(["нет-такого"])).toEqual([]);
  });
});
