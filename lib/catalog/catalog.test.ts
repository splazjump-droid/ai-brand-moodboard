import { describe, it, expect } from "vitest";
import { PALETTES, FONT_PAIRS } from "./index";

const BANNED_FONTS = ["Inter", "Roboto", "Arial", "Open Sans", "Lato", "Space Grotesk"];

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
