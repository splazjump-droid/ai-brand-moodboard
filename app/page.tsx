"use client";

import { useState, type CSSProperties } from "react";

import { BriefForm } from "@/components/brief/BriefForm";
import type { Brief } from "@/lib/brief-schema";

export default function Home() {
  const [brief, setBrief] = useState<Partial<Brief>>({});

  return (
    <main className="shell">
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
          Расскажите о бренде своими словами. В ответ придут три визуальных
          направления — осторожное, смелое и радикальное, каждое с концепцией,
          палитрой и типографикой.
        </p>
      </header>

      <BriefForm
        brief={brief}
        onChange={setBrief}
        onSubmit={() => {
          // Отправку в сеть подключает задача 11.
        }}
        disabled={false}
      />
    </main>
  );
}
