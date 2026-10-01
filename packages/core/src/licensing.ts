/**
 * Licence classification for resale.
 *
 * The platform sells products. Before a product can be sold, every creative and
 * code component inside it must be licensed for redistribution. This module is
 * the machine-readable answer to "may I ship this?" — so the question is
 * answered by a function that runs in CI, not by memory during a build.
 *
 * Scope: font software and code dependencies. This is an engineering control,
 * not legal advice; `counsel_review` evidence remains a separate requirement
 * before a product reaches `cleared` (see governance.ts).
 */

/** How a licence behaves when the artefact is redistributed for money. */
export type LicenceClass =
  /** MIT, Apache-2.0, BSD, ISC — redistribute freely, keep the notice. */
  | 'permissive'
  /** SIL Open Font License — embed and redistribute; do not sell the font alone. */
  | 'font-open'
  /** ITF Free Font Licence and similar — free commercial use, keep the licence file. */
  | 'font-free'
  /** Requires a paid licence per seat, domain, or pageview. */
  | 'commercial'
  /** AGPL/SSPL — network use triggers source disclosure. Hostile to resale. */
  | 'copyleft-strong'
  /** "Fair-code" / BUSL — free to use, restricted to resell. */
  | 'source-available'
  /** All rights reserved. */
  | 'proprietary';

/** Licence classes that permit redistribution inside a sold product. */
export const RESALE_SAFE: readonly LicenceClass[] = ['permissive', 'font-open', 'font-free'];

export function isResaleSafe(cls: LicenceClass): boolean {
  return RESALE_SAFE.includes(cls);
}

export interface FontRecord {
  name: string;
  licence: LicenceClass;
  /** The foundry that controls the licence, when it is a commercial one. */
  foundry?: string;
  /** Why this classification, or what the licence obliges. */
  note: string;
  /** Resale-safe substitutes, best first. */
  replacements?: string[];
}

/**
 * The fonts named in the product catalogue, classified.
 *
 * A "*-style" or "*-like" entry is a placeholder for a commercial face the
 * catalogue could not license — it is classified as commercial, because the
 * face it stands in for is commercial.
 */
