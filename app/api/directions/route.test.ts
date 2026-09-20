import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { zerno } from "@/lib/fixtures/zerno";

// Очередь значений incr на тест про лимит. Пусто — счётчик отдаёт 1,
// как и раньше: остальные тесты про лимит ничего не знают.
const incrQueue = vi.hoisted(() => [] as number[]);

// Отказ хранилища включается флагом, а не подменой мока в тесте: мок
// живёт вне модульного графа, который сбрасывает resetModules, и ссылка
// на него из теста после сброса указывала бы на прежний экземпляр.
const incrFails = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(async () => {
      if (incrFails.value) throw new Error("хранилище недоступно");
      return incrQueue.shift() ?? 1;
    }),
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
 *
 * Данные берём из фикстуры витрины: они проходят GeneratedDirectionSchema,
 * а маршруту теперь важно отличать прошедшее схему от просто пришедшего.
 */
function sseStream(directions: unknown[] = zerno.directions): ReadableStream<Uint8Array> {
  const frame = (content: string) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;

  const lines = directions.map((data) => JSON.stringify({ section: "direction", data }));

  const body =
    `${frame(`${lines[0]}\n`)}\n\n` +
    `${frame(`${lines[1]}\n`)}\n\n` +
    // Ни "\n\n" после кадра, ни "\n" после самого JSON.
    frame(lines[2]);

  const encoder = new TextEncoder();
  // Режем на куски мимо границ строк — так же, как приходит из сети.
  const third = Math.ceil(body.length / 3);
  const parts = [body.slice(0, third), body.slice(third, third * 2), body.slice(third * 2)];

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

/**
 * Поток из готовых строк, как их отдаёт апстрим. В отличие от sseStream
 * ничего не сериализует: строки уходят как есть, поэтому ими можно подать
 * заведомо сломанный JSON — ровно то, чем модель ломает разбор на бою.
 */
function rawStream(lines: string[]): ReadableStream<Uint8Array> {
  const frame = (content: string) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
  const body = lines.map((l, i) => frame(i === lines.length - 1 ? l : `${l}\n`)).join("\n\n");
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
}

beforeEach(() => {
  incrQueue.length = 0;
  incrFails.value = false;
  process.env.APP_SALT = "тестовая-соль";
  process.env.POLZA_API_KEY = "тестовый-ключ";
  // Хранилище лимита считается настроенным по умолчанию: мок redis выше
  // изображает работающий Upstash, и без этих переменных маршрут решил бы,
  // что лимита нет вовсе, и написал бы об этом в лог во всех тестах.
  vi.stubEnv("KV_REST_API_URL", "https://пример.upstash.io");
  vi.stubEnv("KV_REST_API_TOKEN", "тестовый-токен");
  vi.resetModules();
  // Сеть закрыта по умолчанию: если проверка выше по файлу сломается,
  // тест упадёт здесь, а не уйдёт живым запросом на polza.ai с ключом
  // из окружения.
  global.fetch = vi.fn(() => {
    throw new Error("fetch в тестах запрещён");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it("на чипе не из словаря отвечает 400, а не уносит строку в промпт", async () => {
    const res = await post({
      brand: "уютная кофейня в центре города",
      characterChips: ["я".repeat(5000)],
    });
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
    // запрещающий global.fetch: наружу запрос не уходит, маршрут отвечает
    // 502. Важно, что не 429: первые два прохода лимит пропускает.
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(brief)).status).toBe(502);
    expect((await post(brief)).status).toBe(502);

    const third = await post(brief);
    expect(third.status).toBe(429);
  });

  it("на отказ хранилища отвечает 503 и модель не зовёт", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    incrFails.value = true;

    const res = await post({ brand: "уютная кофейня в центре города" });

    expect(res.status).toBe(503);
    // Код ответа здесь второстепенен. Главное — несделанный запрос:
    // раньше сломанное хранилище пропускало проход, и каждый такой проход
    // это живые деньги владельца ключа при снятой защите.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("проход запрещён"));
  });

  it("без настроенного хранилища на боевом режиме отвечает 500 и модель не зовёт", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Переменные забыли завести на Vercel — самый вероятный способ
    // выкатить публичную демку вообще без лимита.
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");

    const res = await post({ brand: "уютная кофейня в центре города" });

    expect(res.status).toBe(500);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("генерация запрещена"));
  });

  it("без настроенного хранилища в разработке генерация идёт, но лог кричит", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    global.fetch = vi.fn().mockResolvedValue(new Response(sseStream(), { status: 200 }));

    const res = await post({ brand: "уютная кофейня в центре города" });

    expect(res.status).toBe(200);
    expect(await readSections(res)).toHaveLength(3);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("лимит не действует"));
  });

  it("дочитывает хвост: поток без завершающего перевода строки отдаёт все три направления", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseStream(), { status: 200, headers: { "content-type": "text/event-stream" } })
    );

    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(200);

    const sections = await readSections(res);
    expect(sections.map((s) => (s.data as { tier: string }).tier)).toEqual([
      "safe",
      "bold",
      "experimental",
    ]);
  });

  // Ради этого сценария лог и написан: секций три, схему не прошла ни одна,
  // человек видит пустой экран и не досчитывается прохода.
  it("пишет в лог расхождение, когда секции пришли, а схему не прошли", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Концепция длиннее верхней границы: маршрут секцию отдаёт, клиент её
    // отбросит.
    const broken = zerno.directions.map((d) => ({ ...d, concept: "я".repeat(500) }));
    global.fetch = vi.fn().mockResolvedValue(new Response(sseStream(broken), { status: 200 }));

    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(await readSections(res)).toHaveLength(3);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("схему прошло 0/3"));
  });


  it("лог различает «прислали мало» и «прислали, но не разобралось»", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // Модель прислала три строки, но у двух не хватает закрывающей скобки
    // в таком месте, где починка скобок не помогает: JSON битый по сути.
    const good = JSON.stringify({ section: "direction", data: zerno.directions[2] });
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        rawStream([`{"section":"direction","data":{"tier":"safe","conce`, `{"section":`, good]),
        { status: 200 }
      )
    );

    const res = await post({ brand: "уютная кофейня в центре города" });
    await readSections(res);

    // Раньше лог сказал бы «секций 1» и умолчал, что строк было три:
    // одно и то же число для двух разных поломок с разной починкой.
    expect(log).toHaveBeenCalledWith(expect.stringContaining("строк от модели 3"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("секций 1"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("схему прошло 1/3"));
    // И показал начала строк — иначе непонятно, чем именно сломан ответ.
    expect(log).toHaveBeenCalledWith(expect.stringContaining("строка 1:"));
  });

  it("на исправном потоке в лог не пишет", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue(new Response(sseStream(), { status: 200 }));

    const res = await post({ brand: "уютная кофейня в центре города" });
    await readSections(res);
    expect(log).not.toHaveBeenCalled();
  });

  it("сетевой сбой апстрима отдаёт 502, а не падает исключением", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause: new Error("ENOTFOUND polza.ai") })
    );

    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(502);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ENOTFOUND"));
  });

  it("уход посетителя со страницы в лог ошибок не пишет", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const aborted = new Error("The operation was aborted.");
    aborted.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValue(aborted);

    const res = await post({ brand: "уютная кофейня в центре города" });
    expect(res.status).toBe(502);
    expect(log).not.toHaveBeenCalled();
  });
});
