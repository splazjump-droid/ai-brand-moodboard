import { z } from "zod";
import { TIERS, findDirection } from "./catalog";

// Границы длины, из которых собирается промпт. Один источник правды
// на текст инструкции и на проверку ответа.
export const GENERATED_FIELDS = {
  name: { min: 3, max: 40 },
  concept: { min: 80, max: 400 },
  rationale: { min: 40, max: 300 },
} as const;

/**
 * Ключевые слова описываются двумя разными мерами: сколько их и какой
 * длины каждое. В GENERATED_FIELDS не помещаются — там границы длины
 * текстовых полей в знаках. Но источник всё равно должен быть один:
 * схема проверяет по этим числам, промпт из них же собирает инструкцию.
 */
export const KEYWORDS = { min: 3, max: 6, wordMin: 2, wordMax: 30 } as const;

// Идентификаторы проверяются по каталогу, а не по формату строки:
// модель охотно выдумывает правдоподобные id, которых не существует.
// Палитра и пара шрифтов проверяются не по всему каталогу, а по спискам
// выбранного направления — иначе к «Швейцарской школе» приедет неоновая
// палитра, формально существующая.
export const GeneratedDirectionSchema = z
  .object({
    tier: z.enum(TIERS),
    directionId: z.string(),
    name: z.string().min(GENERATED_FIELDS.name.min).max(GENERATED_FIELDS.name.max),
    concept: z.string().min(GENERATED_FIELDS.concept.min).max(GENERATED_FIELDS.concept.max),
    keywords: z
      .array(z.string().min(KEYWORDS.wordMin).max(KEYWORDS.wordMax))
      .min(KEYWORDS.min)
      .max(KEYWORDS.max),
    paletteId: z.string(),
    fontPairId: z.string(),
    rationale: z
      .string()
      .min(GENERATED_FIELDS.rationale.min)
      .max(GENERATED_FIELDS.rationale.max),
  })
  .superRefine((value, ctx) => {
    const direction = findDirection(value.directionId);

    if (!direction) {
      ctx.addIssue({
        code: "custom",
        path: ["directionId"],
        message: "неизвестное направление",
      });
      return;
    }

    if (direction.tier !== value.tier) {
      ctx.addIssue({
        code: "custom",
        path: ["directionId"],
        message: `направление ${direction.id} относится к уровню ${direction.tier}, а не ${value.tier}`,
      });
    }

    if (!direction.paletteIds.includes(value.paletteId)) {
      ctx.addIssue({
        code: "custom",
        path: ["paletteId"],
        message: `палитра ${value.paletteId} не предусмотрена направлением ${direction.id}`,
      });
    }

    if (!direction.fontPairIds.includes(value.fontPairId)) {
      ctx.addIssue({
        code: "custom",
        path: ["fontPairId"],
        message: `пара шрифтов ${value.fontPairId} не предусмотрена направлением ${direction.id}`,
      });
    }
  });

export type GeneratedDirection = z.infer<typeof GeneratedDirectionSchema>;
