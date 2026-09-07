import type { CSSProperties } from "react";

import { findDirection, findFontPair, findPalette, TIERS } from "@/lib/catalog";
import type { GeneratedDirection } from "@/lib/directions-schema";

import "@/styles/direction-card.css";

// Имена уровней уходят в интерфейс ровно так, как договорено, и не переводятся.
const TIER_LABEL = {
  safe: "Safe",
  bold: "Bold",
  experimental: "Experimental",
} as const;

const TIER_RISK = { safe: 1, bold: 2, experimental: 3 } as const;

const RISK_SLOTS = TIERS.map((tier) => TIER_RISK[tier]);

/**
 * Шрифты бренда тянутся с Google Fonts по требованию: держать в проекте
 * все двадцать семейств каталога ради образца незачем. Ось начертаний
 * не запрашивается вовсе — половина семейств каталога статические, и
 * запрос вроде wght@400;700 у них кончается ошибкой. Образец набирается
 * четырёхсотым, иерархия внутри держится на кегле.
 */
const fontsHref = (families: string[]) =>
  `https://fonts.googleapis.com/css2?${families
    .map((family) => `family=${family.replace(/ /g, "+")}`)
    .join("&")}&display=swap`;

// Онест закрывает кириллицу целиком и не спорит по характеру ни с одной
// парой каталога — годится как подложка, если у семейства букв не нашлось.
const fallback = (family: string) => `"${family}", var(--type-text), sans-serif`;

export function DirectionCard({ direction }: { direction: GeneratedDirection }) {
  const catalogName = findDirection(direction.directionId)?.name;
  const palette = findPalette(direction.paletteId);
  const fonts = findFontPair(direction.fontPairId);

  // Схема сверяет палитру и пару с направлением, так что промах здесь
  // означает разъехавшийся каталог, а не плохой ответ модели. Карточка
  // в этом случае просто остаётся в цветах оболочки: значения --brand-*
  // объявлены в CSS и работают как запасные.
  const brand = {
    ...(palette && {
      "--brand-bg": palette.background,
      "--brand-fg": palette.foreground,
      "--brand-fg-muted": palette.mutedForeground,
    }),
    ...(fonts && {
      "--brand-heading": fallback(fonts.heading),
      "--brand-body": fallback(fonts.body),
    }),
  } as CSSProperties;

  // Роль называется словом, а не одним квадратом: полоска без подписей
  // читается декором, а это единственное место, где палитра — данные.
  const swatches = palette
    ? [
        { role: "Фон", hex: palette.background },
        { role: "Подложка", hex: palette.muted },
        { role: "Основной", hex: palette.primary },
        { role: "Акцент", hex: palette.accent },
        { role: "Текст", hex: palette.foreground },
      ]
    : [];

  const headingId = `direction-${direction.tier}-name`;

  return (
    <article className="direction-card" aria-labelledby={headingId}>
      {fonts && <link rel="stylesheet" href={fontsHref([fonts.heading, fonts.body])} />}

      <header className="direction-head">
        <p className="direction-tier">
          <span className="direction-tier-mark" aria-hidden="true" />
          {TIER_LABEL[direction.tier]}
        </p>
        {catalogName && <p className="direction-origin">{catalogName}</p>}
        <p className="direction-risk">
          <span className="visually-hidden">
            Уровень риска {TIER_RISK[direction.tier]} из {TIERS.length}
          </span>
          {RISK_SLOTS.map((slot) => (
            <span
              key={slot}
              aria-hidden="true"
              className="direction-risk-slot"
              data-on={slot <= TIER_RISK[direction.tier] ? "" : undefined}
            />
          ))}
        </p>
      </header>

      <div className="direction-specimen" style={brand}>
        <h2 className="direction-name" id={headingId}>
          {direction.name}
        </h2>

        <p className="direction-concept">{direction.concept}</p>

        <ul className="direction-keywords">
          {direction.keywords.map((word) => (
            <li className="direction-keyword" key={word}>
              {word}
            </li>
          ))}
        </ul>

        {fonts && (
          <dl className="direction-type">
            <div className="direction-type-cell">
              <dt className="direction-type-role">Заголовки</dt>
              <dd className="direction-type-family">{fonts.heading}</dd>
              <dd className="direction-type-sample direction-type-sample--heading">
                Аа Бб Вв Gg 12
              </dd>
            </div>
            <div className="direction-type-cell">
              <dt className="direction-type-role">Текст</dt>
              <dd className="direction-type-family">{fonts.body}</dd>
              <dd className="direction-type-sample direction-type-sample--body">
                Аа Бб Вв Gg 12
              </dd>
            </div>
          </dl>
        )}

        {swatches.length > 0 && (
          <ul className="direction-palette">
            {swatches.map(({ role, hex }) => (
              <li className="direction-swatch" key={role}>
                <span className="direction-swatch-role">{role}</span>
                <span className="direction-swatch-hex">{hex.toUpperCase()}</span>
                <span
                  className="direction-swatch-chip"
                  aria-hidden="true"
                  style={{ background: hex }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
