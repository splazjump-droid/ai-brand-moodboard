"use client";

import { useState } from "react";
import type { Brief } from "@/lib/brief-schema";
import type { GeneratedDirection } from "@/lib/directions-schema";
import { parseSectionBuffer } from "@/lib/stream";
import { accumulate, isComplete } from "@/lib/directions-state";

type Status = "idle" | "streaming" | "done" | "error";

const GENERIC = "Не удалось собрать направления. Попробуйте ещё раз.";

/**
 * Тонкая обёртка вокруг запроса и чистой функции accumulate.
 * Разбор потока живёт в lib/stream.ts, накопление — в lib/directions-state.ts.
 */
export function useDirections() {
  const [directions, setDirections] = useState<GeneratedDirection[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function start(brief: Partial<Brief>) {
    setDirections([]);
    setError(null);
    setStatus("streaming");

    let res: Response;
    try {
      res = await fetch("/api/directions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(brief),
      });
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
      setStatus("error");
      return;
    }

    if (!res.ok || !res.body) {
      // Свой текст маршрута (400, 429, 502) доходит до человека как есть:
      // «на сегодня хватит» и «расскажите о бренде» — разные починки.
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? GENERIC);
      setStatus("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Накопленное держим локально: setState асинхронный, и чтение
    // directions внутри цикла дало бы значение предыдущего кадра.
    let current: GeneratedDirection[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { sections, remainder } = parseSectionBuffer(buffer);
        buffer = remainder;

        if (sections.length) {
          current = accumulate(current, sections);
          setDirections(current);
        }
      }

      // Тот же хвост, что дочитывает маршрут у своего апстрима. Сегодня
      // маршрут заканчивает каждую секцию переводом строки, но держаться
      // на этом — значит терять третье направление в тот день, когда
      // перевод строки уберут. Пустой остаток ничего не меняет.
      buffer += decoder.decode();
      if (buffer.trim()) {
        const sections = parseSectionBuffer(`${buffer}\n`).sections;
        if (sections.length) {
          current = accumulate(current, sections);
          setDirections(current);
        }
      }
    } catch {
      setError("Соединение прервалось во время сборки. Попробуйте ещё раз.");
      setStatus("error");
      return;
    }

    if (isComplete(current)) setStatus("done");
    else {
      setError(GENERIC);
      setStatus("error");
    }
  }

  // Возврат к форме с сохранённым брифом: собрать второй набор —
  // самое частое, чего хочет человек, увидевший первый.
  function reset() {
    setDirections([]);
    setStatus("idle");
    setError(null);
  }

  return { start, reset, directions, status, error };
}
