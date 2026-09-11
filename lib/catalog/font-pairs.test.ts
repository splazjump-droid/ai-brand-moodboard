import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { FONT_PAIRS } from "./index";

// Каталог Google Fonts живёт вне репозитория: он большой и лицензионно смешанный,
// копировать его сюда нельзя. Зависимость осознанная — проект уже опирается на этот
// снимок как на источник правды по шрифтам, палитрам и типографике (см. CLAUDE.md).
const GOOGLE_FONTS_CSV = join(
  homedir(),
  ".claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/data/google-fonts.csv",
);

/** Читает из каталога карту «семейство → список subsets». */
function readSubsets(): Map<string, string[]> {
  let csv: string;
  try {
    csv = readFileSync(GOOGLE_FONTS_CSV, "utf8");
  } catch (error) {
    throw new Error(
      `Не найден каталог Google Fonts: ${GOOGLE_FONTS_CSV}\n` +
        "Без него проверить кириллицу в шрифтовых парах невозможно, а проверять её на глаз " +
        "уже пробовали — так в каталог попал Plus Jakarta Sans без базового cyrillic. " +
        "Каталог ставится вместе со скиллом ui-ux-pro-max.\n" +
        `Причина: ${(error as Error).message}`,
    );
  }

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const familyAt = header.indexOf("Family");
  const subsetsAt = header.indexOf("Subsets");
  expect(familyAt, `в ${GOOGLE_FONTS_CSV} нет колонки Family`).toBeGreaterThanOrEqual(0);
  expect(subsetsAt, `в ${GOOGLE_FONTS_CSV} нет колонки Subsets`).toBeGreaterThanOrEqual(0);

  const subsets = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    subsets.set(
      cells[familyAt].trim(),
      cells[subsetsAt].split("|").map((s) => s.trim()),
    );
  }
  return subsets;
}

describe("кириллица в шрифтовых парах", () => {
  it("каждое семейство из пары набирает русский текст", () => {
    const subsets = readSubsets();

    for (const pair of FONT_PAIRS) {
      for (const role of ["heading", "body"] as const) {
        const family = pair[role];
        const found = subsets.get(family);
        expect(found, `пара «${pair.id}», ${role}: семейства «${family}» нет в каталоге Google Fonts`).toBeDefined();
        // Ровно "cyrillic" среди значений, а не вхождение подстроки: "cyrillic-ext" —
        // это исторические и малые языки, букв А–Я в нём нет. Проверка по подстроке
        // пропустила бы Plus Jakarta Sans, с которого этот сторож и начался.
        expect(
          found,
          `пара «${pair.id}», ${role}: у семейства «${family}» нет базового subset «cyrillic» ` +
            `(есть только: ${found?.join(", ")}). Русский текст в образце уедет в запасной шрифт, ` +
            "а подпись под ним будет врать. Взять семейство с cyrillic в Subsets.",
        ).toContain("cyrillic");
      }
    }
  });
});
