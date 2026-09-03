# Форма брифа и шаг трёх направлений — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Человек заполняет бриф о бренде и получает стримом три визуальных направления — Safe, Bold и Experimental — с концепцией, палитрой и типографикой из локального каталога.

**Architecture:** Next.js App Router. Клиентская форма собирает объект и шлёт его в единственный route handler, тот валидирует схемой, проверяет суточный лимит в Upstash Redis и проксирует SSE-поток от Polza построчным JSON. Разбор потока и хеширование IP переносятся из соседнего проекта `/Users/artemfrolov/vyveska` вместе с тестами. Каталог дизайн-данных лежит срезом в репозитории: модель выбирает из него по id, а не выдумывает палитры и шрифты.

**Tech Stack:** Next.js 16, React 19, TypeScript, zod 4, vitest 4, `@upstash/redis`.

**Spec:** `docs/superpowers/specs/2026-09-03-brief-form-design.md`

## Global Constraints

Значения скопированы из `CLAUDE.md` и спеки. Требования каждой задачи включают этот раздел.

- `POLZA_API_KEY` и любые ключи — только в route handlers в `app/api/`. Никогда в клиентский код и никогда в `NEXT_PUBLIC_*`.
- Anthropic SDK в проект не тащить. Polza — OpenAI-совместимый роутер, работаем обычным `fetch`.
- Три направления называются ровно `Safe` / `Bold` / `Experimental`. Не переименовывать.
- Интерфейс и вывод модели — на русском. Промпты и ключи JSON-схемы — на английском.
- Вывод модели не парсить регулярками. Построчный JSON, схема проверяется на выходе.
- Шрифт без кириллицы в рекомендации не попадает. Проверка по колонке `Subsets` в `google-fonts.csv`, а не на глаз.
- Запрещённые шрифты: Inter, Roboto, Arial, Open Sans, Lato, Space Grotesk. Запрещённый приём: фиолетовый градиент на белом.
- Оболочка сервиса нейтральная. Сгенерированная палитра живёт только внутри карточек результата.
- Экран не блокируется спиннером: текстовая часть появляется стримом раньше визуальной.
- Картинки на этом шаге не заказываются вообще.
- Суточный лимит — 2 генерации, потолок не поднимать.
- `.env.local` не коммитить, реальные ключи в примеры не вставлять.
- Всегда `python3`, не `python`.

## Структура файлов

| Файл | Отвечает за |
|---|---|
| `lib/catalog/styles.json` | срез `styles.csv`: id, ключевые слова, для чего годится |
| `lib/catalog/palettes.json` | срез `colors.csv`: семантические роли цвета |
| `lib/catalog/font-pairs.json` | пары шрифтов, собранные вручную, все с кириллицей |
| `lib/catalog/index.ts` | типизированный доступ к трём срезам |
| `scripts/build-catalog.mjs` | пересборка срезов из локального каталога |
| `lib/vocab.ts` | чипы формы → id стилей каталога |
| `lib/brief-schema.ts` | схема брифа, источник лимитов для промпта |
| `lib/brief-quality.ts` | индикатор полноты брифа |
| `lib/directions-schema.ts` | схема ответа модели |
| `lib/prompt.ts` | системный промпт, собранный из схемы и каталога |
| `lib/stream.ts` | разбор SSE и построчного JSON, перенос из vyveska |
| `lib/rate-limit.ts` | хеш IP, ключ суток, потолок |
| `lib/redis.ts` | клиент Upstash |
| `lib/directions-state.ts` | накопление направлений из кусков потока |
| `lib/fixtures/*.ts` | готовые брендборды для витрины |
| `app/api/directions/route.ts` | единственная точка наружу |
| `components/brief/ChipGroup.tsx` | мультивыбор чипов и поле «своё» |
| `components/brief/BriefForm.tsx` | состояние формы |
| `components/brief/BriefSummary.tsx` | свёрнутая строка после отправки |
| `components/brief/useDirections.ts` | запрос и чтение потока |
| `components/directions/DirectionCard.tsx` | карточка направления |
| `app/page.tsx` | сборка экрана |

Компоненты тестами не покрываются: vitest настроен на `node`, DOM-окружение ради демки не заводим. Вёрстка проверяется в браузере через скилл `run`, состояния — через `/break`. Вся логика, которую стоит проверять, вынесена в `lib/`.

---

### Task 1: Скаффолд проекта

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `lib/smoke.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces: рабочие команды `npm run dev`, `npm test`, `npm run build`, `npx tsc --noEmit`; алиас `@/` на корень проекта

- [ ] **Step 1: Создать проект**

```bash
cd "/Users/artemfrolov/Desktop/ai brand moodboard"
npx create-next-app@latest . --typescript --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm
```

На вопрос про перезапись существующих файлов отвечать так, чтобы `CLAUDE.md`, `ai_brand_moodboard_project.txt`, `docs/` и `.claude/` остались нетронутыми.

- [ ] **Step 2: Поставить зависимости**

```bash
npm install zod @upstash/redis
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Настроить vitest**

Создать `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts", "app/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Добавить в `package.json` в `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Написать падающий смоук-тест**

Создать `lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { projectName } from "./smoke";

describe("скаффолд", () => {
  it("собирается и видит алиас @/", () => {
    expect(projectName).toBe("ai-brand-moodboard");
  });
});
```

- [ ] **Step 5: Убедиться, что тест падает**

Run: `npm test`
Expected: FAIL, `Cannot find module './smoke'`

- [ ] **Step 6: Минимальная реализация**

Создать `lib/smoke.ts`:

```ts
export const projectName = "ai-brand-moodboard";
```

- [ ] **Step 7: Убедиться, что всё зелёное**

```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: тест PASS, типы без ошибок, сборка успешна.

- [ ] **Step 8: Записать пример переменных окружения**

Создать `.env.example` (без реальных значений):

```
POLZA_API_KEY=
APP_SALT=
KV_REST_API_URL=
KV_REST_API_TOKEN=
DAILY_LIMIT=
```

Проверить, что `.env.local` попадает под `.gitignore`:

```bash
git check-ignore -v .env.local
```
Expected: строка правила из `.gitignore`.

- [ ] **Step 9: Заполнить раздел «Как запускать и проверять» в CLAUDE.md**

Заменить три строки «не определено» на реальные команды: `npm run dev`, `npm test`, `npx tsc --noEmit` и `npm run build`.

- [ ] **Step 10: Коммит**

```bash
git add -A
git commit -m "Скаффолд: Next.js, vitest, пример переменных окружения"
```

---

### Task 2: Срез каталога дизайн-данных в репозиторий

Каталог `ui-ux-pro-max` лежит вне проекта и в сборку не попадёт. Нужен срез в репозитории — только те поля, что реально уходят в промпт.

**Files:**
- Create: `scripts/build-catalog.mjs`
- Create: `lib/catalog/styles.json`, `lib/catalog/palettes.json`, `lib/catalog/font-pairs.json`
- Create: `lib/catalog/index.ts`
- Test: `lib/catalog/catalog.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `STYLES: Style[]`, где `Style = { id: string; name: string; keywords: string[]; bestFor: string; avoidFor: string }`
  - `PALETTES: Palette[]`, где `Palette = { id: string; name: string; primary: string; onPrimary: string; accent: string; onAccent: string; background: string; foreground: string; muted: string; mutedForeground: string; border: string }`
  - `FONT_PAIRS: FontPair[]`, где `FontPair = { id: string; heading: string; body: string; mood: string[] }`
  - `findStyle(id: string): Style | undefined`, `findPalette(id: string): Palette | undefined`, `findFontPair(id: string): FontPair | undefined`

- [ ] **Step 1: Написать падающий тест каталога**

Создать `lib/catalog/catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { STYLES, PALETTES, FONT_PAIRS, findStyle } from "./index";

const BANNED_FONTS = ["Inter", "Roboto", "Arial", "Open Sans", "Lato", "Space Grotesk"];

describe("каталог стилей", () => {
  it("не пустой и у каждого стиля есть id и ключевые слова", () => {
    expect(STYLES.length).toBeGreaterThan(10);
    for (const s of STYLES) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.keywords.length).toBeGreaterThan(0);
    }
  });

  it("id уникальны", () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
  });

  it("findStyle находит по id и молчит на неизвестном", () => {
    expect(findStyle(STYLES[0].id)?.id).toBe(STYLES[0].id);
    expect(findStyle("нет-такого")).toBeUndefined();
  });
});

describe("каталог палитр", () => {
  it("у каждой палитры заполнены все роли цвета", () => {
    expect(PALETTES.length).toBeGreaterThan(10);
    for (const p of PALETTES) {
      for (const role of ["primary", "onPrimary", "accent", "background", "foreground", "border"] as const) {
        expect(p[role]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe("каталог шрифтовых пар", () => {
  it("не содержит запрещённых шрифтов", () => {
    for (const pair of FONT_PAIRS) {
      for (const family of [pair.heading, pair.body]) {
        expect(BANNED_FONTS).not.toContain(family);
      }
    }
  });

  it("заголовок и текст не одно и то же семейство", () => {
    for (const pair of FONT_PAIRS) {
      expect(pair.heading).not.toBe(pair.body);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- catalog`
