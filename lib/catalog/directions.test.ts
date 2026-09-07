import { describe, it, expect } from "vitest";
import { DIRECTIONS, TIERS, findDirection, directionsByTier } from "./index";
import { findPalette, findFontPair } from "./index";

describe("каталог направлений", () => {
  it("девять направлений, по три на каждый уровень риска", () => {
    expect(DIRECTIONS).toHaveLength(9);
    for (const tier of TIERS) {
      expect(directionsByTier(tier), tier).toHaveLength(3);
    }
  });

  it("id уникальны и годятся для адреса", () => {
    expect(new Set(DIRECTIONS.map((d) => d.id)).size).toBe(DIRECTIONS.length);
    for (const d of DIRECTIONS) expect(d.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("названия на русском, ключевые слова тоже", () => {
    for (const d of DIRECTIONS) {
      expect(d.name, d.id).toMatch(/[а-яё]/i);
      expect(d.keywords.length, d.id).toBeGreaterThanOrEqual(3);
      for (const k of d.keywords) expect(k, d.id).toMatch(/[а-яё]/i);
    }
  });

  it("описание визуального языка для промпта на английском и непустое", () => {
    for (const d of DIRECTIONS) {
      expect(d.language.length, d.id).toBeGreaterThan(30);
      expect(d.language, d.id).not.toMatch(/[а-яё]/i);
    }
  });

  it("каждое направление называет существующие палитры", () => {
    for (const d of DIRECTIONS) {
      // Меньше трёх — это уже не выбор: модель берёт палитру только из списка.
      expect(d.paletteIds.length, d.id).toBeGreaterThanOrEqual(3);
      for (const id of d.paletteIds) {
        expect(findPalette(id), `${d.id} ссылается на неизвестную палитру ${id}`).toBeDefined();
      }
    }
  });

  it("каждое направление называет существующие пары шрифтов", () => {
    for (const d of DIRECTIONS) {
      expect(d.fontPairIds.length, d.id).toBeGreaterThanOrEqual(2);
      for (const id of d.fontPairIds) {
        expect(findFontPair(id), `${d.id} ссылается на неизвестную пару ${id}`).toBeDefined();
      }
    }
  });

  it("не тянет запрещённые палитры с фиолетовым на белом", () => {
    const banned = ["micro-saas", "mental-health-app", "ai-chatbot-platform", "membership-community"];
    for (const d of DIRECTIONS) {
      for (const id of d.paletteIds) expect(banned, d.id).not.toContain(id);
    }
  });

  it("findDirection находит по id и молчит на неизвестном", () => {
    expect(findDirection(DIRECTIONS[0].id)?.id).toBe(DIRECTIONS[0].id);
    expect(findDirection("нет-такого")).toBeUndefined();
  });

  it("палитра принадлежит ровно одному направлению", () => {
    // Живой прогон 2026-09-07: Safe и Experimental выбрали одну и ту же
    // magazine-blog и отрисовались одинаково. Запрет на пересечение списков
    // этого не ловил — направления делили ровно одну палитру и обе её взяли.
    // Пока палитра числится у двух направлений, совпадение возможно, поэтому
    // проверяется владение, а не размер пересечения.
    const owners = new Map<string, string[]>();
    for (const d of DIRECTIONS) {
      for (const id of d.paletteIds) owners.set(id, [...(owners.get(id) ?? []), d.id]);
    }
    const shared = [...owners].filter(([, ids]) => ids.length > 1);
    expect(
      shared.map(([palette, ids]) => `${palette} у ${ids.join(", ")}`),
      "палитру делят несколько направлений",
    ).toEqual([]);
  });

  it("направления с разных уровней не делят больше одной пары шрифтов", () => {
    // В одной генерации берётся по одному направлению на уровень. Общий пул
    // шрифтов у пары с разных уровней сближает карточки Safe и Bold, а
    // различать их должна структура, не текст.
    for (const a of DIRECTIONS) {
      for (const b of DIRECTIONS) {
        if (a.tier === b.tier || a.id >= b.id) continue;
        const fonts = a.fontPairIds.filter((f) => b.fontPairIds.includes(f));
        expect(fonts.length, `${a.id} и ${b.id} делят пары шрифтов: ${fonts}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