export const FONTS: readonly FontRecord[] = [
  // --- Resale-safe: SIL Open Font Licence (Google Fonts, Geist) ---
  { name: 'Space Grotesk', licence: 'font-open', note: 'SIL OFL 1.1. Embed and redistribute; keep the licence file.' },
  { name: 'IBM Plex Mono', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Archivo Black', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'DM Mono', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Manrope', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Fraunces', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Instrument Serif', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Plus Jakarta Sans', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'JetBrains Mono', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Lora', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Playfair Display', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Bodoni Moda', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Inter Tight', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Inter', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'EB Garamond', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Cormorant', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Work Sans', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Noto Sans', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Noto Serif JP', licence: 'font-open', note: 'SIL OFL 1.1. Japanese coverage without a Microsoft licence.' },
  { name: 'Source Serif 4', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Anton', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Archivo', licence: 'font-open', note: 'SIL OFL 1.1.' },
  { name: 'Geist', licence: 'font-open', note: 'SIL OFL 1.1 (Vercel).' },
  { name: 'Charter', licence: 'font-open', note: 'Bitstream Charter; permissive terms, freely redistributable.' },

  // --- Resale-safe: ITF Free Font Licence (Fontshare) ---
  { name: 'Satoshi', licence: 'font-free', foundry: 'Indian Type Foundry', note: 'ITF FFL. Free commercial use at any scale; keep the licence file.' },
  { name: 'General Sans', licence: 'font-free', foundry: 'Indian Type Foundry', note: 'ITF FFL. Free commercial use at any scale; keep the licence file.' },

  // --- Commercial: cannot be redistributed inside a sold product ---
  { name: 'Canela', licence: 'commercial', foundry: 'Commercial Type', note: 'Requires a paid web licence metered by pageview.', replacements: ['Fraunces', 'Instrument Serif'] },
  { name: 'DIN', licence: 'commercial', foundry: 'Monotype', note: 'Requires a paid web licence.', replacements: ['Archivo', 'Inter Tight'] },
  { name: 'DIN Mono', licence: 'commercial', foundry: 'Monotype', note: 'Requires a paid web licence.', replacements: ['DM Mono', 'JetBrains Mono'] },
  { name: 'Aeonik', licence: 'commercial', foundry: 'CoType Foundry', note: 'Requires a paid web licence.', replacements: ['Space Grotesk', 'Geist'] },
  { name: 'ABC Diatype-style sans', licence: 'commercial', foundry: 'Dinamo', note: 'Stands in for ABC Diatype, a paid face.', replacements: ['Inter Tight', 'Geist'] },
  { name: 'Neue Montreal', licence: 'commercial', foundry: 'Pangram Pangram', note: 'Requires a paid web licence.', replacements: ['General Sans', 'Archivo'] },
  { name: 'Didot', licence: 'commercial', foundry: 'Linotype', note: 'Requires a paid web licence.', replacements: ['Playfair Display', 'Bodoni Moda'] },
  { name: "Suisse Int'l", licence: 'commercial', foundry: 'Swiss Typefaces', note: 'Requires a paid web licence.', replacements: ['Inter Tight', 'Archivo'] },
  { name: 'Suisse', licence: 'commercial', foundry: 'Swiss Typefaces', note: 'Requires a paid web licence.', replacements: ['Inter Tight', 'Archivo'] },
  { name: 'Editorial New', licence: 'commercial', foundry: 'Pangram Pangram', note: 'Requires a paid web licence.', replacements: ['Instrument Serif', 'Fraunces'] },
  { name: 'PP Editorial New', licence: 'commercial', foundry: 'Pangram Pangram', note: 'Requires a paid web licence.', replacements: ['Instrument Serif', 'Fraunces'] },
  { name: 'Optima', licence: 'commercial', foundry: 'Monotype', note: 'Requires a paid web licence.', replacements: ['EB Garamond', 'Cormorant'] },
  { name: 'Optima-style serif', licence: 'commercial', foundry: 'Monotype', note: 'Stands in for Optima, a paid face.', replacements: ['EB Garamond', 'Cormorant'] },
  { name: 'OCR Mono', licence: 'commercial', note: 'Commercial OCR face; verify before shipping.', replacements: ['DM Mono', 'JetBrains Mono'] },
  { name: 'Arial', licence: 'commercial', foundry: 'Monotype', note: 'Requires a paid web licence.', replacements: ['Archivo', 'Inter'] },
  { name: 'Arial-like utility labels', licence: 'commercial', foundry: 'Monotype', note: 'Stands in for Arial, a paid face.', replacements: ['Archivo', 'Inter'] },
  { name: 'Recoleta', licence: 'commercial', foundry: 'Latinotype', note: 'Requires a paid web licence.', replacements: ['Fraunces', 'Instrument Serif'] },
  { name: 'Avenir-like sans', licence: 'commercial', foundry: 'Linotype', note: 'Stands in for Avenir, a paid face.', replacements: ['Manrope', 'Plus Jakarta Sans'] },
  { name: 'Helvetica Now', licence: 'commercial', foundry: 'Monotype', note: 'Requires a paid web licence.', replacements: ['Archivo', 'Geist'] },
  { name: 'Neue Haas-like sans', licence: 'commercial', foundry: 'Monotype', note: 'Stands in for Neue Haas Grotesk, a paid face.', replacements: ['Archivo', 'Inter'] },
  { name: 'Tiempos', licence: 'commercial', foundry: 'Klim Type Foundry', note: 'Requires a paid web licence.', replacements: ['Source Serif 4', 'Lora'] },
  { name: 'Freight Text', licence: 'commercial', foundry: 'Adobe', note: 'Requires a paid web licence.', replacements: ['Source Serif 4', 'EB Garamond'] },
  { name: 'Basis Grotesque', licence: 'commercial', foundry: 'Colophon Foundry', note: 'Requires a paid web licence.', replacements: ['Work Sans', 'Inter Tight'] },
  { name: 'Graphik', licence: 'commercial', foundry: 'Commercial Type', note: 'Requires a paid web licence.', replacements: ['Archivo', 'Geist'] },
  { name: 'Lyon Text', licence: 'commercial', foundry: 'Commercial Type', note: 'Requires a paid web licence.', replacements: ['Source Serif 4', 'Lora'] },
  { name: 'ABC Favorit', licence: 'commercial', foundry: 'Dinamo', note: 'Requires a paid web licence.', replacements: ['Space Grotesk', 'Archivo'] },
  { name: 'Druk Condensed', licence: 'commercial', foundry: 'Commercial Type', note: 'Requires a paid web licence.', replacements: ['Anton', 'Archivo Black'] },
  { name: 'National-style sans', licence: 'commercial', foundry: 'Klim Type Foundry', note: 'Stands in for National, a paid face.', replacements: ['Work Sans', 'Inter Tight'] },
  { name: 'Söhne-style grotesk', licence: 'commercial', foundry: 'Klim Type Foundry', note: 'Stands in for Söhne, a paid face.', replacements: ['Inter', 'Geist'] },
  { name: 'Univers-style sans', licence: 'commercial', foundry: 'Monotype', note: 'Stands in for Univers, a paid face.', replacements: ['Archivo', 'Inter'] },
  { name: 'Yu Mincho', licence: 'commercial', foundry: 'Microsoft', note: 'Bundled with Windows; not licensed for redistribution.', replacements: ['Noto Serif JP'] },
];

