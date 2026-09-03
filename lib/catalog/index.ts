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
