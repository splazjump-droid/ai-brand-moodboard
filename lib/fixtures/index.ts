import type { Brief } from "@/lib/brief-schema";
import type { GeneratedDirection } from "@/lib/directions-schema";
import { zerno } from "./zerno";
import { klinika } from "./klinika";
import { krossovki } from "./krossovki";

/**
 * Готовый проход сервиса, записанный руками: бриф и три направления к нему.
 * Витрина показывает их посетителю, который не хочет ничего заполнять, и
 * служит данными для осмотра вёрстки без обращения к модели.
 */
export interface Showcase {
  slug: string;
  title: string;
  brief: Brief;
  directions: GeneratedDirection[];
}

export const SHOWCASES: Showcase[] = [zerno, klinika, krossovki];

export const findShowcase = (slug: string) => SHOWCASES.find((s) => s.slug === slug);
