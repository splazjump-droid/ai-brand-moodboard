import { describe, it, expect } from "vitest";
import { DIRECTIONS, TIERS, findDirection, directionsByTier } from "./index";
import { findPalette, findFontPair } from "./index";
import type { Palette } from "./index";

/** Оттенок, насыщенность и светлота из hex. Порог слопа задан в этих числах. */
function hsl(hex: string): { hue: number; saturation: number; lightness: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const span = max - min;
  if (span === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = span / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r
      ? ((g - b) / span) % 6
      : max === g
        ? (b - r) / span + 2
        : (r - g) / span + 4;
  return { hue: ((hue * 60) % 360 + 360) % 360, saturation, lightness };
}

/** Кратчайшее расстояние между оттенками по кругу. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * Фиолетовое на белом — маркер AI-слопа номер один, правилами проекта
 * запрещён. Признак считается из цветов, а не из имени палитры: насыщенный
 * пурпур или розовый на почти белом фоне, и при этом акцент рядом по
 * оттенку, то есть второго цвета в палитре нет. Мемфис держится на розовом
 * с далёким акцентом и под правило не попадает намеренно: слоп — это
 * пастельная монохромия, а не яркий цвет как таковой.
 */
function isSlop(p: Palette): boolean {
  const primary = hsl(p.primary);
  const accent = hsl(p.accent);
  const background = hsl(p.background);
  return (
    primary.hue >= 260 &&
    primary.hue <= 340 &&
    primary.saturation > 0.35 &&
    background.lightness > 0.88 &&
    hueGap(primary.hue, accent.hue) < 120
  );
}

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

  it("не тянет палитры с фиолетовым на белом", () => {
    // Живой прогон 2026-09-10: карточка Experimental вышла на
    // subscription-box-service — #D946EF на #FDF4FF, ровно тот AI-слоп,
    // что запрещён правилами проекта. Тест был зелёным, потому что держал
    // чёрный список из четырёх имён, а палитр в обороте тридцать. Список
    // имён проверяет знакомство с четырьмя палитрами, а не цвет на экране;
    // правило считается из самих цветов и ловит любую, включая будущие.
    const slop: string[] = [];
    for (const d of DIRECTIONS) {
      for (const id of d.paletteIds) {
        const palette = findPalette(id);
        if (!palette) continue; // несуществующие ловит соседний тест
        if (isSlop(palette)) {
          slop.push(
            `${id} (направление ${d.id}) — ${palette.primary} на ${palette.background}: ` +
              `насыщенный пурпур на почти белом без второго цвета. Заменить.`,
          );
        }
      }
    }
    expect(slop, "на экране окажется фиолетовое на белом").toEqual([]);
  });

  it("направления с разных уровней не делят акцентный цвет", () => {
    // Живой прогон 2026-09-10: Safe и Experimental получили один и тот же
    // #EA580C. Палитры разные целиком, а глаз видит акцент — самый яркий
    // цвет карточки. Проверять состав целиком мало: совпадения хватает в
    // одном поле. Внутри уровня совпадение безвредно, в проход уходит одно
    // направление с уровня.
    const owners = new Map<string, Map<string, string>>();
    for (const d of DIRECTIONS) {
      for (const id of d.paletteIds) {
        const palette = findPalette(id);
        if (!palette) continue;
        const accent = palette.accent.toUpperCase();
        if (!owners.has(accent)) owners.set(accent, new Map());
        owners.get(accent)!.set(d.tier, d.id);
      }
    }
    const clashes: string[] = [];
    for (const [accent, byTier] of owners) {
      if (byTier.size > 1) {
        const who = [...byTier].map(([tier, id]) => `${id} (${tier})`).join(", ");
        clashes.push(`${accent}: ${who} — две карточки одного прохода выйдут с одним акцентом.`);
      }
    }
    expect(clashes, "карточки одного прохода делят акцент").toEqual([]);
  });

  it("findDirection находит по id и молчит на неизвестном", () => {
    expect(findDirection(DIRECTIONS[0].id)?.id).toBe(DIRECTIONS[0].id);
    expect(findDirection("нет-такого")).toBeUndefined();
  });

  it("двум направлениям не достаётся один и тот же набор цветов", () => {
    // Живой прогон 2026-09-07: Safe и Experimental выбрали одну и ту же
    // magazine-blog и отрисовались одинаково. Сравнивается цветовой состав,
    // а не id: в palettes.json 23 группы палитр-близнецов — разные id и
    // названия, но все цветовые поля совпадают байт в байт (creative-agency
    // и marketing-agency, например). Проверка владения по идентификатору
    // таких не видит: направления берут разные строки, а карточки выходят
    // пиксель в пиксель одинаковыми.
    const swatch = (p: Palette) =>
      [
        p.primary,
        p.onPrimary,
        p.accent,
        p.onAccent,
        p.background,
        p.foreground,
        p.muted,
        p.mutedForeground,
        p.border,
      ]
        .map((c) => c.toUpperCase())
        .join(" ");

    const seen = new Map<string, { direction: string; palette: string }>();
    const clashes: string[] = [];
    for (const d of DIRECTIONS) {
      for (const id of d.paletteIds) {
        const palette = findPalette(id);
        if (!palette) continue; // несуществующие ловит соседний тест
        const colors = swatch(palette);
        const first = seen.get(colors);
        if (first) {
          clashes.push(
            `${first.palette} (направление ${first.direction}) и ${id} (направление ${d.id}) — ` +
              `совпадают все цвета: ${colors}. Убрать одну из двух и добрать свободную.`,
          );
        } else {
          seen.set(colors, { direction: d.id, palette: id });
        }
      }
    }
    expect(clashes, "два направления отрисуются в одинаковых цветах").toEqual([]);
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
