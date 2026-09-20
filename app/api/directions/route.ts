import { BriefSchema, stripEmpty } from "@/lib/brief-schema";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { parseSSEBuffer, parseSectionBuffer } from "@/lib/stream";
import { directionsByTier, TIERS } from "@/lib/catalog";
import { GeneratedDirectionSchema } from "@/lib/directions-schema";
import { DIRECTIONS_FAILED } from "@/lib/messages";
import { directionsForChips } from "@/lib/vocab";
import { extractIp, ipHash, isLimitConfigured, isOverLimit, limitKey } from "@/lib/rate-limit";
import { redis, DAY_SECONDS } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENDPOINT = "https://polza.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-opus-5";

// Направлений всего девять, они дешёвые и уезжают в промпт целиком.
// Палитры и шрифты перечисляет каждое направление само, отдельным
// списком их слать не нужно.

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json(
      { error: "Не удалось прочитать запрос. Проверьте формат данных." },
      { status: 400 }
    );
  }

  // Валидное JSON-тело может оказаться null, строкой, числом или массивом.
  // Приводим к пустому объекту, чтобы дальше сработала одна и та же проверка.
  const body =
    typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
      ? rawBody
      : {};

  const parsed = BriefSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Расскажите о бренде хотя бы одним предложением." },
      { status: 400 }
    );
  }

  const brief = stripEmpty(parsed.data);

  // Без соли хеш адреса считается по строке "undefined" и перестаёт
  // защищать приватность посетителей (восстанавливается перебором
  // по диапазону адресов); без ключа роутера незачем даже дёргать Polza.
  // Обе переменные — конфигурация сервиса, а не ввод пользователя, но
  // молча продолжать с ослабленной защитой хуже, чем явно отказать.
  const appSalt = process.env.APP_SALT;
  const polzaApiKey = process.env.POLZA_API_KEY;
  if (!appSalt || !polzaApiKey) {
    console.error("[directions] не задан APP_SALT или POLZA_API_KEY");
    return Response.json(
      { error: "Сервис временно недоступен. Попробуйте позже." },
      { status: 500 }
    );
  }

  // Суточный лимит на хеш адреса. Сырой IP считается только ради хеша
  // и никуда не сохраняется.
  const ip = extractIp(req.headers.get("x-forwarded-for"));
  const hash = ipHash(ip, appSalt);
  const key = limitKey(hash, new Date());

  // Суточный лимит — единственное, что стоит между публичной демкой с
  // платным ключом и счётом за токены. Раньше неработающее хранилище
  // молча пропускало проход: защита снималась ровно в тот момент, когда
  // была нужна, и узнать об этом можно было только из счёта.
  let count = 0;
  if (!isLimitConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[directions] хранилище лимита не настроено, генерация запрещена");
      return Response.json(
        { error: "Сервис временно недоступен. Попробуйте позже." },
        { status: 500 }
      );
    }
    // Локальная разработка: поднимать Upstash ради одного прогона незачем,
    // но без строки в логе отключённый лимит легко не заметить.
    console.error("[directions] хранилище лимита не настроено, лимит не действует");
  } else {
    try {
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, DAY_SECONDS);
    } catch {
      // Без значений, ключа и адреса: в лог уходит только сам факт отказа.
      console.error("[directions] хранилище лимита недоступно, проход запрещён");
      return Response.json(
        { error: "Не получилось проверить суточный лимит. Попробуйте через минуту." },
        { status: 503 }
      );
    }
  }

  // incr считает вместе с текущим запросом (первый проход даёт 1),
  // а isOverLimit ждёт число уже израсходованных проходов — отсюда −1.
  if (isOverLimit(count - 1)) {
    return Response.json(
      { error: "На сегодня хватит. Лимит снимется через сутки после первой сборки." },
      { status: 429 }
    );
  }

  // Чипы человека сужают каталог. Ничего не выбрал — отдаём все девять:
  // модель всё равно обязана взять по одному направлению на каждый уровень.
  const chips = [...(brief.characterChips ?? []), ...(brief.aestheticChips ?? [])];
  const chosen = directionsForChips(chips);

  // Каждый уровень риска должен остаться представленным, иначе модели
  // будет нечего выбрать под Bold или Experimental. Чипы этого не
  // гарантируют, поэтому недостающие уровни добираем из полного каталога.
  const directions = TIERS.flatMap((tier) => {
    const picked = chosen.filter((d) => d.tier === tier);
    return picked.length ? picked : directionsByTier(tier);
  });

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${polzaApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // Текст трёх направлений занимает около 1200 токенов, остальное
        // съедают рассуждения модели перед ответом. Платим за
        // использованные токены, а не за потолок, поэтому запас бесплатен.
        max_tokens: 6000,
        stream: true,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(directions),
          },
          { role: "user", content: buildUserMessage(brief) },
        ],
      }),
      // Клиент ушёл со страницы — рвём запрос к модели, не дочитываем
      // и не оплачиваем токены впустую.
      signal: req.signal,
    });
  } catch (error) {
    // Уход посетителя со страницы рвёт этот же запрос через req.signal.
    // Ответ уже некому читать, но в логе ошибок закрытой вкладке не место:
    // иначе настоящие отказы сети утонут среди ушедших посетителей.
    // Причина без тела ответа: у обрыва и таймаута она лежит в cause,
    // а тело апстрима может содержать эхо ключа.
    if (!(error instanceof Error && error.name === "AbortError")) {
      const cause = error instanceof Error ? (error.cause ?? error) : error;
      console.error(`[directions] апстрим недоступен: ${String(cause)}`);
    }
    return Response.json({ error: DIRECTIONS_FAILED }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Только статус: тело ответа апстрима может содержать эхо ключа.
    console.error(`[directions] апстрим ответил ${upstream.status}`);
    return Response.json({ error: DIRECTIONS_FAILED }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  // Платформа могла уже перевести controller в состояние cancel:
  // второй вызов close или error на нём бросит исключение.
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let sseBuffer = "";
      let textBuffer = "";
      let finishReason: string | null = null;
      let delivered = 0;
      let valid = 0;
      // Весь текст от модели целиком. Нужен только логу: delivered считает
      // РАЗОБРАННЫЕ секции, и «секций 1» одинаково выглядит и когда модель
      // прислала одну строку, и когда прислала три, а две не сложились в
      // JSON. Это разные поломки с разной починкой, и различает их только
      // сырой объём. Полтора килобайта в памяти на проход.
      let rawText = "";

      // Клиенту уходит всё: накопление на той стороне устойчиво к мусору,
      // и решать, что показывать, должно оно. А считаем прошедшее схему:
      // маршрут, который рапортует об успехе на ответе, отбракованном
      // клиентом до последней карточки, бесполезен как место, куда смотрят.
      const flush = (sections: { section: string; data: unknown }[]) => {
        for (const chunk of sections) {
          controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
          delivered++;
          if (chunk.section === "direction" && GeneratedDirectionSchema.safeParse(chunk.data).success)
            valid++;
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const sse = parseSSEBuffer(sseBuffer);
          sseBuffer = sse.remainder;
          finishReason = sse.finishReason ?? finishReason;

          const text = sse.chunks.join("");
          rawText += text;
          textBuffer += text;
          const parsedChunk = parseSectionBuffer(textBuffer);
          textBuffer = parsedChunk.remainder;
          flush(parsedChunk.sections);
        }

        if (!cancelled) {
          // Апстрим не завершает ответ переводом строки: последняя строка
          // построчного JSON оседает в остатке обоих буферов до чтения,
          // которого уже не будет. Без этого хвоста третье направление
          // теряется всегда.
          sseBuffer += decoder.decode();
          const tail = parseSSEBuffer(`${sseBuffer}\n`);
          const tailText = tail.chunks.join("");
          rawText += tailText;
          textBuffer += tailText;
          finishReason = tail.finishReason ?? finishReason;
          flush(parseSectionBuffer(`${textBuffer}\n`).sections);

          if (valid < TIERS.length) {
            // Обрыв генерации и несошедшаяся схема для человека выглядят
            // одинаково: пустой экран и потраченный проход. Различает их
            // расхождение между «прислали», «разобрали» и «прошло схему» —
            // все три числа нужны, любые два оставляют развилку.
            const lines = rawText.split("\n").filter((l) => l.trim());
            console.error(
              `[directions] строк от модели ${lines.length}, секций ${delivered},` +
                ` схему прошло ${valid}/${TIERS.length}, знаков ${rawText.length},` +
                ` finish_reason: ${finishReason ?? "не пришёл"}`
            );
            // Строки, не ставшие секциями, — единственное место, где видно
            // ЧЕМ именно сломан ответ. Начала хватает: поломка модели всегда
            // в конце строки, а целиком выводить незачем.
            if (lines.length > delivered) {
              for (const [i, line] of lines.entries()) {
                console.error(`[directions] строка ${i + 1}: ${line.slice(0, 120)}`);
              }
            }
          }

          controller.close();
        }
      } catch (error) {
        // Бросить мог сам close или enqueue — тогда контроллер уже мёртв
        // и error на нём бросит второй раз, уже из start().
        if (!cancelled) {
          try {
            controller.error(error);
          } catch {
            // Контроллер уже мёртв: посетителю мы ничего не скажем,
            // но молчать в логе о потерянном потоке нельзя.
            console.error("[directions] поток закрылся до сообщения об ошибке");
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      cancelled = true;
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
