import { describe, it, expect, afterEach, vi } from "vitest";
import {
  extractIp,
  ipHash,
  parseDailyLimit,
  isLimitConfigured,
  isOverLimit,
  limitKey,
} from "./rate-limit";

describe("извлечение адреса", () => {
  it("берёт первый адрес из списка прокси", () => {
    expect(extractIp("203.0.113.7, 70.41.3.18")).toBe("203.0.113.7");
  });

  it("на пустом заголовке даёт заглушку", () => {
    expect(extractIp(null)).toBe("0.0.0.0");
    expect(extractIp("")).toBe("0.0.0.0");
  });
});

describe("хеш адреса", () => {
  it("одинаковый вход даёт одинаковый хеш", () => {
    expect(ipHash("203.0.113.7", "соль")).toBe(ipHash("203.0.113.7", "соль"));
  });

  it("разная соль даёт разный хеш", () => {
    expect(ipHash("203.0.113.7", "а")).not.toBe(ipHash("203.0.113.7", "б"));
  });

  it("сырой адрес в хеше не виден", () => {
    expect(ipHash("203.0.113.7", "соль")).not.toContain("203.0.113.7");
  });
});

describe("потолок", () => {
  it("мусор в переменной окружения даёт значение по умолчанию 2", () => {
    expect(parseDailyLimit(undefined)).toBe(2);
    expect(parseDailyLimit("")).toBe(2);
    expect(parseDailyLimit("не число")).toBe(2);
    expect(parseDailyLimit("0")).toBe(2);
    expect(parseDailyLimit("-5")).toBe(2);
  });

  it("целое положительное значение принимается", () => {
    expect(parseDailyLimit("7")).toBe(7);
  });

  it("isOverLimit срабатывает, когда счётчик догнал потолок", () => {
    expect(isOverLimit(0)).toBe(false);
    expect(isOverLimit(2)).toBe(true);
    expect(isOverLimit(3)).toBe(true);
  });
});

describe("ключ суток", () => {
  it("один и тот же день даёт один ключ", () => {
    const a = limitKey("abc", new Date("2026-09-03T01:00:00Z"));
    const b = limitKey("abc", new Date("2026-09-03T23:00:00Z"));
    expect(a).toBe(b);
  });

  it("разные дни дают разные ключи", () => {
    const a = limitKey("abc", new Date("2026-09-03T23:00:00Z"));
    const b = limitKey("abc", new Date("2026-09-04T01:00:00Z"));
    expect(a).not.toBe(b);
  });
});

describe("настроенность хранилища лимита", () => {
  // Обе пары снимаются перед каждой проверкой: окружение разработчика
  // может содержать любую из них, и тест не должен зависеть от машины.
  const clear = () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("без переменных хранилища нет", () => {
    clear();
    expect(isLimitConfigured()).toBe(false);
  });

  it("годится пара от интеграции Vercel", () => {
    clear();
    vi.stubEnv("KV_REST_API_URL", "https://пример.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "токен");
    expect(isLimitConfigured()).toBe(true);
  });

  it("годится пара от отдельной установки Upstash", () => {
    clear();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://пример.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "токен");
    expect(isLimitConfigured()).toBe(true);
  });

  it("адрес без токена хранилищем не считается", () => {
    clear();
    vi.stubEnv("KV_REST_API_URL", "https://пример.upstash.io");
    expect(isLimitConfigured()).toBe(false);
  });

  it("пробелы вместо значения не считаются заданным", () => {
    clear();
    vi.stubEnv("KV_REST_API_URL", "   ");
    vi.stubEnv("KV_REST_API_TOKEN", "   ");
    expect(isLimitConfigured()).toBe(false);
  });

  it("половины из разных пар вместе хранилищем не становятся", () => {
    clear();
    vi.stubEnv("KV_REST_API_URL", "https://пример.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "токен");
    expect(isLimitConfigured()).toBe(false);
  });
});
