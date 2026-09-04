import { describe, it, expect } from "vitest";
import { parseSSEBuffer, parseSectionBuffer } from "./stream";

// В vyveska это импортировалось из lib/content-schema.ts (схема секций
// лендинга). В этом проекте такой схемы нет и не будет — parseSectionBuffer
// не завязан на конкретные имена секций, ниже те же значения фикстурой.
const SECTION_ORDER = [
  "brand",
  "hero",
  "about",
  "services",
  "proof",
  "cta",
] as const;

describe("parseSSEBuffer", () => {
  it("склеивает кусок, пришедший разорванным на границе чтения", () => {
    // Сеть оборвала данные посреди строки data: — переноса строки ещё нет.
    const first = parseSSEBuffer(
      'data: {"choices":[{"delta":{"content":"Приве'
    );
    expect(first.chunks).toEqual([]);
    expect(first.remainder).toBe(
      'data: {"choices":[{"delta":{"content":"Приве'
    );

    // Следующее чтение дописывает остаток строки и закрывает её переводом строки.
    const second = parseSSEBuffer(first.remainder + 'т"}}]}\n');
    expect(second.chunks).toEqual(["Привет"]);
    expect(second.remainder).toBe("");
  });

  it("пропускает служебную строку завершения потока", () => {
    const result = parseSSEBuffer(
      'data: {"choices":[{"delta":{"content":"текст"}}]}\ndata: [DONE]\n'
    );
    expect(result.chunks).toEqual(["текст"]);
    expect(result.remainder).toBe("");
  });

  it("не падает на мусорной и пустой строке между валидными", () => {
    const result = parseSSEBuffer(
      'data: {"choices":[{"delta":{"content":"А"}}]}\n\nне JSON вообще\ndata: {"choices":[{"delta":{"content":"Б"}}]}\n'
    );
    expect(result.chunks).toEqual(["А", "Б"]);
  });
  it("забирает finish_reason из события", () => {
    const buffer =
      'data: {"choices":[{"delta":{"content":"текст"},"finish_reason":null}]}\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n';
    expect(parseSSEBuffer(buffer).finishReason).toBe("stop");
  });

  it("сообщает об обрыве по длине ответа", () => {
    const buffer = 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n';
    expect(parseSSEBuffer(buffer).finishReason).toBe("length");
  });

  it("без причины завершения возвращает null", () => {
    const buffer = 'data: {"choices":[{"delta":{"content":"кусок"}}]}\n';
    expect(parseSSEBuffer(buffer).finishReason).toBeNull();
  });
});

describe("parseSectionBuffer", () => {
  it("склеивает JSON-строку, пришедшую разорванной на границе чтения", () => {
    const first = parseSectionBuffer(
      '{"section":"hero","data":{"headline":"При'
    );
    expect(first.sections).toEqual([]);
    expect(first.remainder).toBe(
      '{"section":"hero","data":{"headline":"При'
    );

    const second = parseSectionBuffer(first.remainder + 'вет"}}\n');
    expect(second.sections).toEqual([
      { section: "hero", data: { headline: "Привет" } },
    ]);
    expect(second.remainder).toBe("");
  });

  it("игнорирует строку, уже завершённую переводом строки, но не собравшуюся в валидный JSON", () => {
    const result = parseSectionBuffer(
      '{"section":"hero","data":{"headline":"Обрыв\n{"section":"cta","data":{"headline":"Готово","button":"Жми"}}\n'
    );
    expect(result.sections).toEqual([
      { section: "cta", data: { headline: "Готово", button: "Жми" } },
    ]);
  });

  it("разбирает все шесть секций в правильном порядке", () => {
    const lines = [
      '{"section":"brand","data":{"name":"Тест","tagline":"Пример"}}',
      '{"section":"hero","data":{"headline":"Заголовок","sub":"Подзаголовок","cta":"Кнопка"}}',
      '{"section":"about","data":{"title":"О деле","text":"Текст"}}',
      '{"section":"services","data":[{"title":"А","text":"1"},{"title":"Б","text":"2"},{"title":"В","text":"3"}]}',
      '{"section":"proof","data":{"quote":"Отзыв","author":"Клиент"}}',
      '{"section":"cta","data":{"headline":"Финал","button":"Жми"}}',
    ];
    const result = parseSectionBuffer(lines.join("\n") + "\n");

    expect(result.sections.map((s) => s.section)).toEqual([...SECTION_ORDER]);
    expect(result.sections[3].data).toEqual([
      { title: "А", text: "1" },
      { title: "Б", text: "2" },
      { title: "В", text: "3" },
    ]);
    expect(result.remainder).toBe("");
  });

  it("устойчив к пустым строкам и мусору между валидными строками", () => {
    const buffer =
      '\n{"section":"brand","data":{"name":"Тест"}}\n\nмусор без JSON\n{"section":"hero","data":{"headline":"X"}}\n';
    const result = parseSectionBuffer(buffer);

    expect(result.sections).toEqual([
      { section: "brand", data: { name: "Тест" } },
      { section: "hero", data: { headline: "X" } },
    ]);
  });

  it("последняя строка без перевода строки уходит в остаток, а не теряется", () => {
    const { sections, remainder } = parseSectionBuffer('{"section":"a","data":1}\n{"section":"b","data":2}');
    expect(sections).toHaveLength(1);
    expect(remainder).toBe('{"section":"b","data":2}');

    const tail = parseSectionBuffer(`${remainder}\n`);
    expect(tail.sections).toHaveLength(1);
    expect(tail.sections[0].section).toBe("b");
  });
});

