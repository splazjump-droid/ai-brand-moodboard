import { describe, it, expect } from "vitest";
import { STYLES, PALETTES, FONT_PAIRS, findStyle } from "./index";

const BANNED_FONTS = ["Inter", "Roboto", "Arial", "Open Sans", "Lato", "Space Grotesk"];

describe("каталог стилей", () => {
  it("не пустой и у каждого стиля есть id и ключевые слова", () => {
    expect(STYLES.length).toBeGreaterThan(10);
    for (const s of STYLES) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.keywords.length).toBeGreaterThan(0);
    }
  });

  it("id уникальны", () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
  });

  it("findStyle находит по id и молчит на неизвестном", () => {
    expect(findStyle(STYLES[0].id)?.id).toBe(STYLES[0].id);
    expect(findStyle("нет-такого")).toBeUndefined();
  });
});

describe("каталог палитр", () => {
  it("у каждой палитры заполнены все роли цвета", () => {
    expect(PALETTES.length).toBeGreaterThan(10);
    for (const p of PALETTES) {
      for (const role of ["primary", "onPrimary", "accent", "background", "foreground", "border"] as const) {
        expect(p[role]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe("каталог шрифтовых пар", () => {
  it("не содержит запрещённых шрифтов", () => {
    for (const pair of FONT_PAIRS) {
      for (const family of [pair.heading, pair.body]) {
        expect(BANNED_FONTS).not.toContain(family);
      }
    }
  });

  it("заголовок и текст не одно и то же семейство", () => {
    for (const pair of FONT_PAIRS) {
      expect(pair.heading).not.toBe(pair.body);
    }
  });
});
