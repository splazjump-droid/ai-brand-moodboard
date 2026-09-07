import { z } from "zod";

import { isChipId } from "./vocab";

// Границы длины текстовых полей живут здесь и только здесь: из них
// собирается промпт и по ним валидируется вход. Иначе промпт разъезжается
// со схемой.
export const BRIEF_FIELDS = {
  brand: { min: 10, max: 600, label: "Что за бренд" },
  audience: { min: 0, max: 300, label: "Для кого" },
  characterFree: { min: 0, max: 200, label: "Характер, своими словами" },
  aestheticFree: { min: 0, max: 200, label: "Эстетика, своими словами" },
  avoid: { min: 0, max: 300, label: "Чего избегать" },
} as const;

/**
 * Больше восьми чипов на группу человек не выберет осмысленно, а лишние
 * только размывают запрос к модели. Ограничение на количество, а не на
 * длину, поэтому живёт отдельно от BRIEF_FIELDS: тот описывает границы
 * длины текстовых полей и целиком уходит в текст промпта.
 */
export const MAX_CHIPS = 8;

/**
 * Чипы приходят из закрытого словаря, произвольных значений в них не
 * бывает. Проверяем по словарю, а не по длине строки: иначе запрос мимо
 * формы уносит в тело запроса к модели восемь строк любого размера —
 * и токены, и подмешанные инструкции.
 */
const chipIds = z.array(z.string().refine(isChipId)).max(MAX_CHIPS).optional();

export const BriefSchema = z.object({
  // trim до проверки длины: триста пробелов и слово «кофе» иначе проходят
  // min и уезжают в промпт четырьмя знаками.
  brand: z.string().trim().min(BRIEF_FIELDS.brand.min).max(BRIEF_FIELDS.brand.max),
  audience: z.string().max(BRIEF_FIELDS.audience.max).optional(),
  characterChips: chipIds,
  characterFree: z.string().max(BRIEF_FIELDS.characterFree.max).optional(),
  aestheticChips: chipIds,
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
