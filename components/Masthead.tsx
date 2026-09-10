import type { CSSProperties } from "react";

/**
 * Шапка сервиса. Одна на все три экрана — витрину, форму и результат:
 * меняется только лид под заголовком. Порядок появления задан --i, чтобы
 * строки выходили сверху вниз одной волной, а не каждая сама по себе.
 */
export function Masthead({ lead }: { lead: string }) {
  return (
    <header className="masthead">
      <p className="eyebrow reveal" style={{ "--i": 0 } as CSSProperties}>
        <span className="eyebrow-mark" aria-hidden="true" />
        Бренд-мудборд
      </p>
      <h1 className="masthead-title reveal" style={{ "--i": 1 } as CSSProperties}>
        Бриф
        <span className="masthead-title-light">на бренд</span>
      </h1>
      <p className="masthead-lead reveal" style={{ "--i": 2 } as CSSProperties}>
        {lead}
      </p>
    </header>
  );
}