const FONT_INDEX = new Map(FONTS.map((f) => [f.name.toLowerCase(), f]));

/** Look up a font by name. Returns undefined for anything not in the registry. */
export function classifyFont(name: string): FontRecord | undefined {
  return FONT_INDEX.get(name.trim().toLowerCase());
}

export interface FontFinding {
  name: string;
  licence: LicenceClass | 'unknown';
  safe: boolean;
  detail: string;
  replacements: string[];
}

export interface FontAudit {
  /** Every font examined. */
  findings: FontFinding[];
  /** Fonts that block resale. */
  blocked: FontFinding[];
  /** Fonts whose licence is unknown — treated as blocked until verified. */
  unknown: FontFinding[];
  /** True only when no font blocks resale. */
  clear: boolean;
}

function toFinding(name: string): FontFinding {
  const rec = classifyFont(name);
  if (!rec) {
    return {
      name,
      licence: 'unknown',
      safe: false,
      detail: 'Not in the licence registry. Verify before shipping.',
      replacements: [],
    };
  }
  return {
    name: rec.name,
    licence: rec.licence,
    safe: isResaleSafe(rec.licence),
    detail: rec.note,
    replacements: rec.replacements ?? [],
  };
}

/**
 * Audit a set of font names for resale safety.
 *
 * An unregistered font is reported as unknown and counts against clearance —
 * silence is not permission.
 */
export function auditFonts(names: readonly string[]): FontAudit {
  const findings = names.map(toFinding);
  const blocked = findings.filter((f) => !f.safe && f.licence !== 'unknown');
  const unknown = findings.filter((f) => f.licence === 'unknown');
  return { findings, blocked, unknown, clear: blocked.length === 0 && unknown.length === 0 };
}

/* ------------------------------------------------------------------ *
 * Code dependencies
 * ------------------------------------------------------------------ */

export interface DependencyRecord {
  name: string;
  licence: string;
  cls: LicenceClass;
  note: string;
}

/**
 * Automation and tooling dependencies evaluated for resale.
 *
 * The distinction that matters: a permissive licence lets the dependency ship
 * inside a product you sell; a source-available or strong-copyleft licence
 * does not, even though both are "open source" in casual use.
 */
export const DEPENDENCIES: readonly DependencyRecord[] = [
  { name: 'Activepieces', licence: 'MIT', cls: 'permissive', note: 'Ship inside a sold product.' },
  { name: 'n8n', licence: 'Sustainable Use License', cls: 'source-available', note: 'Free to use; restricted from reselling as a service.' },
  { name: 'Windmill', licence: 'AGPL-3.0', cls: 'copyleft-strong', note: 'Network use triggers source disclosure.' },
  { name: 'Temporal', licence: 'MIT', cls: 'permissive', note: 'Ship inside a sold product.' },
  { name: 'BullMQ', licence: 'MIT', cls: 'permissive', note: 'Ship inside a sold product.' },
  { name: 'Model Context Protocol SDK', licence: 'MIT', cls: 'permissive', note: 'Ship inside a sold product.' },
];

const DEP_INDEX = new Map(DEPENDENCIES.map((d) => [d.name.toLowerCase(), d]));

export function classifyDependency(name: string): DependencyRecord | undefined {
  return DEP_INDEX.get(name.trim().toLowerCase());
}
