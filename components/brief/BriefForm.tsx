"use client";

import type { CSSProperties } from "react";

import { briefFullness } from "@/lib/brief-quality";
import { BRIEF_FIELDS, type Brief } from "@/lib/brief-schema";
import { AESTHETIC_CHIPS, CHARACTER_CHIPS } from "@/lib/vocab";

import { ChipGroup } from "./ChipGroup";

/** Номер раздела висит в левом поле, как в швейцарском наборе. */
const index = (n: number) => String(n).padStart(2, "0");

/** Порядковый номер в общей ступенчатой сборке страницы. */
const beat = (n: number) => ({ "--i": n }) as CSSProperties;

export function BriefForm({
  brief,
  onChange,
  onSubmit,
  disabled,
}: {
  brief: Partial<Brief>;
  onChange: (brief: Partial<Brief>) => void;
  onSubmit: (brief: Partial<Brief>) => void;
  disabled: boolean;
}) {
  const fullness = briefFullness(brief);
  const brandLength = brief.brand?.trim().length ?? 0;
  const canSubmit = brandLength >= BRIEF_FIELDS.brand.min && !disabled;

  const set = <K extends keyof Brief>(key: K, value: Brief[K]) =>
    onChange({ ...brief, [key]: value });

  const toggle = (key: "characterChips" | "aestheticChips", id: string) => {
    const current = brief[key] ?? [];
    set(key, current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);
  };

  return (
    <form
      className="brief"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(brief);
      }}
    >
      <section className="field reveal" style={beat(3)}>
        <label className="field-label" htmlFor="brand">
          <span className="field-index" aria-hidden="true">
            {index(1)}
          </span>
          {BRIEF_FIELDS.brand.label}
          <span className="field-flag">обязательно</span>
        </label>
        <textarea
          id="brand"
          className="input input--area"
          rows={4}
          maxLength={BRIEF_FIELDS.brand.max}
          value={brief.brand ?? ""}
          onChange={(e) => set("brand", e.target.value)}
          placeholder="Обжарочная «Зерно» в Казани. Обжариваем сами, каждую неделю новая партия. Продаём зерно тем, кто варит дома."
        />
        <p className="field-meter" aria-hidden="true">
          <span className="field-meter-count">{brandLength}</span>
          <span className="field-meter-limit">/ {BRIEF_FIELDS.brand.max}</span>
          <span className="field-meter-need">
            {brandLength >= BRIEF_FIELDS.brand.min
              ? "довольно"
              : `ещё ${BRIEF_FIELDS.brand.min - brandLength}`}
          </span>
        </p>
      </section>

      <section className="field reveal" style={beat(4)}>
        <label className="field-label" htmlFor="audience">
          <span className="field-index" aria-hidden="true">
            {index(2)}
          </span>
          {BRIEF_FIELDS.audience.label}
        </label>
        <input
          id="audience"
          className="input"
          maxLength={BRIEF_FIELDS.audience.max}
          value={brief.audience ?? ""}
          onChange={(e) => set("audience", e.target.value)}
          placeholder="Домашние бариста, берут зерно раз в две недели"
        />
      </section>

      <fieldset className="field reveal" style={beat(5)}>
        <legend className="field-label">
          <span className="field-index" aria-hidden="true">
            {index(3)}
          </span>
          Характер
        </legend>
        <ChipGroup
          chips={CHARACTER_CHIPS}
          selected={brief.characterChips ?? []}
          onToggle={(id) => toggle("characterChips", id)}
          freeText={brief.characterFree ?? ""}
          onFreeTextChange={(v) => set("characterFree", v)}
          placeholder="Или своими словами"
          maxLength={BRIEF_FIELDS.characterFree.max}
        />
      </fieldset>

      <fieldset className="field reveal" style={beat(6)}>
        <legend className="field-label">
          <span className="field-index" aria-hidden="true">
            {index(4)}
          </span>
          Эстетика
        </legend>
        <ChipGroup
          chips={AESTHETIC_CHIPS}
          selected={brief.aestheticChips ?? []}
          onToggle={(id) => toggle("aestheticChips", id)}
          freeText={brief.aestheticFree ?? ""}
          onFreeTextChange={(v) => set("aestheticFree", v)}
          placeholder="Или своими словами"
          maxLength={BRIEF_FIELDS.aestheticFree.max}
        />
      </fieldset>

      <section className="field reveal" style={beat(7)}>
        <label className="field-label" htmlFor="avoid">
          <span className="field-index" aria-hidden="true">
            {index(5)}
          </span>
          {BRIEF_FIELDS.avoid.label}
        </label>
        <input
          id="avoid"
          className="input"
          maxLength={BRIEF_FIELDS.avoid.max}
          value={brief.avoid ?? ""}
          onChange={(e) => set("avoid", e.target.value)}
          placeholder="Без деревенской избы и мешковины"
        />
      </section>

      <footer className="brief-foot reveal" style={beat(8)}>
        <div
          className="fullness"
          data-level={fullness.level}
          style={{ "--fullness": fullness.ratio } as CSSProperties}
        >
          <p className="fullness-caption">Полнота брифа</p>
          <p className="fullness-value" aria-hidden="true">
            {Math.round(fullness.ratio * 100)}
            <span className="fullness-unit">%</span>
          </p>
          <span className="fullness-track" aria-hidden="true">
            <span className="fullness-fill" />
          </span>
          <p className="fullness-note" aria-live="polite">
            {fullness.note}
          </p>
        </div>

        <button type="submit" className="submit" disabled={!canSubmit}>
          <span className="submit-label">Предложить направления</span>
          <span className="submit-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </footer>
    </form>
  );
}
