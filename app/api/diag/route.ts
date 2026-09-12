import { extractIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * ВРЕМЕННЫЙ маршрут. Отвечает на единственный вопрос, который нельзя
 * выяснить локально: перезаписывает ли платформа X-Forwarded-For или
 * дописывает к присланному клиентом. От ответа зависит, обходится ли
 * суточный лимит одной строкой curl.
 *
 * Адресов не возвращает — только структуру заголовка и результаты
 * сравнений. Даже тот, кто наткнётся на маршрут, не узнает ни своего
 * адреса, ни чужого. Удаляется сразу после проверки.
 */
export function GET(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  const parts = xff?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  // Подделку присылаем отдельным заголовком, чтобы сравнивать с ней, а не
  // печатать содержимое x-forwarded-for наружу.
  const probe = req.headers.get("x-diag-probe");

  const names = [
    "x-forwarded-for",
    "x-real-ip",
    "x-vercel-forwarded-for",
    "x-vercel-proxied-for",
    "forwarded",
  ];

  return Response.json({
    xffCount: parts.length,
    probeSent: probe !== null,
    probeIsFirst: probe ? parts[0] === probe : null,
    probeIndex: probe ? parts.indexOf(probe) : null,
    extractedIsProbe: probe ? extractIp(xff) === probe : null,
    extractedEqualsRealIp: extractIp(xff) === req.headers.get("x-real-ip"),
    extractedEqualsVercelXff:
      extractIp(xff) === req.headers.get("x-vercel-forwarded-for"),
    present: names.filter((n) => req.headers.get(n) !== null),
  });
}
