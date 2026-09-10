"use client";

import { useState } from "react";

import { Masthead } from "@/components/Masthead";
import { BriefForm } from "@/components/brief/BriefForm";
import { BriefSummary } from "@/components/brief/BriefSummary";
import { useDirections } from "@/components/brief/useDirections";
import { DirectionCard } from "@/components/directions/DirectionCard";
import type { Brief } from "@/lib/brief-schema";
import { TIERS } from "@/lib/catalog";

import "@/styles/result.css";

const LEAD_BRIEF =
  "Расскажите о бренде своими словами. В ответ придут три визуальных направления — " +
  "осторожное, смелое и радикальное, каждое с концепцией, палитрой и типографикой.";

const LEAD_RESULT =
  "Три направления по одному брифу. Не то — поправьте бриф и соберите заново.";

/**
 * Свой бриф: форма, поток генерации и результат. Единственный экран
 * сервиса, который тратит деньги и суточный лимит, поэтому и живёт за
 * отдельным адресом `/?brief`, а не открывается всем подряд первым делом.
 */
export function BriefFlow() {
  const [brief, setBrief] = useState<Partial<Brief>>({});
  const { start, reset, directions, status, error } = useDirections();

  const streaming = status === "streaming";

  return (
    <main className="shell">
      <Masthead lead={status === "idle" ? LEAD_BRIEF : LEAD_RESULT} />

      {/* Живая область смонтирована всегда и пуста до первой карточки:
          область, пришедшая в DOM вместе со своим первым значением,
          скринридером обычно не объявляется, а первое значение здесь и есть
          сообщение. Видимый счёт ниже говорит то же самое глазами и потому
          от озвучки скрыт. В ошибке область молчит: там говорит сама ошибка. */}
      <p className="visually-hidden" aria-live="polite">
        {status === "streaming" || status === "done"
          ? `${directions.length} из ${TIERS.length}, ` +
            (streaming ? "собираем направления" : "направления собраны")
          : ""}
      </p>

      {status === "idle" ? (
        <BriefForm
          brief={brief}
          onChange={setBrief}
          onSubmit={start}
          disabled={streaming}
        />
      ) : (
        <div className="result">
          <BriefSummary brief={brief} onEdit={reset} />

          {/* Спиннера нет: карточки приходят по одной, это и есть индикация.
              В ошибке счёт молчит: там говорит сама ошибка. */}
          {status !== "error" && (
            <p className="result-progress" aria-hidden="true">
              <span className="result-progress-count">
                {directions.length} из {TIERS.length}
              </span>
              <span className="result-progress-slots">
                {TIERS.map((tier, i) => (
                  <span
                    key={tier}
                    className="result-progress-slot"
                    data-on={i < directions.length ? "" : undefined}
                  />
                ))}
              </span>
              <span className="result-progress-note">
                {streaming ? "собираем направления" : "направления собраны"}
              </span>
            </p>
          )}

          {directions.length > 0 && (
            <div className="result-grid">
              {directions.map((direction) => (
                <DirectionCard key={direction.tier} direction={direction} />
              ))}
            </div>
          )}

          {error && (
            <div className="result-error" role="alert">
              <p className="result-error-text">{error}</p>
              <button
                type="button"
                className="result-retry"
                onClick={() => start(brief)}
              >
                Ещё раз
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
