import { describe, it, expect } from "vitest";
import { briefFullness } from "./brief-quality";

describe("индикатор полноты брифа", () => {
  it("на пустом брифе даёт нулевую долю", () => {
    expect(briefFullness({}).ratio).toBe(0);
  });

  it("одно короткое поле — уровень thin и подсказка, чего не хватает", () => {
    const r = briefFullness({ brand: "Кофейня в Казани" });
    expect(r.level).toBe("thin");
    expect(r.note).toMatch(/[а-яё]/i);
  });

  it("заполненный бриф даёт уровень rich", () => {
    const r = briefFullness({
      brand: "Обжарочная «Зерно» в Казани. Обжариваем сами, каждую неделю новая партия.",
      audience: "Домашние бариста, покупают зерно раз в две недели",
      characterChips: ["warm", "craft"],
      aestheticChips: ["minimal"],
      avoid: "Без деревенской избы и без мешковины",
    });
    expect(r.level).toBe("rich");
    expect(r.ratio).toBeGreaterThan(0.7);
  });

  // Сторожит Math.min: без него полный бриф даёт 1.0000000000000002.
  it("доля никогда не превышает единицу", () => {
    const r = briefFullness({
      brand: "я".repeat(600),
      audience: "я".repeat(300),
      characterChips: ["a", "b", "c"],
      aestheticChips: ["d", "e"],
      characterFree: "я".repeat(200),
      aestheticFree: "я".repeat(200),
      avoid: "я".repeat(300),
    });
    expect(r.ratio).toBeLessThanOrEqual(1);
  });
});