Expected: FAIL, `Cannot find module './index'`

- [ ] **Step 3: Написать скрипт сборки среза**

Создать `scripts/build-catalog.mjs`. Скрипт читает локальный каталог, берёт только нужные поля и пишет три JSON в `lib/catalog/`.

```js
// Пересборка среза каталога дизайн-данных.
// Источник лежит вне репозитория и в сборку не попадает, поэтому
// нужные поля вынимаются сюда один раз и коммитятся.
// Запуск: node scripts/build-catalog.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "node:path";

const SRC = "/Users/artemfrolov/.claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/data";

// Разбор CSV с кавычками: поля каталога содержат запятые внутри значений,
// поэтому split(",") здесь не работает.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [head, ...rest] = rows;
  return rest
    .filter((r) => r.length === head.length)
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Стили: только активные, только поля, которые уходят в промпт.
const styles = parseCsv(readFileSync(`${SRC}/styles.csv`, "utf8"))
  .filter((r) => r.Status === "active" && r["Style ID"])
  .map((r) => ({
    id: r["Style ID"],
    name: r["Style Category"],
    keywords: r.Keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 8),
    bestFor: r["Best For"],
    avoidFor: r["Do Not Use For"],
  }));

// Палитры: у источника нет собственного id, собираем из типа продукта.
const seen = new Map();
const palettes = parseCsv(readFileSync(`${SRC}/colors.csv`, "utf8"))
  .filter((r) => r.Primary?.startsWith("#"))
  .map((r) => {
    const base = slug(r["Product Type"]);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      id: n === 1 ? base : `${base}-${n}`,
      name: r["Product Type"],
      primary: r.Primary,
      onPrimary: r["On Primary"],
      accent: r.Accent,
      onAccent: r["On Accent"],
      background: r.Background,
      foreground: r.Foreground,
      muted: r.Muted,
      mutedForeground: r["Muted Foreground"],
      border: r.Border,
    };
  });

writeFileSync("lib/catalog/styles.json", JSON.stringify(styles, null, 2) + "\n");
writeFileSync("lib/catalog/palettes.json", JSON.stringify(palettes, null, 2) + "\n");
console.log(`стилей: ${styles.length}, палитр: ${palettes.length}`);
```

- [ ] **Step 4: Запустить скрипт**

```bash
mkdir -p lib/catalog scripts
node scripts/build-catalog.mjs
```
Expected: `стилей: 50` и более, `палитр: 190` и более. Точные числа зависят от версии каталога.

- [ ] **Step 5: Написать шрифтовые пары руками**

`typography.csv` для этого не годится: его первая же пара содержит Inter, а он запрещён. Пары собираются вручную из семейств, у которых кириллица подтверждена по колонке `Subsets` в `google-fonts.csv`.

Создать `lib/catalog/font-pairs.json`:

```json
[
  { "id": "editorial-classic", "heading": "Playfair Display", "body": "Source Serif 4",
    "mood": ["editorial", "classic", "premium"] },
  { "id": "editorial-modern", "heading": "Literata", "body": "PT Sans",
    "mood": ["editorial", "readable", "calm"] },
  { "id": "grotesque-clean", "heading": "Montserrat", "body": "Fira Sans",
    "mood": ["clean", "corporate", "neutral"] },
  { "id": "geometric-soft", "heading": "Jost", "body": "Rubik",
    "mood": ["geometric", "friendly", "modern"] },
  { "id": "serif-warm", "heading": "Lora", "body": "Onest",
    "mood": ["warm", "human", "craft"] },
  { "id": "serif-strict", "heading": "PT Serif", "body": "Plus Jakarta Sans",
    "mood": ["strict", "institutional", "trustworthy"] },
  { "id": "display-loud", "heading": "Unbounded", "body": "Onest",
    "mood": ["loud", "bold", "contemporary"] },
  { "id": "display-heavy", "heading": "Dela Gothic One", "body": "Rubik",
    "mood": ["heavy", "punchy", "urban"] },
  { "id": "condensed-poster", "heading": "Oswald", "body": "Merriweather",
    "mood": ["poster", "dense", "editorial"] },
  { "id": "antique-refined", "heading": "Cormorant Garamond", "body": "Raleway",
    "mood": ["refined", "elegant", "quiet"] },
  { "id": "tech-precise", "heading": "IBM Plex Mono", "body": "Fira Sans",
    "mood": ["technical", "precise", "engineering"] },
  { "id": "tech-terminal", "heading": "JetBrains Mono", "body": "Onest",
    "mood": ["technical", "terminal", "developer"] }
]
```

Кириллица всех двенадцати семейств подтверждена по `Subsets` при написании плана.

- [ ] **Step 6: Написать типизированный доступ**

Создать `lib/catalog/index.ts`:

```ts
import stylesJson from "./styles.json";
import palettesJson from "./palettes.json";
import fontPairsJson from "./font-pairs.json";

export interface Style {
  id: string;
  name: string;
  keywords: string[];
  bestFor: string;
  avoidFor: string;
}

export interface Palette {
  id: string;
  name: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

export interface FontPair {
  id: string;
  heading: string;
  body: string;
  mood: string[];
}

export const STYLES: Style[] = stylesJson;
export const PALETTES: Palette[] = palettesJson;
export const FONT_PAIRS: FontPair[] = fontPairsJson;

export const findStyle = (id: string) => STYLES.find((s) => s.id === id);
export const findPalette = (id: string) => PALETTES.find((p) => p.id === id);
export const findFontPair = (id: string) => FONT_PAIRS.find((f) => f.id === id);
```

- [ ] **Step 7: Прогнать тесты**

Run: `npm test -- catalog`
Expected: PASS, все четыре проверки.

Если тест на роли цвета падает — значит в `colors.csv` есть строки с пустыми ролями. Отфильтровать их в скрипте по тому же признаку, что и `Primary`, и пересобрать.

- [ ] **Step 8: Коммит**

```bash
git add scripts/build-catalog.mjs lib/catalog
git commit -m "Каталог: срез стилей, палитр и шрифтовых пар в репозиторий"
```

---

### Task 3: Словарь чипов

**Files:**
- Create: `lib/vocab.ts`
- Test: `lib/vocab.test.ts`

**Interfaces:**
- Consumes: `STYLES`, `findStyle` из `@/lib/catalog`
- Produces:
  - `CHARACTER_CHIPS: Chip[]` и `AESTHETIC_CHIPS: Chip[]`, где `Chip = { id: string; label: string; styleIds: string[] }`
  - `stylesForChips(chipIds: string[]): Style[]` — стили без повторов, в порядке появления

- [ ] **Step 1: Написать падающий тест**

Создать `lib/vocab.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CHARACTER_CHIPS, AESTHETIC_CHIPS, stylesForChips } from "./vocab";
import { findStyle } from "./catalog";

const ALL = [...CHARACTER_CHIPS, ...AESTHETIC_CHIPS];

describe("словарь чипов", () => {
  it("каждый чип ссылается на существующие стили каталога", () => {
    for (const chip of ALL) {
      expect(chip.styleIds.length).toBeGreaterThan(0);
      for (const id of chip.styleIds) {
        expect(findStyle(id), `чип «${chip.label}» ссылается на неизвестный стиль ${id}`).toBeDefined();
      }
    }
  });

  it("id чипов уникальны в обоих списках вместе", () => {
    expect(new Set(ALL.map((c) => c.id)).size).toBe(ALL.length);
  });

  it("подписи на русском", () => {
    for (const chip of ALL) expect(chip.label).toMatch(/[а-яё]/i);
  });

  it("stylesForChips собирает стили без повторов", () => {
    const withShared = [CHARACTER_CHIPS[0].id, CHARACTER_CHIPS[0].id];
    const result = stylesForChips(withShared);
    expect(new Set(result.map((s) => s.id)).size).toBe(result.length);
  });

  it("stylesForChips молча пропускает неизвестный чип", () => {
    expect(stylesForChips(["нет-такого"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- vocab`
Expected: FAIL, `Cannot find module './vocab'`

- [ ] **Step 3: Реализация**

Создать `lib/vocab.ts`. Значения `styleIds` брать из реального `lib/catalog/styles.json` — подсмотреть доступные id командой:

```bash
node -e "console.log(require('./lib/catalog/styles.json').map(s=>s.id).join('\n'))"
```

