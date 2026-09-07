"use client";

import type { Brief } from "@/lib/brief-schema";

/**
 * Бриф, свёрнутый в одну строку: начало описания бренда и выход обратно
 * в форму. Хвост описания срезает CSS (`text-overflow: ellipsis`) — в JS
 * текст не режется, иначе длина обрезки не совпадала бы с шириной экрана.
 */
export function BriefSummary({
  brief,
  onEdit,
}: {
  brief: Partial<Brief>;
  onEdit: () => void;
}) {
  return (
    <section className="summary reveal" aria-label="Бриф">
      <p className="summary-label">
        <span className="summary-mark" aria-hidden="true" />
        Бриф
      </p>
      <p className="summary-text">{brief.brand?.trim()}</p>
      <button type="button" className="summary-edit" onClick={onEdit}>
        Править
      </button>
    </section>
  );
}
