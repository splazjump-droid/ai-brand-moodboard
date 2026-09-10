import { Masthead } from "@/components/Masthead";
import { BriefFlow } from "@/components/brief/BriefFlow";
import { LEAD_SHOWCASE, ShowcaseView } from "@/components/showcase/ShowcaseView";
// Первым показываем обжарочную: тема понятна без объяснений, а три её
// направления разведены по температуре сильнее прочих — разница между
// уровнями риска читается с первого взгляда. Импорт именной, а не
// SHOWCASES[0]: порядок в массиве не должен решать, что на главной.
import { zerno } from "@/lib/fixtures/zerno";

/**
 * Первым делом человек видит готовый результат, а не пустую форму: на
 * решение у него секунд пятнадцать, а генерация идёт полминуты и стоит
 * денег. Свой бриф открывается адресом `/?brief` — состояние живёт в
 * ссылке, поэтому переход с любой страницы примера ведёт прямо в форму.
 */
export default async function Home({
  searchParams,
}: {
  // Повтор ключа в адресе (?brief&brief) даёт массив, а не строку.
  searchParams: Promise<{ brief?: string | string[] }>;
}) {
  const { brief } = await searchParams;
  if (brief !== undefined) return <BriefFlow />;

  return (
    <main className="shell">
      <Masthead lead={LEAD_SHOWCASE} />
      <ShowcaseView showcase={zerno} />
    </main>
  );
}
