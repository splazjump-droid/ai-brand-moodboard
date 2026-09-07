import { createHash } from "node:crypto";

// Публичная демка с ключом роутера: при ~37 ₽ за полный проход
// потолок держим низким. Значение поднимается только через
// переменную окружения для локальной отладки.
const DEFAULT_DAILY_LIMIT = 2;

export function parseDailyLimit(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

export const DAILY_LIMIT = parseDailyLimit(process.env.DAILY_LIMIT);

export function ipHash(ip: string, salt: string): string {
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

export function isOverLimit(count: number): boolean {
  return count >= DAILY_LIMIT;
}

/**
 * Заголовок X-Forwarded-For содержит список адресов через запятую:
 * каждый прокси дописывает свой, ближайший к клиенту стоит первым.
 */
export function extractIp(headerValue: string | null | undefined): string {
  const first = headerValue?.split(",")[0]?.trim();
  return first || "0.0.0.0";
}

/**
 * Ключ счётчика с датой внутри. Счётчику ставится TTL на сутки,
 * но дата в ключе делает переход через полночь однозначным даже
 * если TTL не сработал.
 *
 * Дата берётся по UTC: рубеж суток один на всех и не зависит от часового
 * пояса посетителя. Для кого-то лимит снимается посреди дня, и это
 * сознательно — иначе пояс пришлось бы узнавать у клиента, а клиент
 * в вопросе лимита сторона заинтересованная.
 */
export function limitKey(hash: string, now: Date): string {
  return `brief:${now.toISOString().slice(0, 10)}:${hash}`;
}
