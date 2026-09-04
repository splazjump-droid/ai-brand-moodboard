import { describe, it, expect } from "vitest";
import { GeneratedDirectionSchema } from "./directions-schema";
import { DIRECTIONS, directionsByTier, TIERS } from "./catalog";

const safe = directionsByTier("safe")[0];
const bold = directionsByTier("bold")[0];

const valid = {
  tier: "safe",
  directionId: safe.id,
  name: "Тихое ремесло",
  concept: "Направление держится на спокойной бумажной палитре и крупной серифной подаче. Оно говорит о ручной работе без деревенских клише.",
  keywords: ["бумага", "ручная работа", "тепло", "спокойствие"],
  paletteId: safe.paletteIds[0],
  fontPairId: safe.fontPairIds[0],
  rationale: "Аудитория покупает зерно домой, ей ближе домашняя интонация, а не витрина сетевой кофейни.",
};

describe("схема ответа модели", () => {
  it("принимает корректное направление", () => {
    expect(GeneratedDirectionSchema.safeParse(valid).success).toBe(true);
  });

  it("уровни риска берутся из каталога", () => {
    expect([...TIERS]).toEqual(["safe", "bold", "experimental"]);
  });

  it("отвергает уровень вне трёх разрешённых", () => {
    expect(GeneratedDirectionSchema.safeParse({ ...valid, tier: "safe2" }).success).toBe(false);
  });

  it("отвергает несуществующее направление", () => {
    expect(GeneratedDirectionSchema.safeParse({ ...valid, directionId: "нет-такого" }).success).toBe(false);
  });

  it("отвергает направление не из своего уровня риска", () => {
    const wrong = { ...valid, tier: "safe", directionId: bold.id };
    expect(GeneratedDirectionSchema.safeParse(wrong).success).toBe(false);
  });

  it("отвергает палитру, которой нет у этого направления", () => {
    const alien = DIRECTIONS.flatMap((d) => d.paletteIds).find((p) => !safe.paletteIds.includes(p));
    expect(alien).toBeDefined();
    expect(GeneratedDirectionSchema.safeParse({ ...valid, paletteId: alien! }).success).toBe(false);
  });

  it("отвергает пару шрифтов, которой нет у этого направления", () => {
    const alien = DIRECTIONS.flatMap((d) => d.fontPairIds).find((f) => !safe.fontPairIds.includes(f));
    expect(alien).toBeDefined();
    expect(GeneratedDirectionSchema.safeParse({ ...valid, fontPairId: alien! }).success).toBe(false);
  });

  it("отвергает пустой список ключевых слов", () => {
    expect(GeneratedDirectionSchema.safeParse({ ...valid, keywords: [] }).success).toBe(false);
  });
});
