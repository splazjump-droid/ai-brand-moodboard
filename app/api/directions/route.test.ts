import { describe, it, expect, vi, beforeEach } from "vitest";

// Очередь значений incr на тест про лимит. Пусто — счётчик отдаёт 1,
// как и раньше: остальные тесты про лимит ничего не знают.
const incrQueue = vi.hoisted(() => [] as number[]);

vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(async () => incrQueue.shift() ?? 1),
    expire: vi.fn().mockResolvedValue(1),
  },
  DAY_SECONDS: 86400,
}));

const post = async (body: unknown) => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/directions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
};

/**
 * Поток апстрима с тремя направлениями. Последний кадр SSE не закрыт
 * переводом строки, и внутри него последняя строка построчного JSON —
 * тоже: ровно так обрывается настоящий ответ. Оба хвоста должны быть
 * дочитаны после цикла, иначе третье направление теряется.
 */
function sseStream(): ReadableStream<Uint8Array> {
  const frame = (content: string) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;

  const body =
    `${frame('{"section":"direction","data":{"id":"safe"}}\n')}\n\n` +
    `${frame('{"section":"direction","data":{"id":"bold"}}\n')}\n\n` +
    // Ни "\n\n" после кадра, ни "\n" после самого JSON.
    frame('{"section":"direction","data":{"id":"experimental"}}');

  const encoder = new TextEncoder();
  // Режем на куски мимо границ строк — так же, как приходит из сети.
  const parts = [body.slice(0, 40), body.slice(40, 150), body.slice(150)];

  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function readSections(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as { section: string; data: unknown });
}

beforeEach(() => {
  incrQueue.length = 0;
  process.env.APP_SALT = "тестовая-соль";
  process.env.POLZA_API_KEY = "тестовый-ключ";
  vi.resetModules();
  // Сеть закрыта по умолчанию: если проверка выше по файлу сломается,
  // тест упадёт здесь, а не уйдёт живым запросом на polza.ai с ключом
  // из окружения.
  global.fetch = vi.fn(() => {
    throw new Error("fetch в тестах запрещён");
  });
});

describe("POST /api/directions", () => {
  it("на нечитаемом теле отвечает 400 и текстом по-русски", async () => {
    const res = await post("не json");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/[а-яё]/i);
  });

  it("на теле-массиве отвечает 400, а не падает", async () => {
    const res = await post([1, 2, 3]);
    expect(res.status).toBe(400);
  });

  it("на теле-null отвечает 400, а не падает", async () => {
    const res = await post(null);
    expect(res.status).toBe(400);
  });

  it("на слишком коротком описании бренда отвечает 400", async () => {
    const res = await post({ brand: "кофе" });
    expect(res.status).toBe(400);
  });

  it("без APP_SALT отвечает 500, а не считает хеш по undefined", async () => {
    delete process.env.APP_SALT;
    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(500);
  });

  it("без POLZA_API_KEY отвечает 500, а не шлёт запрос без ключа", async () => {
    delete process.env.POLZA_API_KEY;
    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(500);
  });

  it("пропускает два прохода в сутки, а третьему отвечает 429", async () => {
    // incr считает вместе с текущим запросом, DAILY_LIMIT равен двум.
    incrQueue.push(1, 2, 3);
    const brief = { brand: "уютная кофейня в центре города" };

    // Лимит пропустил — значит дошли до вызова апстрима, а там стоит
    // запрещающий global.fetch: наружу запрос не уходит, но и 429 не
    // возвращается. Ровно это и надо доказать про первые два прохода.
    await expect(post(brief)).rejects.toThrow("fetch в тестах запрещён");
    await expect(post(brief)).rejects.toThrow("fetch в тестах запрещён");

    const third = await post(brief);
    expect(third.status).toBe(429);
  });

  it("дочитывает хвост: поток без завершающего перевода строки отдаёт все три направления", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseStream(), { status: 200, headers: { "content-type": "text/event-stream" } })
    );

    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(200);

    const sections = await readSections(res);
    expect(sections.map((s) => (s.data as { id: string }).id)).toEqual([
      "safe",
      "bold",
      "experimental",
    ]);
  });
});
