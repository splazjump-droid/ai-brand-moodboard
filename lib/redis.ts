import { Redis } from "@upstash/redis";

// Интеграция Vercel кладёт переменные с префиксом KV_, отдельная
// установка Upstash — с префиксом UPSTASH_. Поддерживаем оба, чтобы
// локальная отладка и боевой адрес не расходились.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const DAY_SECONDS = 24 * 60 * 60;