```ts
import { STYLES, type Style } from "./catalog";

export interface Chip {
  id: string;
  label: string;
  /** Стили каталога, которые это слово означает на языке данных. */
  styleIds: string[];
}

// Связка «бытовое слово → строки каталога» живёт здесь, а не в голове
// модели. Модель получает отобранные стили, а не слово «дерзкий».
export const CHARACTER_CHIPS: Chip[] = [
  { id: "warm", label: "тёплый",
    styleIds: ["nature-distilled", "organic-biophilic", "e-ink-paper"] },
  { id: "bold", label: "дерзкий",
    styleIds: ["neubrutalism", "exaggerated-minimalism", "vibrant-and-block-based"] },
  { id: "strict", label: "строгий",
    styleIds: ["minimalism-and-swiss-style", "flat-design", "fluent-2"] },
  { id: "craft", label: "ремесленный",
    styleIds: ["anti-polish-raw-aesthetic", "vintage-analog-retro-film", "e-ink-paper"] },
  { id: "technical", label: "техничный",
    styleIds: ["hud-sci-fi-fui", "data-dense-dashboard", "cyberpunk-ui"] },
  { id: "playful", label: "игривый",
    styleIds: ["claymorphism", "memphis-design", "tactile-digital-deformable-ui"] },
  { id: "premium", label: "премиальный",
    styleIds: ["dimensional-layering", "liquid-glass", "spatial-ui-visionos"] },
  { id: "calm", label: "спокойный",
    styleIds: ["e-ink-paper", "nature-distilled", "minimalism-and-swiss-style"] },
];

export const AESTHETIC_CHIPS: Chip[] = [
  { id: "minimal", label: "минимализм",
    styleIds: ["minimalism-and-swiss-style", "exaggerated-minimalism", "flat-design"] },
  { id: "editorial", label: "журнальная вёрстка",
    styleIds: ["editorial-grid-magazine", "e-ink-paper", "kinetic-typography"] },
  { id: "retro", label: "ретро",
    styleIds: ["retro-futurism", "y2k-aesthetic", "vintage-analog-retro-film", "pixel-art"] },
  { id: "brutal", label: "брутализм",
    styleIds: ["brutalism", "neubrutalism", "anti-polish-raw-aesthetic"] },
  { id: "organic", label: "природный",
    styleIds: ["organic-biophilic", "biomimetic-organic-2-0", "nature-distilled"] },
  { id: "geometric", label: "геометрия",
    styleIds: ["bauhaus", "bento-box-grid", "memphis-design"] },
  { id: "handmade", label: "рукотворный",
    styleIds: ["anti-polish-raw-aesthetic", "gen-z-chaos-maximalism", "vintage-analog-retro-film"] },
  { id: "futuristic", label: "футуризм",
    styleIds: ["hud-sci-fi-fui", "cyberpunk-ui", "spatial-ui-visionos", "liquid-glass"] },
];

const BY_ID = new Map([...CHARACTER_CHIPS, ...AESTHETIC_CHIPS].map((c) => [c.id, c]));

/** Стили для выбранных чипов, без повторов, в порядке появления. */
export function stylesForChips(chipIds: string[]): Style[] {
  const ids = new Set<string>();
  for (const chipId of chipIds) {
    for (const styleId of BY_ID.get(chipId)?.styleIds ?? []) ids.add(styleId);
  }
  return STYLES.filter((s) => ids.has(s.id));
}
```

Все шестнадцать наборов `styleIds` выше проверены по `lib/catalog/styles.json` при написании плана. Если каталог пересобирали и какой-то id исчез, тест из шага 1 назовёт конкретный чип и конкретный отсутствующий стиль.

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- vocab`
Expected: PASS, все пять проверок.

- [ ] **Step 5: Коммит**

```bash
git add lib/vocab.ts lib/vocab.test.ts
git commit -m "Словарь чипов: бытовые слова связаны со стилями каталога"
```

---

### Task 4: Схема брифа и индикатор полноты

**Files:**
- Create: `lib/brief-schema.ts`, `lib/brief-quality.ts`
- Test: `lib/brief-schema.test.ts`, `lib/brief-quality.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `BriefSchema` (zod), `type Brief = z.infer<typeof BriefSchema>`
  - `BRIEF_FIELDS: Record<keyof Brief, { min: number; max: number; label: string }>`
  - `stripEmpty(brief: Partial<Brief>): Partial<Brief>` — выкидывает пустые строки и пустые массивы
  - `briefFullness(brief: Partial<Brief>): { ratio: number; level: "thin" | "ok" | "rich"; note: string }`

- [ ] **Step 1: Написать падающий тест схемы**

Создать `lib/brief-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BriefSchema, BRIEF_FIELDS, stripEmpty } from "./brief-schema";

const valid = { brand: "Обжарочная «Зерно» в Казани, кофе для тех, кто варит дома" };

describe("схема брифа", () => {
  it("принимает бриф с одним заполненным полем", () => {
    expect(BriefSchema.safeParse(valid).success).toBe(true);
  });

  it("отвергает слишком короткое описание бренда", () => {
    expect(BriefSchema.safeParse({ brand: "кофе" }).success).toBe(false);
  });

  it("отвергает бриф без описания бренда", () => {
    expect(BriefSchema.safeParse({ audience: "молодые" }).success).toBe(false);
  });

  it("обрезает по верхней границе только через отказ, а не молча", () => {
    const long = { brand: "я".repeat(BRIEF_FIELDS.brand.max + 1) };
    expect(BriefSchema.safeParse(long).success).toBe(false);
  });
});

describe("stripEmpty", () => {
  it("выкидывает пустые строки и пустые массивы", () => {
    const result = stripEmpty({ ...valid, audience: "", characterChips: [], avoid: "   " });
    expect(result).toEqual(valid);
  });

  it("оставляет заполненные поля нетронутыми", () => {
    const full = { ...valid, audience: "домашние бариста", characterChips: ["warm"] };
    expect(stripEmpty(full)).toEqual(full);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- brief-schema`
Expected: FAIL, `Cannot find module './brief-schema'`

- [ ] **Step 3: Реализация схемы**

Создать `lib/brief-schema.ts`:

```ts
import { z } from "zod";

// Границы длины живут здесь и только здесь: из них собирается промпт
// и по ним валидируется вход. Иначе промпт разъезжается со схемой.
export const BRIEF_FIELDS = {
  brand: { min: 10, max: 600, label: "Что за бренд" },
  audience: { min: 0, max: 300, label: "Для кого" },
  characterFree: { min: 0, max: 200, label: "Характер, своими словами" },
  aestheticFree: { min: 0, max: 200, label: "Эстетика, своими словами" },
  avoid: { min: 0, max: 300, label: "Чего избегать" },
} as const;

export const BriefSchema = z.object({
  brand: z.string().min(BRIEF_FIELDS.brand.min).max(BRIEF_FIELDS.brand.max),
  audience: z.string().max(BRIEF_FIELDS.audience.max).optional(),
  characterChips: z.array(z.string()).max(8).optional(),
  characterFree: z.string().max(BRIEF_FIELDS.characterFree.max).optional(),
  aestheticChips: z.array(z.string()).max(8).optional(),
  aestheticFree: z.string().max(BRIEF_FIELDS.aestheticFree.max).optional(),
  avoid: z.string().max(BRIEF_FIELDS.avoid.max).optional(),
});

export type Brief = z.infer<typeof BriefSchema>;

/**
 * Убирает пустые поля. Модель не должна видеть "audience": "" —
 * из пустой строки она делает выводы, которых человек не давал.
 */
export function stripEmpty(brief: Partial<Brief>): Partial<Brief> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(brief)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    else if (Array.isArray(value) && value.length) out[key] = value;
  }
  return out as Partial<Brief>;
}
```

- [ ] **Step 4: Прогнать тест схемы**

Run: `npm test -- brief-schema`
Expected: PASS, все шесть проверок.

- [ ] **Step 5: Написать падающий тест индикатора полноты**

Создать `lib/brief-quality.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { briefFullness } from "./brief-quality";

describe("индикатор полноты брифа", () => {
  it("на пустом брифе даёт нулевую долю", () => {
    expect(briefFullness({}).ratio).toBe(0);
  });

  it("одно короткое поле — уровень thin и подсказка, чего не хватает", () => {
    const r = briefFullness({ brand: "Кофейня в Казани" });
    expect(r.level).toBe("thin");
    expect(r.note).toMatch(/[а-яё]/i);
  });

  it("заполненный бриф даёт уровень rich", () => {
    const r = briefFullness({
      brand: "Обжарочная «Зерно» в Казани. Обжариваем сами, каждую неделю новая партия.",
      audience: "Домашние бариста, покупают зерно раз в две недели",
      characterChips: ["warm", "craft"],
      aestheticChips: ["minimal"],
      avoid: "Без деревенской избы и без мешковины",
    });
    expect(r.level).toBe("rich");
    expect(r.ratio).toBeGreaterThan(0.7);
  });

  it("доля никогда не превышает единицу", () => {
    const r = briefFullness({
      brand: "я".repeat(600),
      audience: "я".repeat(300),
      characterChips: ["a", "b", "c"],
      aestheticChips: ["d", "e"],
      characterFree: "я".repeat(200),
      aestheticFree: "я".repeat(200),
      avoid: "я".repeat(300),
    });
    expect(r.ratio).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 6: Убедиться, что тест падает**

Run: `npm test -- brief-quality`
Expected: FAIL, `Cannot find module './brief-quality'`

- [ ] **Step 7: Реализация индикатора**

Создать `lib/brief-quality.ts`:

```ts
import type { Brief } from "./brief-schema";

