import { BriefSchema, stripEmpty } from "@/lib/brief-schema";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { parseSSEBuffer, parseSectionBuffer } from "@/lib/stream";
import { DIRECTIONS, TIERS } from "@/lib/catalog";
import { directionsForChips } from "@/lib/vocab";
import { extractIp, ipHash, isOverLimit, limitKey } from "@/lib/rate-limit";
import { redis, DAY_SECONDS } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENDPOINT = "https://polza.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-5";

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

  // Хранилище недоступно — лимит не срабатывает и генерация идёт.
  // Доступность важнее экономии на одном проходе.
  let count = 0;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, DAY_SECONDS);
  } catch {
    count = 0;
  }

  if (isOverLimit(count)) {
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
    return picked.length ? picked : DIRECTIONS.filter((d) => d.tier === tier);
  });

  const upstream = await fetch(ENDPOINT, {
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

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "Не удалось собрать направления. Попробуйте ещё раз." },
      { status: 502 }
    );
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

      const flush = (sections: { section: string; data: unknown }[]) => {
        for (const chunk of sections) {
          controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
          delivered++;
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

          textBuffer += sse.chunks.join("");
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
          textBuffer += tail.chunks.join("");
          finishReason = tail.finishReason ?? finishReason;
          flush(parseSectionBuffer(`${textBuffer}\n`).sections);

          if (delivered < 3) {
            // Обрыв генерации и несошедшаяся схема для человека выглядят
            // одинаково. Причину видно только здесь.
            console.error(
              `[directions] пришло ${delivered}/3, finish_reason: ${finishReason ?? "не пришёл"}`
            );
          }

          controller.close();
        }
      } catch (error) {
        if (!cancelled) controller.error(error);
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
