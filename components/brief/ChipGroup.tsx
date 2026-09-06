"use client";

import { useId } from "react";

import type { Chip } from "@/lib/vocab";

export function ChipGroup({
  chips,
  selected,
  onToggle,
  freeText,
  onFreeTextChange,
  placeholder,
  maxLength,
}: {
  chips: Chip[];
  selected: string[];
  onToggle: (id: string) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
}) {
  const freeId = useId();

  return (
    <div className="chip-group">
      <div className="chip-row" role="group">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="chip"
            aria-pressed={selected.includes(chip.id)}
            onClick={() => onToggle(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <label className="visually-hidden" htmlFor={freeId}>
        {placeholder}
      </label>
      <input
        id={freeId}
        className="chip-free"
        value={freeText}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onFreeTextChange(e.target.value)}
      />
    </div>
  );
}
