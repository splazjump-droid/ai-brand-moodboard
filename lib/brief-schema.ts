import { z } from "zod";

// Границы длины живут здесь и только здесь: из них собирается промпт
// и по ним валидируется вход. Иначе промпт разъезжается со схемой.
export const BRIEF_FIELDS = {
  brand: { min: 10, max: 600, label: "Что за бренд" },
  audience: { min: 0, max: 300, label: "Для кого" },
  characterFree: { min: 0, max: 200, label: "Характер, своими словами" },
  aestheticFree: { min: 0, max: 200, label: "Эстетика, своими словами" },
  avoid: { min: 0, max: 300, label: "Чего избегать" },
} as const;

export const BriefSchema = z.object({
  brand: z.string().min(BRIEF_FIELDS.brand.min).max(BRIEF_FIELDS.brand.max),
  audience: z.string().max(BRIEF_FIELDS.audience.max).optional(),
  characterChips: z.array(z.string()).max(8).optional(),
  characterFree: z.string().max(BRIEF_FIELDS.characterFree.max).optional(),
  aestheticChips: z.array(z.string()).max(8).optional(),
  aestheticFree: z.string().max(BRIEF_FIELDS.aestheticFree.max).optional(),
  avoid: z.string().max(BRIEF_FIELDS.avoid.max).optional(),
});

export type Brief = z.infer<typeof BriefSchema>;

/**
 * Убирает пустые поля. Модель не должна видеть "audience": "" —
 * из пустой строки она делает выводы, которых человек не давал.
 */
export function stripEmpty(brief: Partial<Brief>): Partial<Brief> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(brief)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    else if (Array.isArray(value) && value.length) out[key] = value;
  }
  return out as Partial<Brief>;
}
