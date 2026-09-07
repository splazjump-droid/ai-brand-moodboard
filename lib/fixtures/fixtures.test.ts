import { describe, it, expect } from "vitest";
import { SHOWCASES, findShowcase } from "./index";
import { GeneratedDirectionSchema } from "@/lib/directions-schema";
import { BriefSchema } from "@/lib/brief-schema";
import { TIERS } from "@/lib/catalog";

describe("фикстуры витрины", () => {
  it("их не меньше трёх", () => {
    expect(SHOWCASES.length).toBeGreaterThanOrEqual(3);
  });

  it("slug уникальны и годятся для адреса", () => {
    expect(new Set(SHOWCASES.map((s) => s.slug)).size).toBe(SHOWCASES.length);
    for (const s of SHOWCASES) expect(s.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("бриф каждой фикстуры проходит схему брифа", () => {
    for (const s of SHOWCASES) {
      expect(BriefSchema.safeParse(s.brief).success, s.slug).toBe(true);
    }
  });

  it("все три направления каждой фикстуры проходят схему", () => {
    for (const s of SHOWCASES) {
      expect(s.directions).toHaveLength(3);
      for (const d of s.directions) {
        expect(GeneratedDirectionSchema.safeParse(d).success, `${s.slug}/${d.tier}`).toBe(true);
      }
    }
  });

  // Обещание продукта: три направления это Safe, Bold и Experimental, а не
  // три осторожных варианта. Схема каждое направление проверяет поодиночке
  // и такой набор пропустит, поэтому уровни сверяются здесь.
  it("уровни трёх направлений покрывают safe, bold и experimental", () => {
    for (const s of SHOWCASES) {
      expect(s.directions.map((d) => d.tier), s.slug).toEqual([...TIERS]);
    }
  });

  it("направления внутри фикстуры не повторяют палитру", () => {
    for (const s of SHOWCASES) {
      const ids = s.directions.map((d) => d.paletteId);
      expect(new Set(ids).size, s.slug).toBe(ids.length);
    }
  });

  it("findShowcase находит каждую фикстуру по её slug", () => {
    for (const s of SHOWCASES) {
      expect(findShowcase(s.slug)).toBe(s);
    }
  });

  it("findShowcase молчит на неизвестном slug", () => {
    expect(findShowcase("нет-такого")).toBeUndefined();
  });
});
