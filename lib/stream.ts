// Разбор потока генерации: два независимых чистых шага.
// 1) SSE-протокол апстрима (Polza/OpenAI-совместимый) → куски текста.
// 2) Куски текста, склеенные в построчный JSON → готовые секции лендинга.
// Обе функции принимают накопленный буфер и возвращают то, что удалось
// разобрать целиком, плюс остаток буфера — для следующего вызова.

import { closeJsonBraces } from "./json-repair";

export interface SectionChunk {
  section: string;
  data: unknown;
}

/**
 * Разбирает накопленный буфер строк SSE-протокола, извлекая текстовые
 * куски из delta.content. Строка "data: [DONE]" пропускается как служебная.
 * Незавершённая последняя строка (без перевода строки) возвращается
 * в остатке и не разбирается — она может быть дописана следующим чтением.
 *
 * Отдельно возвращается finish_reason: по нему видно, сама модель
 * закончила ответ или его обрезали. Без этого обрыв на середине выглядел
 * как «контент не прошёл проверку», и причину было негде посмотреть.
 */
export function parseSSEBuffer(buffer: string): {
  chunks: string[];
  remainder: string;
  finishReason: string | null;
} {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const chunks: string[] = [];
  let finishReason: string | null = null;

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload);
      const choice = event?.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        chunks.push(delta);
      }
      if (typeof choice?.finish_reason === "string") {
        finishReason = choice.finish_reason;
      }
    } catch {
      // Недособранный кусок SSE — пропускаем, ждём следующее чтение.
    }
  }

  return { chunks, remainder, finishReason };
}

/**
 * Разбирает одну строку в секцию. Если строка не сложилась в JSON, идёт вторая
 * попытка — с дописанными закрывающими скобками: модель иногда не ставит
 * последнюю (см. lib/json-repair.ts). Не сложилось и так — null, строка молча
 * отбрасывается, как и раньше.
 */
function parseSectionLine(line: string): SectionChunk | null {
  for (const candidate of [line, closeJsonBraces(line)]) {
    if (candidate === null) continue;

    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.section === "string" &&
        "data" in parsed
      ) {
        return { section: parsed.section, data: parsed.data };
      }
    } catch {
      // Строка ещё не собралась в валидный JSON или это мусор — следующая попытка.
    }
  }

  return null;
}

/**
 * Собирает построчный JSON (одна строка — один объект {section, data})
 * в разобранные секции. Пустые и мусорные строки, а также строки,
 * которые ещё не сложились в валидный JSON, молча пропускаются.
 * Незавершённая последняя строка возвращается в остатке.
 */
export function parseSectionBuffer(buffer: string): {
  sections: SectionChunk[];
  remainder: string;
} {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const sections: SectionChunk[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = parseSectionLine(line);
    if (section) sections.push(section);
  }

  return { sections, remainder };
}
