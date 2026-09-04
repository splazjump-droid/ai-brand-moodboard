import palettesJson from "./palettes.json";
import fontPairsJson from "./font-pairs.json";
import directionsJson from "./directions.json";

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

export const PALETTES: Palette[] = palettesJson;
export const FONT_PAIRS: FontPair[] = fontPairsJson;

export const findPalette = (id: string) => PALETTES.find((p) => p.id === id);
export const findFontPair = (id: string) => FONT_PAIRS.find((f) => f.id === id);

export const TIERS = ["safe", "bold", "experimental"] as const;
export type Tier = (typeof TIERS)[number];

export interface Direction {
  id: string;
  name: string;
  tier: Tier;
  keywords: string[];
  /** Описание визуального языка для промпта, по-английски. */
  language: string;
  paletteIds: string[];
  fontPairIds: string[];
}

export const DIRECTIONS: Direction[] = directionsJson as Direction[];

export const findDirection = (id: string) => DIRECTIONS.find((d) => d.id === id);

export const directionsByTier = (tier: Tier) => DIRECTIONS.filter((d) => d.tier === tier);