type Level = "thin" | "ok" | "rich";

// Вес каждого сигнала в общей полноте. Описание бренда весит больше
// остального: без него направления вырождаются в общие слова.
const WEIGHTS = { brand: 0.4, audience: 0.2, character: 0.15, aesthetic: 0.15, avoid: 0.1 };

const filled = (v: string | undefined, enough: number) =>
  Math.min((v?.trim().length ?? 0) / enough, 1);

const chosen = (chips: string[] | undefined, free: string | undefined) =>
  chips?.length || free?.trim() ? 1 : 0;

export function briefFullness(brief: Partial<Brief>): {
  ratio: number;
  level: Level;
  note: string;
} {
  const ratio =
    WEIGHTS.brand * filled(brief.brand, 120) +
    WEIGHTS.audience * filled(brief.audience, 60) +
    WEIGHTS.character * chosen(brief.characterChips, brief.characterFree) +
    WEIGHTS.aesthetic * chosen(brief.aestheticChips, brief.aestheticFree) +
    WEIGHTS.avoid * filled(brief.avoid, 40);

  const level: Level = ratio >= 0.7 ? "rich" : ratio >= 0.4 ? "ok" : "thin";

  // Подсказка называет ровно то, чего не хватает больше всего,
  // а не ругает человека за короткий текст вообще.
  let note = "Хватит на три направления";
  if (!brief.brand?.trim()) note = "Начните с описания бренда";
  else if (filled(brief.brand, 120) < 0.5) note = "Расскажите о бренде подробнее";
  else if (!brief.audience?.trim()) note = "Будет точнее, если добавить аудиторию";
  else if (!chosen(brief.characterChips, brief.characterFree)) note = "Выберите характер";
  else if (!chosen(brief.aestheticChips, brief.aestheticFree)) note = "Выберите эстетику";
  else if (!brief.avoid?.trim()) note = "Можно добавить, чего избегать";

  return { ratio: Math.min(ratio, 1), level, note };
}
```

- [ ] **Step 8: Прогнать оба теста**

Run: `npm test -- brief`
Expected: PASS, десять проверок.

- [ ] **Step 9: Коммит**

```bash
git add lib/brief-schema.ts lib/brief-schema.test.ts lib/brief-quality.ts lib/brief-quality.test.ts
git commit -m "Схема брифа и индикатор полноты"
```

---

### Task 5: Разбор потока, перенос из vyveska

**Files:**
- Create: `lib/stream.ts`, `lib/stream.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `parseSSEBuffer(buffer: string): { chunks: string[]; remainder: string; finishReason: string | null }`
  - `parseSectionBuffer(buffer: string): { sections: SectionChunk[]; remainder: string }`
  - `interface SectionChunk { section: string; data: unknown }`

- [ ] **Step 1: Скопировать файл и его тесты**

```bash
cp /Users/artemfrolov/vyveska/lib/stream.ts lib/stream.ts
cp /Users/artemfrolov/vyveska/lib/stream.test.ts lib/stream.test.ts
```

Код переносится без правок. Он уже разбирает SSE Polza, отдаёт `finish_reason` и возвращает недособранный хвост в остатке.

- [ ] **Step 2: Прогнать перенесённые тесты**

Run: `npm test -- stream`
Expected: PASS. Если падает на импортах — поправить пути под алиас `@/`, логику не трогать.

- [ ] **Step 3: Дописать тест на хвост без перевода строки**

Это главная грабля из vyveska: апстрим не завершает ответ переводом строки, и последняя секция теряется всегда. Убедиться, что такой тест есть; если его нет — дописать в `lib/stream.test.ts`:

```ts
it("последняя строка без перевода строки уходит в остаток, а не теряется", () => {
  const { sections, remainder } = parseSectionBuffer('{"section":"a","data":1}\n{"section":"b","data":2}');
  expect(sections).toHaveLength(1);
  expect(remainder).toBe('{"section":"b","data":2}');

  const tail = parseSectionBuffer(`${remainder}\n`);
  expect(tail.sections).toHaveLength(1);
  expect(tail.sections[0].section).toBe("b");
});
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- stream`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add lib/stream.ts lib/stream.test.ts
git commit -m "Разбор SSE и построчного JSON, перенос из vyveska"
```

---

### Task 6: Суточный лимит

**Files:**
- Create: `lib/rate-limit.ts`, `lib/redis.ts`
- Test: `lib/rate-limit.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `extractIp(headerValue: string | null | undefined): string`
  - `ipHash(ip: string, salt: string): string`
  - `parseDailyLimit(value: string | undefined): number`, `DAILY_LIMIT: number`
  - `isOverLimit(count: number): boolean`
  - `limitKey(hash: string, now: Date): string`
  - `redis: Redis` из `lib/redis.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `lib/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractIp, ipHash, parseDailyLimit, isOverLimit, limitKey } from "./rate-limit";

describe("извлечение адреса", () => {
  it("берёт первый адрес из списка прокси", () => {
    expect(extractIp("203.0.113.7, 70.41.3.18")).toBe("203.0.113.7");
  });

  it("на пустом заголовке даёт заглушку", () => {
    expect(extractIp(null)).toBe("0.0.0.0");
    expect(extractIp("")).toBe("0.0.0.0");
  });
});

describe("хеш адреса", () => {
  it("одинаковый вход даёт одинаковый хеш", () => {
    expect(ipHash("203.0.113.7", "соль")).toBe(ipHash("203.0.113.7", "соль"));
  });

  it("разная соль даёт разный хеш", () => {
    expect(ipHash("203.0.113.7", "а")).not.toBe(ipHash("203.0.113.7", "б"));
  });

  it("сырой адрес в хеше не виден", () => {
    expect(ipHash("203.0.113.7", "соль")).not.toContain("203.0.113.7");
  });
});

describe("потолок", () => {
  it("мусор в переменной окружения даёт значение по умолчанию 2", () => {
    expect(parseDailyLimit(undefined)).toBe(2);
    expect(parseDailyLimit("не число")).toBe(2);
    expect(parseDailyLimit("0")).toBe(2);
    expect(parseDailyLimit("-5")).toBe(2);
  });

  it("целое положительное значение принимается", () => {
    expect(parseDailyLimit("7")).toBe(7);
  });

  it("isOverLimit срабатывает, когда счётчик догнал потолок", () => {
    expect(isOverLimit(0)).toBe(false);
    expect(isOverLimit(2)).toBe(true);
    expect(isOverLimit(3)).toBe(true);
  });
});

