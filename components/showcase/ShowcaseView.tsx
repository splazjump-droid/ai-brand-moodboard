import Link from "next/link";
import type { CSSProperties } from "react";

import { BriefSummary } from "@/components/brief/BriefSummary";
import { DirectionCard } from "@/components/directions/DirectionCard";
import { SHOWCASES, type Showcase } from "@/lib/fixtures";

import "@/styles/result.css";
import "@/styles/showcase.css";

/**
 * Записанный проход сервиса, показанный посетителю: бриф, три направления
 * и переключатель на соседние примеры. Ни одного обращения к модели —
 * человек видит результат за ноль секунд и не тратит суточный лимит.
 *
 * Компонент серверный и без состояния. Переход к своему брифу идёт
 * ссылкой на `/?brief`, а не колбэком: тогда и главная, и страницы
 * примеров ведут себя одинаково, а состояние живёт в адресе.
 */
export function ShowcaseView({ showcase }: { showcase: Showcase }) {
  return (
    <section className="showcase" aria-label={`Пример: ${showcase.title}`}>
      <nav className="showcase-switch reveal" style={{ "--i": 3 } as CSSProperties}>
        <p className="showcase-note">
          <span className="showcase-mark" aria-hidden="true" />
          Записанный пример
        </p>
        <ul className="showcase-tabs">
          {SHOWCASES.map((item) => (
            <li key={item.slug}>
              {item.slug === showcase.slug ? (
                <span className="showcase-tab" aria-current="page">
                  {item.title}
                </span>
              ) : (
                <Link className="showcase-tab" href={`/primer/${item.slug}`}>
                  {item.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <BriefSummary brief={showcase.brief} />

      <div className="result-grid">
        {showcase.directions.map((direction) => (
          <DirectionCard key={direction.tier} direction={direction} />
        ))}
      </div>

      <p className="showcase-cta">
        <Link className="showcase-cta-link" href="/?brief">
          Собрать по своему брифу
        </Link>
      </p>
    </section>
  );
}
