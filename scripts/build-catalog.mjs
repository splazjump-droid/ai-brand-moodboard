// Пересборка среза каталога дизайн-данных.
// Источник лежит вне репозитория и в сборку не попадает, поэтому
// нужные поля вынимаются сюда один раз и коммитятся.
// Запуск: node scripts/build-catalog.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SRC = join(homedir(), ".claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/data");

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

// Палитры: у источника нет собственного id, собираем из типа продукта.
const seen = new Map();
const palettes = parseCsv(readFileSync(`${SRC}/colors.csv`, "utf8"))
  .filter((r) => r.Primary?.startsWith("#") && r.Border?.startsWith("#"))
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

writeFileSync("lib/catalog/palettes.json", JSON.stringify(palettes, null, 2) + "\n");
console.log(`палитр: ${palettes.length}`);
