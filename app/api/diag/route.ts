import { isLimitConfigured } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * ВРЕМЕННЫЙ маршрут. Маршрут генерации отвечает «Сервис временно
 * недоступен» на две разные причины сразу, и снаружи они неразличимы —
 * это правильно для посетителя и бесполезно для наладки.
 *
 * Значений не возвращает: только факт наличия и длину, чтобы отличить
 * пустую строку от заполненной. Удаляется сразу после проверки.
 */
export function GET() {
  const len = (v: string | undefined) => (v === undefined ? null : v.length);

  return Response.json({
    nodeEnv: process.env.NODE_ENV,
    polzaKey: len(process.env.POLZA_API_KEY),
    appSalt: len(process.env.APP_SALT),
    kvUrl: len(process.env.KV_REST_API_URL),
    kvToken: len(process.env.KV_REST_API_TOKEN),
    upstashUrl: len(process.env.UPSTASH_REDIS_REST_URL),
    upstashToken: len(process.env.UPSTASH_REDIS_REST_TOKEN),
    dailyLimitRaw: process.env.DAILY_LIMIT ?? null,
    limitConfigured: isLimitConfigured(),
    // Имена всех переменных, начинающихся на знакомые префиксы: опечатка
    // в имени ищется только так — код смотрит на одно, в панели написано
    // другое, и обе стороны выглядят правильно.
    seen: Object.keys(process.env)
      .filter((k) => /POLZA|SALT|KV_|UPSTASH|DAILY/i.test(k))
      .sort(),
  });
}
