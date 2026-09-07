import { describe, it, expect } from "vitest";
import { closeJsonBraces } from "./json-repair";
import { parseSectionBuffer } from "./stream";

// Настоящие строки, снятые с апстрима на живых прогонах Opus, а не выдуманные.
// BROKEN_LINES — сбойный ответ: все три строки без последней закрывающей скобки,
// первая падала на "Expecting ',' delimiter: line 1 column 622" при длине 621.
// GOOD_LINE — удачный прогон того же брифа, с обеими скобками на месте.
const BROKEN_LINES = [
  "{\"section\":\"direction\",\"data\":{\"tier\":\"safe\",\"directionId\":\"midcentury\",\"name\":\"Тёплая обжарка\",\"concept\":\"Охристые и кофейно-коричневые плоскости, простая округлая геометрия, спокойная асимметрия в композиции. Крупный тёплый шрифт с антиквой для названий сортов, много воздуха вокруг упаковки. Бренд выглядит как обжарочная, где кофе делают руками и не спешат.\",\"keywords\":[\"охра\",\"обжарка\",\"зерно\",\"тепло\",\"ремесло\"],\"paletteId\":\"bakery-cafe\",\"fontPairId\":\"serif-warm\",\"rationale\":\"Кофейня и обжарка живут на тёплой палитре обжаренного зерна. Такой язык сразу читается как «своё, домашнее», и не устареет через сезон.\"}",
  "{\"section\":\"direction\",\"data\":{\"tier\":\"bold\",\"directionId\":\"neo-brutal\",\"name\":\"Свежая партия\",\"concept\":\"Толстые чёрные обводки, жёсткие смещённые тени, огромный узкий шрифт на всю плоскость. Дата обжарки становится главным элементом макета, а не мелкой строчкой на дне пакета. Сорта разложены по плотным цветным блокам без градиентов и украшений.\",\"keywords\":[\"дата обжарки\",\"обводка\",\"плакат\",\"партия\",\"прямота\"],\"paletteId\":\"photography-studio\",\"fontPairId\":\"condensed-poster\",\"rationale\":\"Главный аргумент бренда это свежесть каждую неделю. Брутальная типографика позволяет заявить это громко, как надпись на складском ящике.\"}",
  "{\"section\":\"direction\",\"data\":{\"tier\":\"experimental\",\"directionId\":\"collage\",\"name\":\"Мешок и вырезки\",\"concept\":\"Отсканированная крафтовая бумага, обрывки джутового мешка, макро зерна в грубом растре, поверх наклеенные от руки цифры и названия сортов. Размеры букв прыгают внутри одной строки, поверх лежит зерно плёнки. Каждая партия выглядит как отдельный собранный вручную лист.\",\"keywords\":[\"вырезка\",\"крафт\",\"растр\",\"слои\",\"джут\"],\"paletteId\":\"recipe-cooking-app\",\"fontPairId\":\"condensed-poster\",\"rationale\":\"Коллаж легко пересобирать под каждую недельную партию, поэтому упаковка живёт вместе с обжаркой. Для аудитории, которая ищет кофе с характером, это язык живой мастерской.\"}",
];

const GOOD_LINE = "{\"section\":\"direction\",\"data\":{\"tier\":\"safe\",\"directionId\":\"midcentury\",\"name\":\"Тёплая обжарка\",\"concept\":\"Охристые и обжаренно-коричневые тона на кремовой бумаге, простая округлая геометрия, спокойная асимметрия блоков. Тёплый шрифт с засечками для названий сортов, много воздуха вокруг упаковки. Бренд выглядит как мастерская, где кофе делают руками и без спешки.\",\"keywords\":[\"охра\",\"обжарка\",\"крафт\",\"ручная работа\",\"тишина\"],\"paletteId\":\"bakery-cafe\",\"fontPairId\":\"serif-warm\",\"rationale\":\"Домашняя, ремесленная подача честно отражает еженедельную обжарку своими силами и хорошо читается на пакете, вывеске и в меню.\",\"tier_note\":null}}";

describe("closeJsonBraces", () => {
  it("дописывает недостающую скобку настоящей сбойной строке модели", () => {
    const line = BROKEN_LINES[0];
    expect(line.length).toBe(621);
    expect(() => JSON.parse(line)).toThrow();

    const repaired = closeJsonBraces(line);
    expect(repaired).toBe(`${line}}`);
    expect(JSON.parse(repaired!).data.name).toBe("Тёплая обжарка");
  });

  it("не считает скобки внутри строкового значения", () => {
    // В тексте концепции вполне может встретиться фигурная скобка, причём
    // одиночная: подсчёт в лоб принял бы её за настоящую и ошибся в обе стороны.
    const closing = '{"section":"direction","data":{"name":"Плашка } в тексте"}';
    expect(closeJsonBraces(closing)).toBe(`${closing}}`);
    expect(JSON.parse(closeJsonBraces(closing)!).data.name).toBe(
      "Плашка } в тексте",
    );

    const opening = '{"section":"direction","data":{"name":"Плашка { в тексте"}';
    expect(closeJsonBraces(opening)).toBe(`${opening}}`);
    expect(JSON.parse(closeJsonBraces(opening)!).data.name).toBe(
      "Плашка { в тексте",
    );
  });

  it("не сбивается на экранированной кавычке внутри значения", () => {
    // Кавычка закрывает литерал только если она не экранирована: иначе счёт
    // ушёл бы за пределы строки и скобка { в хвосте попала бы в баланс.
    const line =
      '{"section":"direction","data":{"name":"Бренд \\"Зерно\\" и знак {"}';
    const repaired = closeJsonBraces(line);
    expect(repaired).toBe(`${line}}`);
    expect(JSON.parse(repaired!).data.name).toBe('Бренд "Зерно" и знак {');
  });

  it("не трогает правильную строку удачного прогона", () => {
    expect(() => JSON.parse(GOOD_LINE)).not.toThrow();
    expect(closeJsonBraces(GOOD_LINE)).toBeNull();
  });

  it("не убирает лишние закрывающие скобки", () => {
    expect(closeJsonBraces('{"section":"a","data":1}}')).toBeNull();
  });

  it("не чинит недостачу больше трёх скобок — это уже не потерянный хвост", () => {
    expect(closeJsonBraces("{{{{")).toBeNull();
    expect(closeJsonBraces("{{{")).toBe("{{{}}}");
  });
});

describe("parseSectionBuffer с починкой", () => {
  it("разбирает все три строки настоящего сбойного ответа", () => {
    const { sections, remainder } = parseSectionBuffer(
      `${BROKEN_LINES.join("\n")}\n`,
    );

    expect(remainder).toBe("");
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.section)).toEqual([
      "direction",
      "direction",
      "direction",
    ]);
    expect(
      sections.map((s) => (s.data as { tier: string }).tier),
    ).toEqual(["safe", "bold", "experimental"]);
  });

  it("разбирает удачный прогон ровно как раньше", () => {
    const { sections } = parseSectionBuffer(`${GOOD_LINE}\n`);
    expect(sections).toHaveLength(1);
    expect(sections[0].data).toEqual(JSON.parse(GOOD_LINE).data);
  });

  it("молча отбрасывает мусор, который починкой не спасти", () => {
    const { sections } = parseSectionBuffer(
      'не JSON вовсе\n{"section":"direction","data":{"name":"обор\n{{{{{\n',
    );
    expect(sections).toEqual([]);
  });
});
