import type { Brief } from "./brief-schema";

type Level = "thin" | "ok" | "rich";

// Вес каждого сигнала в общей полноте. Описание бренда весит больше
// остального: без него направления вырождаются в общие слова.
const WEIGHTS = { brand: 0.4, audience: 0.2, character: 0.15, aesthetic: 0.15, avoid: 0.1 };

const filled = (v: string | undefined, enough: number) =>
  Math.min((v?.trim().length ?? 0) / enough, 1);

const chosen = (chips: string[] | undefined, free: string | undefined) =>
  chips?.length || free?.trim() ? 1 : 0;

export function briefFullness(brief: Partial<Brief>): {
  ratio: number;
  level: Level;
  note: string;
} {
  const ratio =
    WEIGHTS.brand * filled(brief.brand, 120) +
    WEIGHTS.audience * filled(brief.audience, 60) +
    WEIGHTS.character * chosen(brief.characterChips, brief.characterFree) +
    WEIGHTS.aesthetic * chosen(brief.aestheticChips, brief.aestheticFree) +
    WEIGHTS.avoid * filled(brief.avoid, 40);

  const level: Level = ratio >= 0.7 ? "rich" : ratio >= 0.4 ? "ok" : "thin";

  // Подсказка называет ровно то, чего не хватает больше всего,
  // а не ругает человека за короткий текст вообще.
  let note = "Хватит на три направления";
  if (!brief.brand?.trim()) note = "Начните с описания бренда";
  else if (filled(brief.brand, 120) < 0.5) note = "Расскажите о бренде подробнее";
  else if (!brief.audience?.trim()) note = "Будет точнее, если добавить аудиторию";
  else if (!chosen(brief.characterChips, brief.characterFree)) note = "Выберите характер";
  else if (!chosen(brief.aestheticChips, brief.aestheticFree)) note = "Выберите эстетику";
  else if (!brief.avoid?.trim()) note = "Можно добавить, чего избегать";

  return { ratio: Math.min(ratio, 1), level, note };
}
