import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShowcaseView } from "@/components/showcase/ShowcaseView";
import { SHOWCASES, findShowcase } from "@/lib/fixtures";

// Три адреса известны на сборке и собираются статически. dynamicParams: false
// отдаёт 404 на всё остальное сам — выдуманный slug не доходит до кода.
export const dynamicParams = false;

export function generateStaticParams() {
  return SHOWCASES.map((showcase) => ({ slug: showcase.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const showcase = findShowcase(slug);
  return showcase
    ? { title: `${showcase.title} — AI Brand Moodboard` }
    : { title: "AI Brand Moodboard" };
}

export default async function PrimerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const showcase = findShowcase(slug);
  // До сюда неизвестный slug не доходит, но findShowcase возвращает undefined
  // по типу, и молча рисовать пустую страницу хуже, чем честный 404.
  if (!showcase) notFound();

  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">
          <span className="eyebrow-mark" aria-hidden="true" />
          Бренд-мудборд
        </p>
        <h1 className="masthead-title">
          Бриф
          <span className="masthead-title-light">на бренд</span>
        </h1>
        <p className="masthead-lead">
          Три направления по одному брифу: осторожное, смелое и радикальное.
        </p>
      </header>

      <ShowcaseView showcase={showcase} />
    </main>
  );
}
