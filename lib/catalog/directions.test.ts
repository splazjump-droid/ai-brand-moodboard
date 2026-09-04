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
      expect(d.paletteIds.length, d.id).toBeGreaterThanOrEqual(2);
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

  it("направления с разных уровней не делят больше одной палитры и одной пары шрифтов", () => {
    // В одной генерации берётся по одному направлению на уровень. Если пара
    // с разных уровней делит пул ресурсов, карточки Safe и Bold рискуют
    // отрисоваться одинаковыми — а различать их должна структура, не текст.
    for (const a of DIRECTIONS) {
      for (const b of DIRECTIONS) {
        if (a.tier === b.tier || a.id >= b.id) continue;
        const palettes = a.paletteIds.filter((p) => b.paletteIds.includes(p));
        const fonts = a.fontPairIds.filter((f) => b.fontPairIds.includes(f));
        expect(palettes.length, `${a.id} и ${b.id} делят палитры: ${palettes}`).toBeLessThanOrEqual(1);
        expect(fonts.length, `${a.id} и ${b.id} делят пары шрифтов: ${fonts}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
