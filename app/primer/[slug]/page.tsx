import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Masthead } from "@/components/Masthead";
import { LEAD_SHOWCASE, ShowcaseView } from "@/components/showcase/ShowcaseView";
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
      <Masthead lead={LEAD_SHOWCASE} />
      <ShowcaseView showcase={showcase} />
    </main>
  );
}
