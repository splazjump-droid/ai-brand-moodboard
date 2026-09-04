import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) },
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

beforeEach(() => {
  process.env.APP_SALT = "тестовая-соль";
  process.env.POLZA_API_KEY = "тестовый-ключ";
  vi.resetModules();
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
});
