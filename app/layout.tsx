import type { Metadata } from "next";
import { Onest, Unbounded } from "next/font/google";

import "@/styles/tokens.css";
import "./globals.css";
import "@/styles/brief.css";

// Оба семейства переменные и оба с кириллицей — вес не перечисляем,
// доступна вся ось wght, включая крайности 200 и 800.
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-unbounded",
  display: "swap",
});

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Brand Moodboard",
  description: "По брифу о бренде — три визуальных направления.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
