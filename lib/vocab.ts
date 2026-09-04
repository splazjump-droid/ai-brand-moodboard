import { DIRECTIONS, type Direction } from "./catalog";

export interface Chip {
  id: string;
  label: string;
  /** Направления каталога, которые это слово означает. */
  directionIds: string[];
}

// Связка «бытовое слово → направления» живёт здесь, а не в голове модели.
// Модель получает отобранные направления, а не слово «дерзкий».
export const CHARACTER_CHIPS: Chip[] = [
  { id: "strict", label: "строгий", directionIds: ["swiss", "editorial", "bauhaus"] },
  { id: "warm", label: "тёплый", directionIds: ["midcentury", "editorial", "collage"] },
  { id: "bold", label: "дерзкий", directionIds: ["neo-brutal", "bauhaus", "memphis"] },
  { id: "technical", label: "техничный", directionIds: ["retro-futur", "y2k", "swiss"] },
  { id: "playful", label: "игривый", directionIds: ["memphis", "y2k", "collage"] },
  { id: "premium", label: "премиальный", directionIds: ["editorial", "midcentury", "swiss"] },
];

export const AESTHETIC_CHIPS: Chip[] = [
  { id: "minimal", label: "минимализм", directionIds: ["swiss", "bauhaus", "editorial"] },
  { id: "magazine", label: "журнальная вёрстка", directionIds: ["editorial", "collage", "midcentury"] },
  { id: "retro", label: "ретро", directionIds: ["midcentury", "retro-futur", "y2k"] },
  { id: "geometric", label: "геометрия", directionIds: ["bauhaus", "swiss", "memphis"] },
  { id: "maximal", label: "максимализм", directionIds: ["collage", "memphis", "y2k"] },
  { id: "futuristic", label: "футуризм", directionIds: ["retro-futur", "y2k", "neo-brutal"] },
];

const BY_ID = new Map([...CHARACTER_CHIPS, ...AESTHETIC_CHIPS].map((c) => [c.id, c]));

/** Направления для выбранных чипов, без повторов, в порядке каталога. */
export function directionsForChips(chipIds: string[]): Direction[] {
  const ids = new Set<string>();
  for (const chipId of chipIds) {
    for (const directionId of BY_ID.get(chipId)?.directionIds ?? []) ids.add(directionId);
  }
  return DIRECTIONS.filter((d) => ids.has(d.id));
}
