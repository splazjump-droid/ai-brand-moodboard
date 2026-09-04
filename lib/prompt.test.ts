import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { GENERATED_FIELDS } from "./directions-schema";
import { DIRECTIONS, directionsByTier } from "./catalog";

const prompt = buildSystemPrompt(DIRECTIONS);

describe("системный промпт", () => {
  it("называет все три уровня риска", () => {
    for (const tier of ["safe", "bold", "experimental"]) expect(prompt).toContain(tier);
  });

  it("границы длины берутся из схемы, а не вписаны руками", () => {
    expect(prompt).toContain(String(GENERATED_FIELDS.concept.max));
    expect(prompt).toContain(String(GENERATED_FIELDS.rationale.min));
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
    expect(msg).not.toContain("audience");
  });

  it("подписывает поля по-русски", () => {
    const msg = buildUserMessage({ brand: "Кофейня «Зерно»", avoid: "без мешковины" });
    expect(msg).toContain("без мешковины");
  });
});