describe("ключ суток", () => {
  it("один и тот же день даёт один ключ", () => {
    const a = limitKey("abc", new Date("2026-09-03T01:00:00Z"));
    const b = limitKey("abc", new Date("2026-09-03T23:00:00Z"));
    expect(a).toBe(b);
  });

  it("разные дни дают разные ключи", () => {
    const a = limitKey("abc", new Date("2026-09-03T23:00:00Z"));
    const b = limitKey("abc", new Date("2026-09-04T01:00:00Z"));
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- rate-limit`
Expected: FAIL, `Cannot find module './rate-limit'`

- [ ] **Step 3: Реализация**

Создать `lib/rate-limit.ts`:

```ts
import { createHash } from "node:crypto";

// Публичная демка с ключом роутера: при ~37 ₽ за полный проход
// потолок держим низким. Значение поднимается только через
// переменную окружения для локальной отладки.
const DEFAULT_DAILY_LIMIT = 2;

export function parseDailyLimit(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

export const DAILY_LIMIT = parseDailyLimit(process.env.DAILY_LIMIT);

export function ipHash(ip: string, salt: string): string {
  return createHash("sha256").update(`${ip}${salt}`).digest("hex");
}

export function isOverLimit(count: number): boolean {
  return count >= DAILY_LIMIT;
}

/**
 * Заголовок X-Forwarded-For содержит список адресов через запятую:
 * каждый прокси дописывает свой, ближайший к клиенту стоит первым.
 */
export function extractIp(headerValue: string | null | undefined): string {
  const first = headerValue?.split(",")[0]?.trim();
  return first || "0.0.0.0";
}

/**
 * Ключ счётчика с датой внутри. Счётчику ставится TTL на сутки,
 * но дата в ключе делает переход через полночь однозначным даже
 * если TTL не сработал.
 */
export function limitKey(hash: string, now: Date): string {
  return `brief:${now.toISOString().slice(0, 10)}:${hash}`;
}
```

Создать `lib/redis.ts`:

```ts
import { Redis } from "@upstash/redis";

// Интеграция Vercel кладёт переменные с префиксом KV_, отдельная
// установка Upstash — с префиксом UPSTASH_. Поддерживаем оба, чтобы
// локальная отладка и боевой адрес не расходились.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const DAY_SECONDS = 24 * 60 * 60;
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- rate-limit`
Expected: PASS, все девять проверок.

- [ ] **Step 5: Коммит**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts lib/redis.ts
git commit -m "Суточный лимит: хеш адреса, ключ суток, потолок 2"
```

---

### Task 7: Схема ответа модели и системный промпт

**Files:**
- Create: `lib/directions-schema.ts`, `lib/prompt.ts`
- Test: `lib/directions-schema.test.ts`, `lib/prompt.test.ts`

**Interfaces:**
- Consumes: `Brief`, `BRIEF_FIELDS` из `@/lib/brief-schema`; `Style`, `Palette`, `FontPair`, `PALETTES`, `FONT_PAIRS` из `@/lib/catalog`; `stylesForChips` из `@/lib/vocab`
- Produces:
  - `DIRECTION_KEYS = ["safe", "bold", "experimental"] as const`
  - `DirectionSchema` (zod), `type Direction = z.infer<typeof DirectionSchema>`
  - `DIRECTION_FIELDS: Record<string, { min: number; max: number }>`
  - `buildSystemPrompt(styles: Style[], palettes: Palette[], fontPairs: FontPair[]): string`
  - `buildUserMessage(brief: Partial<Brief>): string`

- [ ] **Step 1: Написать падающий тест схемы**

Создать `lib/directions-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DirectionSchema, DIRECTION_KEYS } from "./directions-schema";
import { PALETTES, FONT_PAIRS, STYLES } from "./catalog";

const valid = {
  key: "safe",
  name: "Тихое ремесло",
  concept: "Направление держится на спокойной бумажной палитре и крупной серифной подаче. Оно говорит о ручной работе без деревенских клише.",
  keywords: ["бумага", "ручная работа", "тепло", "спокойствие"],
  styleId: STYLES[0].id,
  paletteId: PALETTES[0].id,
  fontPairId: FONT_PAIRS[0].id,
  rationale: "Аудитория покупает зерно домой, ей ближе домашняя интонация, а не витрина сетевой кофейни.",
};

describe("схема направления", () => {
  it("принимает корректное направление", () => {
    expect(DirectionSchema.safeParse(valid).success).toBe(true);
  });

  it("отвергает ключ вне трёх разрешённых", () => {
    expect(DirectionSchema.safeParse({ ...valid, key: "safe2" }).success).toBe(false);
  });

  it("отвергает несуществующий id палитры", () => {
    expect(DirectionSchema.safeParse({ ...valid, paletteId: "нет-такой" }).success).toBe(false);
  });

  it("отвергает несуществующий id шрифтовой пары", () => {
    expect(DirectionSchema.safeParse({ ...valid, fontPairId: "нет-такой" }).success).toBe(false);
  });

  it("отвергает пустой список ключевых слов", () => {
    expect(DirectionSchema.safeParse({ ...valid, keywords: [] }).success).toBe(false);
  });

  it("ключи направлений ровно Safe, Bold, Experimental", () => {
    expect([...DIRECTION_KEYS]).toEqual(["safe", "bold", "experimental"]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- directions-schema`
Expected: FAIL, `Cannot find module './directions-schema'`

- [ ] **Step 3: Реализация схемы**

Создать `lib/directions-schema.ts`:

```ts
import { z } from "zod";
import { STYLES, PALETTES, FONT_PAIRS } from "./catalog";

export const DIRECTION_KEYS = ["safe", "bold", "experimental"] as const;
export type DirectionKey = (typeof DIRECTION_KEYS)[number];

// Границы длины, из которых собирается промпт. Один источник правды
// на текст инструкции и на проверку ответа.
export const DIRECTION_FIELDS = {
  name: { min: 3, max: 40 },
  concept: { min: 80, max: 400 },
  rationale: { min: 40, max: 300 },
} as const;

const styleIds = new Set(STYLES.map((s) => s.id));
const paletteIds = new Set(PALETTES.map((p) => p.id));
const fontPairIds = new Set(FONT_PAIRS.map((f) => f.id));

// Идентификаторы проверяются по каталогу, а не по формату строки:
// модель охотно выдумывает правдоподобные id, которых не существует.
export const DirectionSchema = z.object({
  key: z.enum(DIRECTION_KEYS),
  name: z.string().min(DIRECTION_FIELDS.name.min).max(DIRECTION_FIELDS.name.max),
  concept: z.string().min(DIRECTION_FIELDS.concept.min).max(DIRECTION_FIELDS.concept.max),
  keywords: z.array(z.string().min(2).max(30)).min(3).max(6),
  styleId: z.string().refine((v) => styleIds.has(v), "неизвестный стиль"),
  paletteId: z.string().refine((v) => paletteIds.has(v), "неизвестная палитра"),
  fontPairId: z.string().refine((v) => fontPairIds.has(v), "неизвестная пара шрифтов"),
  rationale: z.string().min(DIRECTION_FIELDS.rationale.min).max(DIRECTION_FIELDS.rationale.max),
});

export type Direction = z.infer<typeof DirectionSchema>;
```

- [ ] **Step 4: Прогнать тест схемы**

Run: `npm test -- directions-schema`
Expected: PASS, все шесть проверок.

- [ ] **Step 5: Написать падающий тест промпта**

Создать `lib/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { DIRECTION_FIELDS } from "./directions-schema";
import { STYLES, PALETTES, FONT_PAIRS } from "./catalog";

const prompt = buildSystemPrompt(STYLES.slice(0, 3), PALETTES.slice(0, 5), FONT_PAIRS.slice(0, 4));

describe("системный промпт", () => {
  it("называет все три направления", () => {
    for (const key of ["safe", "bold", "experimental"]) expect(prompt).toContain(key);
  });

  it("границы длины берутся из схемы, а не вписаны руками", () => {
    expect(prompt).toContain(String(DIRECTION_FIELDS.concept.max));
    expect(prompt).toContain(String(DIRECTION_FIELDS.rationale.min));
  });

  it("перечисляет переданные id каталога", () => {
    expect(prompt).toContain(PALETTES[0].id);
    expect(prompt).toContain(FONT_PAIRS[0].id);
    expect(prompt).toContain(STYLES[0].id);
  });

  it("не перечисляет палитры, которых не передавали", () => {
    const omitted = PALETTES.slice(5).find((p) => !PALETTES.slice(0, 5).some((x) => x.id === p.id));
    expect(omitted).toBeDefined();
    expect(prompt).not.toContain(omitted!.id);
  });

  it("запрещает длинные тире", () => {
    expect(prompt).toContain("—");
    expect(prompt.toLowerCase()).toContain("тире");
  });
});

describe("сообщение пользователя", () => {
  it("не включает пустые поля", () => {
    const msg = buildUserMessage({ brand: "Кофейня «Зерно»", audience: "" });
    expect(msg).toContain("Кофейня «Зерно»");
    expect(msg).not.toContain("audience");
  });

  it("подписывает поля по-русски", () => {
    const msg = buildUserMessage({ brand: "Кофейня «Зерно»", avoid: "без мешковины" });
    expect(msg).toContain("без мешковины");
  });
});
```

- [ ] **Step 6: Убедиться, что тест падает**

Run: `npm test -- prompt`
Expected: FAIL, `Cannot find module './prompt'`

- [ ] **Step 7: Реализация промпта**

Создать `lib/prompt.ts`:

```ts
import { DIRECTION_FIELDS, DIRECTION_KEYS } from "./directions-schema";
import { BRIEF_FIELDS, type Brief } from "./brief-schema";
import type { Style, Palette, FontPair } from "./catalog";

// Промпт собирается из схемы и из переданного среза каталога.
// Числа не вписываются руками: иначе текст инструкции разъезжается
// с проверкой ответа, и разъезд ловится только на бою.
const skeleton = DIRECTION_KEYS.map(
  (key) =>
    `{"section":"direction","data":{"key":"${key}","name":"...","concept":"...",` +
    `"keywords":["..."],"styleId":"...","paletteId":"...","fontPairId":"...","rationale":"..."}}`
).join("\n");

export function buildSystemPrompt(
  styles: Style[],
  palettes: Palette[],
  fontPairs: FontPair[]
): string {
  const styleList = styles
    .map((s) => `- ${s.id}: ${s.keywords.join(", ")}. Годится для: ${s.bestFor}`)
    .join("\n");

  const paletteList = palettes
    .map((p) => `- ${p.id}: основной ${p.primary}, акцент ${p.accent}, фон ${p.background}`)
    .join("\n");

  const fontList = fontPairs
    .map((f) => `- ${f.id}: ${f.heading} для заголовков, ${f.body} для текста (${f.mood.join(", ")})`)
    .join("\n");

  return `Ты арт-директор. По брифу о бренде предлагаешь три визуальных направления.

Отвечай СТРОГО построчным JSON: одна строка — один объект, без markdown, без пояснений.
Три строки, ровно в этом порядке:

${skeleton}

Что означают ключи направлений:
— safe: проверенное решение, которое точно не подведёт. Узнаваемое, спокойное.
— bold: заметное решение с характером. Рискует ради того, чтобы запомниться.
— experimental: решение на грани. Может не подойти всем, но задаёт свой язык.

Три направления должны различаться по существу, а не подбором синонимов.
Если safe и bold опираются на одну палитру и одну пару шрифтов — переделай.

Выбирай ТОЛЬКО из этих списков. Идентификаторов вне списков не существует,
выдумывать их нельзя.

Стили:
${styleList}

Палитры:
${paletteList}

Пары шрифтов:
${fontList}

Правила текста:
— Только русский язык, независимо от языка брифа.
— name — ${DIRECTION_FIELDS.name.min}–${DIRECTION_FIELDS.name.max} знаков, живое название направления, а не ярлык «Вариант 1».
— concept — ${DIRECTION_FIELDS.concept.min}–${DIRECTION_FIELDS.concept.max} знаков: как направление выглядит и что оно говорит о бренде.
— rationale — ${DIRECTION_FIELDS.rationale.min}–${DIRECTION_FIELDS.rationale.max} знаков: почему это подходит именно этому бренду и его аудитории.
— keywords — от 3 до 6 слов, по-русски, конкретных. «Современно» и «стильно» не годятся.
— Опирайся на то, что человек рассказал. Не придумывай фактов о бренде:
  ни города, ни года основания, ни числа сотрудников, ни цен.
— Если человек указал, чего избегать, — это запрет, а не пожелание.
— НИКАКИХ длинных тире (—). Это первое, по чему читатель узнаёт текст
  нейросети. Ставь точку и начинай новое предложение или обходись запятой.

ЗАПРЕЩЕНЫ обороты: «инновационные решения», «уникальный стиль»,
«индивидуальный подход», «современный и стильный», «динамичный бренд».`;
}

const LABELS: Record<string, string> = {
  brand: BRIEF_FIELDS.brand.label,
  audience: BRIEF_FIELDS.audience.label,
  characterChips: "Характер, выбранные слова",
  characterFree: BRIEF_FIELDS.characterFree.label,
  aestheticChips: "Эстетика, выбранные слова",
  aestheticFree: BRIEF_FIELDS.aestheticFree.label,
  avoid: BRIEF_FIELDS.avoid.label,
};

/** Бриф человеку понятным текстом. Пустые поля сюда не доходят. */
export function buildUserMessage(brief: Partial<Brief>): string {
  return Object.entries(brief)
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(", ") : value;
      return `${LABELS[key] ?? key}: ${text}`;
    })
    .join("\n");
}
```

- [ ] **Step 8: Прогнать тесты**

Run: `npm test -- prompt directions-schema`
Expected: PASS, тринадцать проверок.

- [ ] **Step 9: Коммит**

```bash
git add lib/directions-schema.ts lib/directions-schema.test.ts lib/prompt.ts lib/prompt.test.ts
git commit -m "Схема трёх направлений и промпт, собранный из схемы и каталога"
```

---

### Task 8: Route handler

**Files:**
- Create: `app/api/directions/route.ts`
- Test: `app/api/directions/route.test.ts`

**Interfaces:**
- Consumes: всё из задач 2–7
- Produces: `POST /api/directions`, тело `Brief`, ответ — построчный JSON `{"section":"direction","data":{...}}` либо JSON с полем `error` и кодом 400 / 429 / 502

- [ ] **Step 1: Написать падающий тест**

Создать `app/api/directions/route.test.ts`. Тестируются только ответы, которые не ходят наружу: разбор тела и валидация.

```ts
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
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- route`
Expected: FAIL, `Cannot find module './route'`

- [ ] **Step 3: Реализация**

Создать `app/api/directions/route.ts`:

```ts
import { BriefSchema, stripEmpty } from "@/lib/brief-schema";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { parseSSEBuffer, parseSectionBuffer } from "@/lib/stream";
import { STYLES, PALETTES, FONT_PAIRS } from "@/lib/catalog";
import { stylesForChips } from "@/lib/vocab";
import { extractIp, ipHash, isOverLimit, limitKey } from "@/lib/rate-limit";
import { redis, DAY_SECONDS } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENDPOINT = "https://polza.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-5";

// Сколько строк каталога уезжает в промпт, когда человек не выбрал чипы.
// Весь каталог не отправляем: он в разы дороже самого брифа.
const FALLBACK_STYLES = 12;
const PROMPT_PALETTES = 24;

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json(
      { error: "Не удалось прочитать запрос. Проверьте формат данных." },
      { status: 400 }
    );
  }

  // Валидное JSON-тело может оказаться null, строкой, числом или массивом.
  // Приводим к пустому объекту, чтобы дальше сработала одна и та же проверка.
  const body =
    typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)
      ? rawBody
      : {};

  const parsed = BriefSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Расскажите о бренде хотя бы одним предложением." },
      { status: 400 }
    );
  }

  const brief = stripEmpty(parsed.data);

  // Суточный лимит на хеш адреса. Сырой IP считается только ради хеша
  // и никуда не сохраняется.
  const ip = extractIp(req.headers.get("x-forwarded-for"));
  const hash = ipHash(ip, process.env.APP_SALT!);
  const key = limitKey(hash, new Date());

  // Хранилище недоступно — лимит не срабатывает и генерация идёт.
  // Доступность важнее экономии на одном проходе.
  let count = 0;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, DAY_SECONDS);
  } catch {
    count = 0;
  }

  if (isOverLimit(count)) {
    return Response.json(
      { error: "На сегодня хватит. Лимит снимется через сутки после первой сборки." },
      { status: 429 }
    );
  }

  // Чипы человека сужают каталог. Ничего не выбрал — даём срез по умолчанию.
  const chips = [...(brief.characterChips ?? []), ...(brief.aestheticChips ?? [])];
  const chosen = stylesForChips(chips);
  const styles = chosen.length ? chosen : STYLES.slice(0, FALLBACK_STYLES);

  const upstream = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.POLZA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // Текст трёх направлений занимает около 1200 токенов, остальное
      // съедают рассуждения модели перед ответом. Платим за
      // использованные токены, а не за потолок, поэтому запас бесплатен.
      max_tokens: 6000,
      stream: true,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(styles, PALETTES.slice(0, PROMPT_PALETTES), FONT_PAIRS),
        },
        { role: "user", content: buildUserMessage(brief) },
      ],
    }),
    // Клиент ушёл со страницы — рвём запрос к модели, не дочитываем
    // и не оплачиваем токены впустую.
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "Не удалось собрать направления. Попробуйте ещё раз." },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  // Платформа могла уже перевести controller в состояние cancel:
  // второй вызов close или error на нём бросит исключение.
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let sseBuffer = "";
      let textBuffer = "";
      let finishReason: string | null = null;
      let delivered = 0;

      const flush = (sections: { section: string; data: unknown }[]) => {
        for (const chunk of sections) {
          controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
          delivered++;
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const sse = parseSSEBuffer(sseBuffer);
          sseBuffer = sse.remainder;
          finishReason = sse.finishReason ?? finishReason;

          textBuffer += sse.chunks.join("");
          const parsedChunk = parseSectionBuffer(textBuffer);
          textBuffer = parsedChunk.remainder;
          flush(parsedChunk.sections);
        }

        if (!cancelled) {
          // Апстрим не завершает ответ переводом строки: последняя строка
          // построчного JSON оседает в остатке обоих буферов до чтения,
          // которого уже не будет. Без этого хвоста третье направление
          // теряется всегда.
          sseBuffer += decoder.decode();
          const tail = parseSSEBuffer(`${sseBuffer}\n`);
          textBuffer += tail.chunks.join("");
          finishReason = tail.finishReason ?? finishReason;
          flush(parseSectionBuffer(`${textBuffer}\n`).sections);

          if (delivered < 3) {
            // Обрыв генерации и несошедшаяся схема для человека выглядят
            // одинаково. Причину видно только здесь.
            console.error(
              `[directions] пришло ${delivered}/3, finish_reason: ${finishReason ?? "не пришёл"}`
            );
          }

          controller.close();
        }
      } catch (error) {
        if (!cancelled) controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      cancelled = true;
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- route`
Expected: PASS, все четыре проверки.

- [ ] **Step 5: Проверить, что ключ не уехал в клиентский бандл**

```bash
npm run build
grep -r "POLZA_API_KEY" .next/static/ && echo "КЛЮЧ В БАНДЛЕ, ОСТАНОВИТЬСЯ" || echo "в клиентском бандле ключа нет"
```
Expected: `в клиентском бандле ключа нет`.

- [ ] **Step 6: Коммит**

```bash
git add app/api/directions
git commit -m "Route handler: валидация, суточный лимит, проксирование потока"
```

---

### Task 9: Накопление направлений

**Files:**
- Create: `lib/directions-state.ts`
- Test: `lib/directions-state.test.ts`

**Interfaces:**
- Consumes: `Direction`, `DirectionSchema`, `DIRECTION_KEYS` из `@/lib/directions-schema`; `SectionChunk` из `@/lib/stream`
- Produces:
  - `accumulate(current: Direction[], chunks: SectionChunk[]): Direction[]`
  - `isComplete(directions: Direction[]): boolean`

- [ ] **Step 1: Написать падающий тест**

Создать `lib/directions-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { accumulate, isComplete } from "./directions-state";
import { STYLES, PALETTES, FONT_PAIRS } from "./catalog";

const make = (key: string) => ({
  section: "direction",
  data: {
    key,
    name: "Название",
    concept: "к".repeat(100),
    keywords: ["раз", "два", "три"],
    styleId: STYLES[0].id,
    paletteId: PALETTES[0].id,
    fontPairId: FONT_PAIRS[0].id,
    rationale: "р".repeat(50),
  },
});

describe("накопление направлений", () => {
  it("из трёх кусков собирает три направления", () => {
    const result = accumulate([], [make("safe"), make("bold"), make("experimental")]);
    expect(result).toHaveLength(3);
    expect(isComplete(result)).toBe(true);
  });

  it("накапливает по одному куску за раз", () => {
    let state = accumulate([], [make("safe")]);
    expect(isComplete(state)).toBe(false);
    state = accumulate(state, [make("bold")]);
    state = accumulate(state, [make("experimental")]);
    expect(isComplete(state)).toBe(true);
  });

  it("повтор того же ключа перезаписывает, а не удваивает", () => {
    const state = accumulate([], [make("safe"), make("safe")]);
    expect(state).toHaveLength(1);
  });

  it("направление, не прошедшее схему, молча отбрасывается", () => {
    const broken = { section: "direction", data: { key: "safe", name: "х" } };
    expect(accumulate([], [broken])).toHaveLength(0);
  });

  it("кусок с неизвестной секцией отбрасывается", () => {
    expect(accumulate([], [{ section: "мусор", data: {} }])).toHaveLength(0);
  });

  it("порядок всегда safe, bold, experimental, независимо от прихода", () => {
    const result = accumulate([], [make("experimental"), make("safe"), make("bold")]);
    expect(result.map((d) => d.key)).toEqual(["safe", "bold", "experimental"]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- directions-state`
Expected: FAIL, `Cannot find module './directions-state'`

- [ ] **Step 3: Реализация**

Создать `lib/directions-state.ts`:

```ts
import { DirectionSchema, DIRECTION_KEYS, type Direction } from "./directions-schema";
import type { SectionChunk } from "./stream";

/**
 * Применяет разобранные куски потока к уже накопленным направлениям.
 * Кусок, не прошедший схему, молча отбрасывается: это защита от мусора
 * в потоке, а не рабочий сценарий. Повтор того же ключа перезаписывает
 * прежнее значение — последняя строка в потоке побеждает.
 */
export function accumulate(current: Direction[], chunks: SectionChunk[]): Direction[] {
  const byKey = new Map(current.map((d) => [d.key, d]));

  for (const { section, data } of chunks) {
    if (section !== "direction") continue;
    const parsed = DirectionSchema.safeParse(data);
    if (parsed.success) byKey.set(parsed.data.key, parsed.data);
  }

  // Порядок задаём мы, а не апстрим: карточки не должны прыгать местами
  // от того, в каком порядке модель их дописала.
  return DIRECTION_KEYS.map((key) => byKey.get(key)).filter(
    (d): d is Direction => d !== undefined
  );
}

/** Готово, когда пришли все три направления. */
export function isComplete(directions: Direction[]): boolean {
  return directions.length === DIRECTION_KEYS.length;
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- directions-state`
Expected: PASS, все шесть проверок.

- [ ] **Step 5: Коммит**

```bash
git add lib/directions-state.ts lib/directions-state.test.ts
git commit -m "Накопление направлений из кусков потока"
```

---

### Task 10: Форма брифа

**Files:**
- Create: `components/brief/ChipGroup.tsx`, `components/brief/BriefForm.tsx`
- Create: `styles/tokens.css`, `styles/brief.css`
- Modify: `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `Brief`, `BRIEF_FIELDS` из `@/lib/brief-schema`; `briefFullness` из `@/lib/brief-quality`; `CHARACTER_CHIPS`, `AESTHETIC_CHIPS` из `@/lib/vocab`
- Produces:
  - `<ChipGroup chips={Chip[]} selected={string[]} onToggle={(id: string) => void} freeText={string} onFreeTextChange={(v: string) => void} placeholder={string} />`
  - `<BriefForm brief={Partial<Brief>} onChange={(b: Partial<Brief>) => void} onSubmit={(b: Partial<Brief>) => void} disabled={boolean} />`

Перед вёрсткой вызвать скилл `frontend-design`. Оболочка нейтральная: сгенерированная палитра сюда не попадает. Шрифты интерфейса — из проверенного кириллического набора, не Inter.

- [ ] **Step 1: Токены оформления**

Создать `styles/tokens.css` с переменными в `oklch`: шкала кегля через `clamp`, вертикальный ритм, длительности и кривые анимации. Собственные значения, не копия vyveska. Фон не сплошной цветом — слоистые градиенты или текстура.

- [ ] **Step 2: ChipGroup**

Создать `components/brief/ChipGroup.tsx`:

```tsx
"use client";

import type { Chip } from "@/lib/vocab";

export function ChipGroup({
  chips,
  selected,
  onToggle,
  freeText,
  onFreeTextChange,
  placeholder,
}: {
  chips: Chip[];
  selected: string[];
  onToggle: (id: string) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  placeholder: string;
}) {
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
      <input
        className="chip-free"
        value={freeText}
        placeholder={placeholder}
        onChange={(e) => onFreeTextChange(e.target.value)}
      />
    </div>
  );
}
```

Состояние выбора — через `aria-pressed`, не через класс: так оно доступно с клавиатуры и скринридеру бесплатно. Стили вешать на `[aria-pressed="true"]`.

- [ ] **Step 3: BriefForm**

Создать `components/brief/BriefForm.tsx`. Поля: `brand` (textarea, обязательное), `audience` (input), два `ChipGroup`, `avoid` (input). Индикатор полноты из `briefFullness`, подсказка в `aria-live="polite"`. Кнопка отключена, пока `brand` короче `BRIEF_FIELDS.brand.min`.

```tsx
"use client";

import { BRIEF_FIELDS, type Brief } from "@/lib/brief-schema";
import { briefFullness } from "@/lib/brief-quality";
import { CHARACTER_CHIPS, AESTHETIC_CHIPS } from "@/lib/vocab";
import { ChipGroup } from "./ChipGroup";

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
  const canSubmit = (brief.brand?.trim().length ?? 0) >= BRIEF_FIELDS.brand.min && !disabled;

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
      <label htmlFor="brand">{BRIEF_FIELDS.brand.label}</label>
      <textarea
        id="brand"
        rows={4}
        maxLength={BRIEF_FIELDS.brand.max}
        value={brief.brand ?? ""}
        onChange={(e) => set("brand", e.target.value)}
        placeholder="Обжарочная «Зерно» в Казани. Обжариваем сами, каждую неделю новая партия. Продаём зерно тем, кто варит дома."
      />

      <label htmlFor="audience">{BRIEF_FIELDS.audience.label}</label>
      <input
        id="audience"
        maxLength={BRIEF_FIELDS.audience.max}
        value={brief.audience ?? ""}
        onChange={(e) => set("audience", e.target.value)}
        placeholder="Домашние бариста, берут зерно раз в две недели"
      />

      <fieldset>
        <legend>Характер</legend>
        <ChipGroup
          chips={CHARACTER_CHIPS}
          selected={brief.characterChips ?? []}
          onToggle={(id) => toggle("characterChips", id)}
          freeText={brief.characterFree ?? ""}
          onFreeTextChange={(v) => set("characterFree", v)}
          placeholder="Или своими словами"
        />
      </fieldset>

      <fieldset>
        <legend>Эстетика</legend>
        <ChipGroup
          chips={AESTHETIC_CHIPS}
          selected={brief.aestheticChips ?? []}
          onToggle={(id) => toggle("aestheticChips", id)}
          freeText={brief.aestheticFree ?? ""}
          onFreeTextChange={(v) => set("aestheticFree", v)}
          placeholder="Или своими словами"
        />
      </fieldset>

      <label htmlFor="avoid">{BRIEF_FIELDS.avoid.label}</label>
      <input
        id="avoid"
        maxLength={BRIEF_FIELDS.avoid.max}
        value={brief.avoid ?? ""}
        onChange={(e) => set("avoid", e.target.value)}
        placeholder="Без деревенской избы и мешковины"
      />

      <div className="fullness" data-level={fullness.level}>
        <span className="fullness-track">
          <span className="fullness-fill" style={{ inlineSize: `${Math.round(fullness.ratio * 100)}%` }} />
        </span>
        <span className="fullness-note" aria-live="polite">{fullness.note}</span>
      </div>

      <button type="submit" className="submit" disabled={!canSubmit}>
        Предложить направления
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Проверить типы и сборку**

```bash
npx tsc --noEmit
npm run build
```
Expected: без ошибок.

- [ ] **Step 5: Посмотреть в браузере**

Поднять `npm run dev` через скилл `run`, открыть форму, проверить: чипы переключаются, индикатор полноты двигается, кнопка разблокируется после десяти знаков в поле бренда, консоль чистая.

- [ ] **Step 6: Коммит**

```bash
git add components/brief styles app/layout.tsx app/globals.css
git commit -m "Форма брифа: поля, чипы, индикатор полноты"
```

---

### Task 11: Стрим на клиенте и сборка экрана

**Files:**
- Create: `components/brief/useDirections.ts`, `components/brief/BriefSummary.tsx`
- Create: `components/directions/DirectionCard.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `parseSectionBuffer` из `@/lib/stream`; `accumulate`, `isComplete` из `@/lib/directions-state`; `Direction` из `@/lib/directions-schema`; `findPalette`, `findFontPair` из `@/lib/catalog`
- Produces:
  - `useDirections(): { start(brief: Partial<Brief>): Promise<void>; reset(): void; directions: Direction[]; status: "idle" | "streaming" | "done" | "error"; error: string | null }`
  - `<BriefSummary brief={Partial<Brief>} onEdit={() => void} />`
  - `<DirectionCard direction={Direction} />`

- [ ] **Step 1: Хук чтения потока**

Создать `components/brief/useDirections.ts`:

```ts
"use client";

import { useState } from "react";
import type { Brief } from "@/lib/brief-schema";
import type { Direction } from "@/lib/directions-schema";
import { parseSectionBuffer } from "@/lib/stream";
import { accumulate, isComplete } from "@/lib/directions-state";

type Status = "idle" | "streaming" | "done" | "error";

const GENERIC = "Не удалось собрать направления. Попробуйте ещё раз.";

/**
 * Тонкая обёртка вокруг запроса и чистой функции accumulate.
 * Разбор потока живёт в lib/stream.ts, накопление — в lib/directions-state.ts.
 */
export function useDirections() {
  const [directions, setDirections] = useState<Direction[]>([]);
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
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? GENERIC);
      setStatus("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let current: Direction[] = [];

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
```

- [ ] **Step 2: Свёрнутая строка брифа**

Создать `components/brief/BriefSummary.tsx`: одна строка с началом описания бренда и кнопкой «Править», по которой вызывается `onEdit`. Текст обрезается через CSS (`text-overflow: ellipsis`), а не в JS.

- [ ] **Step 3: Карточка направления**

Создать `components/directions/DirectionCard.tsx`. Показывает `name`, `concept`, `keywords`, полоску палитры и образец пары шрифтов. Цвета берутся из `findPalette(direction.paletteId)`, шрифты из `findFontPair(direction.fontPairId)` и применяются inline-стилем внутри карточки — наружу палитра не протекает.

Перед вёрсткой вызвать `frontend-design`. После сборки карточки вызвать `/break` и проверить состояния: почти белая палитра, почти чёрная, монохром, имя направления в 40 знаков без пробелов, `concept` на верхней границе в 400 знаков, шесть длинных ключевых слов.

- [ ] **Step 4: Сборка экрана**

Переписать `app/page.tsx`: пока `status === "idle"` показывается `BriefForm`, иначе `BriefSummary` плюс карточки по мере прихода. Кнопка формы блокируется на время `streaming`. Ошибка выводится текстом с кнопкой «Ещё раз».

Спиннера на весь экран нет: карточки появляются по одной, это и есть индикация.

- [ ] **Step 5: Проверить типы и сборку**

```bash
npx tsc --noEmit
npm run build
npm test
```
Expected: без ошибок, все тесты зелёные.

- [ ] **Step 6: Проверить живьём**

Завести `.env.local` с реальными `POLZA_API_KEY`, `APP_SALT`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. Поднять приложение скиллом `run`, заполнить бриф, убедиться: карточки приходят по одной, а не все разом; третья карточка приходит всегда; повторные запуски упираются в лимит на третьем; в консоли и во вкладке сети чисто.

Третья карточка не приходит — смотреть дочитывание хвостов буферов в `route.ts`, это известное место.

- [ ] **Step 7: Коммит**

```bash
git add components app/page.tsx
git commit -m "Стрим направлений на клиенте и сборка экрана"
```

---

### Task 12: Фикстуры витрины

**Files:**
- Create: `lib/fixtures/index.ts`, `lib/fixtures/zerno.ts`, `lib/fixtures/klinika.ts`, `lib/fixtures/krossovki.ts`
- Test: `lib/fixtures/fixtures.test.ts`

**Interfaces:**
- Consumes: `Direction`, `DirectionSchema` из `@/lib/directions-schema`; `Brief` из `@/lib/brief-schema`
- Produces:
  - `interface Showcase { slug: string; title: string; brief: Brief; directions: Direction[] }`
  - `SHOWCASES: Showcase[]`, `findShowcase(slug: string): Showcase | undefined`

Маршрут витрины появится в следующем срезе — ему нужна вёрстка брендборда. Здесь фиксируется формат и проверяется, что фикстуры проходят схему.

- [ ] **Step 1: Написать падающий тест**

Создать `lib/fixtures/fixtures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SHOWCASES, findShowcase } from "./index";
import { DirectionSchema } from "@/lib/directions-schema";
import { BriefSchema } from "@/lib/brief-schema";

describe("фикстуры витрины", () => {
  it("их не меньше трёх", () => {
    expect(SHOWCASES.length).toBeGreaterThanOrEqual(3);
  });

  it("slug уникальны и годятся для адреса", () => {
    expect(new Set(SHOWCASES.map((s) => s.slug)).size).toBe(SHOWCASES.length);
    for (const s of SHOWCASES) expect(s.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("бриф каждой фикстуры проходит схему брифа", () => {
    for (const s of SHOWCASES) {
      expect(BriefSchema.safeParse(s.brief).success, s.slug).toBe(true);
    }
  });

  it("все три направления каждой фикстуры проходят схему", () => {
    for (const s of SHOWCASES) {
      expect(s.directions).toHaveLength(3);
      for (const d of s.directions) {
        expect(DirectionSchema.safeParse(d).success, `${s.slug}/${d.key}`).toBe(true);
      }
    }
  });

  it("направления внутри фикстуры не повторяют палитру", () => {
    for (const s of SHOWCASES) {
      const ids = s.directions.map((d) => d.paletteId);
      expect(new Set(ids).size, s.slug).toBe(ids.length);
    }
  });

  it("findShowcase молчит на неизвестном slug", () => {
    expect(findShowcase("нет-такого")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test -- fixtures`
Expected: FAIL, `Cannot find module './index'`

- [ ] **Step 3: Наполнить фикстуры**

Самый дешёвый способ получить правдоподобные данные — один раз прогнать приложение на трёх брифах и записать пришедшие направления в файлы. Три бренда: обжарочная «Зерно», частная клиника, магазин кроссовок. Проверить, что `paletteId` внутри одной фикстуры не повторяются — иначе тест из шага 1 упадёт, и это правильный сигнал: три одинаковых направления показывать нельзя.

Форма каждого файла, на примере `lib/fixtures/zerno.ts`. Значения полей заменяются на то, что реально вернула модель:

```ts
import type { Showcase } from "./index";

export const zerno: Showcase = {
  slug: "zerno",
  title: "Обжарочная «Зерно»",
  brief: {
    brand: "Обжарочная «Зерно» в Казани. Обжариваем сами, каждую неделю новая партия. Продаём зерно тем, кто варит дома.",
    audience: "Домашние бариста, берут зерно раз в две недели",
    characterChips: ["warm", "craft"],
    aestheticChips: ["minimal"],
    avoid: "Без деревенской избы и мешковины",
  },
  directions: [
    // Три объекта, скопированных из ответа модели, ключи safe / bold / experimental.
  ],
};
```

Импорт типа из `./index` создаёт круговую ссылку между модулем и его частями. Для типов TypeScript это допустимо и в рантайм не попадает, но если сборщик заругается — вынести `Showcase` в `lib/fixtures/types.ts` и импортировать оттуда в оба места.

Создать `lib/fixtures/index.ts`:

```ts
import type { Brief } from "@/lib/brief-schema";
import type { Direction } from "@/lib/directions-schema";
import { zerno } from "./zerno";
import { klinika } from "./klinika";
import { krossovki } from "./krossovki";

export interface Showcase {
  slug: string;
  title: string;
  brief: Brief;
  directions: Direction[];
}

export const SHOWCASES: Showcase[] = [zerno, klinika, krossovki];

export const findShowcase = (slug: string) => SHOWCASES.find((s) => s.slug === slug);
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test -- fixtures`
Expected: PASS, все шесть проверок.

- [ ] **Step 5: Прогнать всё**

```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: всё зелёное.

- [ ] **Step 6: Коммит**

```bash
git add lib/fixtures
git commit -m "Фикстуры витрины: три готовых набора направлений"
```

---

## Что остаётся открытым после этого плана

- Цены Polza взяты из `CLAUDE.md` и не сверены с живым каталогом. Сверить до деплоя.
- Модель в `route.ts` поставлена `anthropic/claude-sonnet-5`. В `CLAUDE.md` записан `claude-opus-5`. Sonnet выбран как рабочий в vyveska и вшестеро дешевле на выходе; если качество направлений не устроит — поменять одну константу и сравнить.
- Витрина, выбор направления, генерация брендборда, moodboard и PNG-экспорт — следующий срез.
- Деплой на Vercel и прогон `security-review` — перед первой публичной выкладкой.
