import { describe, it, expect } from "vitest";
import { BriefSchema, BRIEF_FIELDS, stripEmpty } from "./brief-schema";

const valid = { brand: "Обжарочная «Зерно» в Казани, кофе для тех, кто варит дома" };

describe("схема брифа", () => {
  it("принимает бриф с одним заполненным полем", () => {
    expect(BriefSchema.safeParse(valid).success).toBe(true);
  });

  it("отвергает слишком короткое описание бренда", () => {
    expect(BriefSchema.safeParse({ brand: "кофе" }).success).toBe(false);
  });

  it("отвергает бриф без описания бренда", () => {
    expect(BriefSchema.safeParse({ audience: "молодые" }).success).toBe(false);
  });

  it("обрезает по верхней границе только через отказ, а не молча", () => {
    const long = { brand: "я".repeat(BRIEF_FIELDS.brand.max + 1) };
    expect(BriefSchema.safeParse(long).success).toBe(false);
  });
});

describe("stripEmpty", () => {
  it("выкидывает пустые строки и пустые массивы", () => {
    const result = stripEmpty({ ...valid, audience: "", characterChips: [], avoid: "   " });
    expect(result).toEqual(valid);
  });

  it("оставляет заполненные поля нетронутыми", () => {
    const full = { ...valid, audience: "домашние бариста", characterChips: ["warm"] };
    expect(stripEmpty(full)).toEqual(full);
  });

  it("срезает пробелы по краям у выживших строк", () => {
    const result = stripEmpty({ ...valid, audience: "  домашние бариста  " });
    expect(result.audience).toBe("домашние бариста");
  });
});
