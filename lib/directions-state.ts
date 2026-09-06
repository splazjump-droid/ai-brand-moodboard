import { GeneratedDirectionSchema, type GeneratedDirection } from "./directions-schema";
import { TIERS } from "./catalog";
import type { SectionChunk } from "./stream";

/**
 * Применяет разобранные куски потока к уже накопленным направлениям.
 * Кусок, не прошедший схему, молча отбрасывается: это защита от мусора
 * в потоке, а не рабочий сценарий. Повтор того же ключа перезаписывает
 * прежнее значение — последняя строка в потоке побеждает.
 */
export function accumulate(
  current: GeneratedDirection[],
  chunks: SectionChunk[]
): GeneratedDirection[] {
  const byTier = new Map(current.map((d) => [d.tier, d]));

  for (const { section, data } of chunks) {
    if (section !== "direction") continue;
    const parsed = GeneratedDirectionSchema.safeParse(data);
    if (parsed.success) byTier.set(parsed.data.tier, parsed.data);
  }

  // Порядок задаём мы, а не апстрим: карточки не должны прыгать местами
  // от того, в каком порядке модель их дописала.
  return TIERS.map((tier) => byTier.get(tier)).filter(
    (d): d is GeneratedDirection => d !== undefined
  );
}

/** Готово, когда пришли все три направления. */
export function isComplete(directions: GeneratedDirection[]): boolean {
  return directions.length === TIERS.length;
}
