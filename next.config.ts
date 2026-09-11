import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Политика безопасности контента. Разбор 2026-09-10: сервис не отдавал ни
 * одного защитного заголовка.
 *
 * Главное здесь — frame-ancestors: без него страницу кладут в невидимый
 * iframe на чужом сайте и обманом собирают клик по «Собрать». Проход
 * списывается, платит владелец ключа роутера. Суточный лимит ущерб
 * ограничивает, но это последняя линия, а не первая.
 *
 * Два послабления названы явно, чтобы их не приняли за недосмотр:
 * script-src 'unsafe-inline' нужен гидратации Next (в проде она передаёт
 * данные инлайновым скриптом), 'unsafe-eval' — только сборщику в режиме
 * разработки. Нонсы потребовали бы middleware на каждый запрос, а
 * XSS-вектора в приложении нет: dangerouslySetInnerHTML не используется,
 * весь текст проходит через экранирование React.
 *
 * Google Fonts разрешены поимённо: карточки набираются шрифтами бренда с
 * их домена, и без этих двух строк весь брендборд теряет типографику.
 * Таблица стилей приходит с fonts.googleapis.com, сами файлы — с
 * fonts.gstatic.com, поэтому нужны оба.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data:",
  // Запросы уходят только к своему же маршруту: ключ роутера живёт на
  // сервере, и клиенту незачем стучаться никуда наружу.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // `next dev` иначе дописывает свой блок в CLAUDE.md, который ведётся руками.
  agentRules: false,

  // Версия фреймворка в заголовке не помогает никому, кроме того, кто
  // подбирает известные уязвимости под конкретный релиз.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Дублирует frame-ancestors для браузеров, которые её не знают.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Ничего из этого сервису не нужно; отказ объявляем явно.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Два года без preload: preload — обязательство перед списком
          // браузеров, которое снимается месяцами, а адрес демки ещё может
          // поменяться.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
