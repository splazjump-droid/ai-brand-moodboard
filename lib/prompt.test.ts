import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { GENERATED_FIELDS, KEYWORDS } from "./directions-schema";
import { DIRECTIONS, directionsByTier } from "./catalog";
import { AESTHETIC_CHIPS, CHARACTER_CHIPS } from "./vocab";

const prompt = buildSystemPrompt(DIRECTIONS);

describe("системный промпт", () => {
  it("называет все три уровня риска", () => {
    for (const tier of ["safe", "bold", "experimental"]) expect(prompt).toContain(tier);
  });

  it("границы длины берутся из схемы, а не вписаны руками", () => {
    expect(prompt).toContain(String(GENERATED_FIELDS.concept.max));
    expect(prompt).toContain(String(GENERATED_FIELDS.rationale.min));
  });

  it("границы keywords берутся из схемы, а не вписаны руками", () => {
    expect(prompt).toContain(String(KEYWORDS.min));
    expect(prompt).toContain(String(KEYWORDS.max));
    expect(prompt).toContain(String(KEYWORDS.wordMin));
    expect(prompt).toContain(String(KEYWORDS.wordMax));
  });

  it("перечисляет каждое переданное направление с его палитрами и шрифтами", () => {
    for (const d of DIRECTIONS) {
      expect(prompt, d.id).toContain(d.id);
      expect(prompt, d.id).toContain(d.paletteIds[0]);
      expect(prompt, d.id).toContain(d.fontPairIds[0]);
    }
  });

  it("не перечисляет направления, которых не передавали", () => {
    const only = directionsByTier("safe");
    const narrow = buildSystemPrompt(only);
    const omitted = DIRECTIONS.find((d) => d.tier !== "safe")!;
    expect(narrow).not.toContain(omitted.id);
  });

  it("запрещает длинные тире", () => {
    expect(prompt.toLowerCase()).toContain("тире");
  });
});

describe("сообщение пользователя", () => {
  it("не включает пустые поля", () => {
    const msg = buildUserMessage({ brand: "Кофейня «Зерно»", audience: "" });
    expect(msg).toContain("Кофейня «Зерно»");
    expect(msg).not.toContain("Для кого");
  });

  it("подписывает поля по-русски", () => {
    const msg = buildUserMessage({ brand: "Кофейня «Зерно»", avoid: "без мешковины" });
    expect(msg).toContain("Чего избегать: без мешковины");
  });

  // Чипы работают сужением каталога, в сообщение они не уезжают: id «bold»
  // столкнулся бы с уровнем риска bold из системного промпта.
  it("не уносит идентификаторы чипов в сообщение", () => {
    const msg = buildUserMessage({
      brand: "Кофейня «Зерно»",
      characterChips: CHARACTER_CHIPS.map((c) => c.id),
      characterFree: "по-соседски",
      aestheticChips: AESTHETIC_CHIPS.map((c) => c.id),
    });

    // Свободный текст на месте: сообщение не пустое и проверка не вхолостую.
    expect(msg).toContain("по-соседски");
    for (const chip of [...CHARACTER_CHIPS, ...AESTHETIC_CHIPS]) {
      expect(msg, chip.id).not.toContain(chip.id);
    }
  });
});
