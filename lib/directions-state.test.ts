import { describe, it, expect } from "vitest";
import { accumulate, isComplete } from "./directions-state";
import { directionsByTier, type Tier } from "./catalog";

// Направление берётся из своего уровня вместе с его же палитрой и парой
// шрифтов: схема проверяет согласованность, случайные id её не пройдут.
const make = (tier: Tier, index = 0) => {
  const direction = directionsByTier(tier)[index];
  return {
    section: "direction",
    data: {
      tier,
      directionId: direction.id,
      name: "Название",
      concept: "к".repeat(100),
      keywords: ["раз", "два", "три"],
      paletteId: direction.paletteIds[0],
      fontPairId: direction.fontPairIds[0],
      rationale: "р".repeat(50),
    },
  };
};

describe("накопление направлений", () => {
  it("из трёх кусков собирает три направления", () => {
    const result = accumulate([], [make("safe"), make("bold"), make("experimental")]);
    expect(result).toHaveLength(3);
    expect(isComplete(result)).toBe(true);
  });

  it("накапливает по одному куску за раз", () => {
    let state = accumulate([], [make("safe")]);
    expect(isComplete(state)).toBe(false);
    state = accumulate(state, [make("bold")]);
    state = accumulate(state, [make("experimental")]);
    expect(isComplete(state)).toBe(true);
  });

  it("повтор того же уровня перезаписывает, а не удваивает", () => {
    // Куски разные по содержимому: иначе тест не отличит «побеждает
    // последнее» от «побеждает первое» и проверял бы только длину.
    const first = make("safe", 0);
    const second = make("safe", 1);
    const state = accumulate([], [first, second]);
    expect(state).toHaveLength(1);
    expect(state[0].directionId).toBe(second.data.directionId);
  });

  it("направление, не прошедшее схему, молча отбрасывается", () => {
    const broken = { section: "direction", data: { tier: "safe", name: "х" } };
    expect(accumulate([], [broken])).toHaveLength(0);
  });

  it("направление не из своего уровня отбрасывается", () => {
    const mismatched = make("safe");
    mismatched.data.directionId = directionsByTier("bold")[0].id;
    expect(accumulate([], [mismatched])).toHaveLength(0);
  });

  it("кусок с неизвестной секцией отбрасывается", () => {
    // Данные внутри полностью валидны: отбраковать кусок должно имя
    // секции, а не схема. С мусорными данными тест был бы зелёным
    // и без проверки секции.
    const alien = { ...make("safe"), section: "мусор" };
    expect(accumulate([], [alien])).toHaveLength(0);
  });

  it("порядок всегда safe, bold, experimental, независимо от прихода", () => {
    const result = accumulate([], [make("experimental"), make("safe"), make("bold")]);
    expect(result.map((d) => d.tier)).toEqual(["safe", "bold", "experimental"]);
  });
});