describe("parseSSEBuffer + parseSectionBuffer (сквозной сценарий)", () => {
  it("собирают все шесть секций из потока, разорванного на границах чтения и с мусором", () => {
    const sectionLines = [
      '{"section":"brand","data":{"name":"Тест","tagline":"Пример"}}',
      '{"section":"hero","data":{"headline":"Заголовок","sub":"Подзаголовок","cta":"Кнопка"}}',
      '{"section":"about","data":{"title":"О деле","text":"Текст"}}',
      '{"section":"services","data":[{"title":"А","text":"1"},{"title":"Б","text":"2"},{"title":"В","text":"3"}]}',
      '{"section":"proof","data":{"quote":"Отзыв","author":"Клиент"}}',
      '{"section":"cta","data":{"headline":"Финал","button":"Жми"}}',
    ];

    // Каждая строка секции приходит отдельным SSE-событием. Между событиями
    // затесались строки-комментарии (keep-alive пинги), которые обработчик
    // должен молча игнорировать, а не спотыкаться о них.
    const sse =
      sectionLines
        .map(
          (line) =>
            `: keep-alive\ndata: ${JSON.stringify({
              choices: [{ delta: { content: `${line}\n` } }],
            })}\n`
        )
        .join("") + "data: [DONE]\n";

    // Рвём поток на куски произвольного размера — в том числе посреди
    // строки SSE и посреди JSON-строки секции, как это бывает на границе
    // сетевых чтений.
    const chunkSizes = [7, 13, 1, 40, 5, 90, 2, 200, 3];
    const reads: string[] = [];
    let pos = 0;
    let i = 0;
    while (pos < sse.length) {
      const size = chunkSizes[i % chunkSizes.length];
      reads.push(sse.slice(pos, pos + size));
      pos += size;
      i++;
    }

    let sseBuffer = "";
    let textBuffer = "";
    const collected: { section: string; data: unknown }[] = [];

    for (const read of reads) {
      sseBuffer += read;
      const sseResult = parseSSEBuffer(sseBuffer);
      sseBuffer = sseResult.remainder;

      textBuffer += sseResult.chunks.join("");
      const sectionResult = parseSectionBuffer(textBuffer);
      textBuffer = sectionResult.remainder;

      collected.push(...sectionResult.sections);
    }

    expect(collected.map((s) => s.section)).toEqual([...SECTION_ORDER]);
    expect(collected[3].data).toEqual([
      { title: "А", text: "1" },
      { title: "Б", text: "2" },
      { title: "В", text: "3" },
    ]);
  });
});
