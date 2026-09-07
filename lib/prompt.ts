import { GENERATED_FIELDS, KEYWORDS } from "./directions-schema";
import { BRIEF_FIELDS, type Brief } from "./brief-schema";
import { TIERS, type Direction, type Tier } from "./catalog";

// Промпт собирается из схемы и из переданного среза каталога.
// Числа не вписываются руками: иначе текст инструкции разъезжается
// с проверкой ответа, и разъезд ловится только на бою.
const SKELETON = TIERS.map(
  (tier) =>
    `{"section":"direction","data":{"tier":"${tier}","directionId":"...","name":"...","concept":"...",` +
    `"keywords":["..."],"paletteId":"...","fontPairId":"...","rationale":"..."}}`
).join("\n");

const TIER_MEANING: Record<Tier, string> = {
  safe: "проверенное решение, которое точно не подведёт. Узнаваемое, спокойное.",
  bold: "заметное решение с характером. Рискует ради того, чтобы запомниться.",
  experimental: "решение на грани. Может подойти не всем, но задаёт свой язык.",
};

function describe(direction: Direction): string {
  return [
    `- ${direction.id} — ${direction.name}`,
    `  визуальный язык: ${direction.language}`,
    `  ключевые слова: ${direction.keywords.join(", ")}`,
    `  допустимые палитры: ${direction.paletteIds.join(", ")}`,
    `  допустимые пары шрифтов: ${direction.fontPairIds.join(", ")}`,
  ].join("\n");
}

export function buildSystemPrompt(directions: Direction[]): string {
  const catalogue = TIERS.map((tier) => {
    const forTier = directions.filter((d) => d.tier === tier);
    if (forTier.length === 0) return "";
    return `Уровень ${tier} — ${TIER_MEANING[tier]}\n${forTier.map(describe).join("\n")}`;
  })
    .filter(Boolean)
    .join("\n\n");

  return `Ты арт-директор. По брифу о бренде предлагаешь три визуальных направления.

Отвечай СТРОГО построчным JSON: одна строка — один объект, без markdown, без пояснений.
Три строки, ровно в этом порядке:

${SKELETON}

Выбирай ТОЛЬКО из этого каталога. Для каждого уровня риска возьми ровно одно
направление своего уровня. Палитру и пару шрифтов бери из списков выбранного
направления. Идентификаторов вне этих списков не существует, выдумывать их нельзя.

${catalogue}

Правила текста:
— Только русский язык, независимо от языка брифа.
— name — ${GENERATED_FIELDS.name.min}–${GENERATED_FIELDS.name.max} знаков, живое название направления для этого конкретного бренда, а не название стиля из каталога и не ярлык «Вариант 1».
— concept — ${GENERATED_FIELDS.concept.min}–${GENERATED_FIELDS.concept.max} знаков: как направление выглядит и что оно говорит о бренде.
— rationale — ${GENERATED_FIELDS.rationale.min}–${GENERATED_FIELDS.rationale.max} знаков: почему это подходит именно этому бренду и его аудитории.
— keywords — от ${KEYWORDS.min} до ${KEYWORDS.max} слов длиной от ${KEYWORDS.wordMin} до ${KEYWORDS.wordMax} знаков каждое, по-русски, конкретных. «Современно» и «стильно» не годятся.
— Опирайся на то, что человек рассказал. Не придумывай фактов о бренде:
  ни города, ни года основания, ни числа сотрудников, ни цен.
— Если человек указал, чего избегать, — это запрет, а не пожелание.
— НИКАКИХ длинных тире (—). Это первое, по чему читатель узнаёт текст
  нейросети. Ставь точку и начинай новое предложение или обходись запятой.

ЗАПРЕЩЕНЫ обороты: «инновационные решения», «уникальный стиль»,
«индивидуальный подход», «современный и стильный», «динамичный бренд».`;
}

// Чипов здесь нет намеренно: их работа сделана сужением каталога,
// в сообщение они не уезжают. Идентификатор bold — это «дерзкий», а в
// системном промпте bold уже значит уровень риска; модель бы читала
// «Характер: bold» рядом с «bold: заметное решение с характером».
// Поле без подписи в сообщение не попадает вовсе.
const LABELS: Record<string, string> = {
  brand: BRIEF_FIELDS.brand.label,
  audience: BRIEF_FIELDS.audience.label,
  characterFree: BRIEF_FIELDS.characterFree.label,
  aestheticFree: BRIEF_FIELDS.aestheticFree.label,
  avoid: BRIEF_FIELDS.avoid.label,
};

/** Бриф человеку понятным текстом. Поля без подписи и пустые отсекает сама функция. */
export function buildUserMessage(brief: Partial<Brief>): string {
  return Object.entries(brief)
    .filter(([key, value]) => key in LABELS && typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => `${LABELS[key]}: ${value}`)
    .join("\n");
}
