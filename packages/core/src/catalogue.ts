/**
 * The product catalogue.
 *
 * The 50 products from the Operator A factory catalogue, as data. Each carries
 * the fonts its design language names, so the licence audit can be run against
 * a product by route rather than against a hand-maintained list.
 *
 * These are products, not templates: each has its own buyer, palette,
 * typography and conversion journey, and each is intended to stand as a brand.
 */
import { auditFonts, type FontAudit } from './licensing.js';

export interface CatalogueProduct {
  /** Public route, e.g. `/axiom-grid`. */
  route: string;
  name: string;
  category: string;
  /** The typefaces the design language names. */
  fonts: string[];
}

export const CATALOGUE: readonly CatalogueProduct[] = [
  // Category I — AI & Frontier Technology
  { route: 'axiom-grid', name: 'Axiom Grid', category: 'AI & Frontier Technology', fonts: ['Space Grotesk', 'IBM Plex Mono'] },
  { route: 'selene-agents', name: 'Selene Agents', category: 'AI & Frontier Technology', fonts: ['Canela', 'Geist'] },
  { route: 'kinetic-mesh', name: 'Kinetic Mesh', category: 'AI & Frontier Technology', fonts: ['Archivo Black', 'DM Mono'] },
  { route: 'lattice-labs', name: 'Lattice Labs', category: 'AI & Frontier Technology', fonts: ['Söhne-style grotesk', 'Source Serif 4'] },
  { route: 'orbital-ledger', name: 'Orbital Ledger', category: 'AI & Frontier Technology', fonts: ['Manrope', 'Fraunces'] },
  { route: 'stilla-care-systems', name: 'Stilla Care Systems', category: 'AI & Frontier Technology', fonts: ['Instrument Serif', 'Plus Jakarta Sans'] },
  { route: 'morrow-compute', name: 'Morrow Compute', category: 'AI & Frontier Technology', fonts: ['Neue Haas-like sans', 'DIN Mono'] },
  { route: 'vanta-proof', name: 'Vanta Proof', category: 'AI & Frontier Technology', fonts: ['Aeonik', 'JetBrains Mono'] },
  { route: 'helio-relay', name: 'Helio Relay', category: 'AI & Frontier Technology', fonts: ['ABC Diatype-style sans', 'Lora'] },
  { route: 'folio-forms', name: 'Folio Forms', category: 'AI & Frontier Technology', fonts: ['Neue Montreal', 'Playfair Display'] },

  // Category II — Luxury, Fashion & Beauty
  { route: 'noor-vale', name: 'Noor Vale', category: 'Luxury, Fashion & Beauty', fonts: ['Cormorant', 'Inter Tight'] },
  { route: 'aster-alder', name: 'Aster & Alder', category: 'Luxury, Fashion & Beauty', fonts: ['Didot', "Suisse Int'l"] },
  { route: 'elan-method', name: 'Élan Method', category: 'Luxury, Fashion & Beauty', fonts: ['Editorial New', 'General Sans'] },
  { route: 'vela-maison', name: 'Vela Maison', category: 'Luxury, Fashion & Beauty', fonts: ['Bodoni Moda', 'Satoshi'] },
  { route: 'sardis-parfums', name: 'Sardis Parfums', category: 'Luxury, Fashion & Beauty', fonts: ['Optima-style serif', 'Inter Tight'] },
  { route: 'ruth-ibarra-botanics', name: 'Ruth Ibarra Botanics', category: 'Luxury, Fashion & Beauty', fonts: ['EB Garamond', 'Manrope'] },
  { route: 'tempo-atelier', name: 'Tempo Atelier', category: 'Luxury, Fashion & Beauty', fonts: ['Univers-style sans', 'OCR Mono'] },
  { route: 'peregrine-editions', name: 'Peregrine Editions', category: 'Luxury, Fashion & Beauty', fonts: ['Optima', 'Arial-like utility labels'] },
  { route: 'caldera-optical', name: 'Caldera Optical', category: 'Luxury, Fashion & Beauty', fonts: ['Neue Haas-like sans', 'Source Serif 4'] },
  { route: 'mare-house', name: 'Maré House', category: 'Luxury, Fashion & Beauty', fonts: ['Recoleta', 'Avenir-like sans'] },

  // Category III — Architecture, Property & Hospitality
  { route: 'monolith-works', name: 'Monolith Works', category: 'Architecture, Property & Hospitality', fonts: ['Helvetica Now', 'Tiempos'] },
  { route: 'nocturne-estates', name: 'Nocturne Estates', category: 'Architecture, Property & Hospitality', fonts: ['Editorial New', 'Suisse'] },
  { route: 'alder-house', name: 'Alder House', category: 'Architecture, Property & Hospitality', fonts: ['Freight Text', 'Basis Grotesque'] },
  { route: 'formwell-interiors', name: 'Formwell Interiors', category: 'Architecture, Property & Hospitality', fonts: ['PP Editorial New', 'Graphik'] },
  { route: 'studio-lumen', name: 'Studio Lumen', category: 'Architecture, Property & Hospitality', fonts: ['Space Grotesk', 'DM Mono'] },
  { route: 'maison-rook', name: 'Maison Rook', category: 'Architecture, Property & Hospitality', fonts: ['Cormorant', 'Work Sans'] },
  { route: 'terra-forma', name: 'Terra Forma', category: 'Architecture, Property & Hospitality', fonts: ['Lyon Text', 'ABC Favorit'] },
  { route: 'veloce-district', name: 'Veloce District', category: 'Architecture, Property & Hospitality', fonts: ['Druk Condensed', 'Inter Tight'] },
  { route: 'hinge-hearth', name: 'Hinge & Hearth', category: 'Architecture, Property & Hospitality', fonts: ['Archivo Black', 'Inter'] },
  { route: 'fieldnote-cabins', name: 'Fieldnote Cabins', category: 'Architecture, Property & Hospitality', fonts: ['Charter', 'National-style sans'] },

  // Category IV — Premium Commerce & Consumer Brands
  { route: 'kansa-objects', name: 'Kansa Objects', category: 'Premium Commerce & Consumer Brands', fonts: ['Noto Serif JP', 'Noto Sans'] },
  { route: 'ora-roasters', name: 'Ora Roasters', category: 'Premium Commerce & Consumer Brands', fonts: ['Archivo Black', 'DM Mono'] },
  { route: 'corella-run', name: 'Corella Run', category: 'Premium Commerce & Consumer Brands', fonts: ['Archivo', 'JetBrains Mono'] },
  { route: 'solace-audio', name: 'Solace Audio', category: 'Premium Commerce & Consumer Brands', fonts: ['Archivo', 'Source Serif 4'] },
  { route: 'basil-bone', name: 'Basil & Bone', category: 'Premium Commerce & Consumer Brands', fonts: ['Fraunces', 'Inter'] },
  { route: 'vesper-pantry', name: 'Vesper Pantry', category: 'Premium Commerce & Consumer Brands', fonts: ['EB Garamond', 'Inter'] },
  { route: 'arq-supply', name: 'Arq Supply', category: 'Premium Commerce & Consumer Brands', fonts: ['Archivo', 'Fraunces'] },
  { route: 'perrin-carry', name: 'Perrin Carry', category: 'Premium Commerce & Consumer Brands', fonts: ['Source Serif 4', 'Inter Tight'] },
  { route: 'wildercare', name: 'Wildercare', category: 'Premium Commerce & Consumer Brands', fonts: ['Lora', 'Manrope'] },
  { route: 'havenlark', name: 'Havenlark', category: 'Premium Commerce & Consumer Brands', fonts: ['Plus Jakarta Sans', 'Fraunces'] },

  // Category V — Creative, Professional & High-Ticket Services
  { route: 'sable-type', name: 'Sable & Type', category: 'Creative, Professional & High-Ticket Services', fonts: ['Space Grotesk', 'Fraunces'] },
  { route: 'civic-assembly', name: 'Civic Assembly', category: 'Creative, Professional & High-Ticket Services', fonts: ['Archivo', 'Source Serif 4'] },
  { route: 'masonry-films', name: 'Masonry Films', category: 'Creative, Professional & High-Ticket Services', fonts: ['Anton', 'Archivo'] },
  { route: 'northline-counsel', name: 'Northline Counsel', category: 'Creative, Professional & High-Ticket Services', fonts: ['Source Serif 4', 'Inter'] },
  { route: 'pattern-school', name: 'Pattern School', category: 'Creative, Professional & High-Ticket Services', fonts: ['Archivo Black', 'Inter'] },
  { route: 'oriel-advisory', name: 'Oriel Advisory', category: 'Creative, Professional & High-Ticket Services', fonts: ['Inter Tight', 'Source Serif 4'] },
  { route: 'hinterland-sound', name: 'Hinterland Sound', category: 'Creative, Professional & High-Ticket Services', fonts: ['Space Grotesk', 'JetBrains Mono'] },
  { route: 'quorum-house', name: 'Quorum House', category: 'Creative, Professional & High-Ticket Services', fonts: ['Archivo', 'DM Mono'] },
  { route: 'adjacent-talent', name: 'Adjacent Talent', category: 'Creative, Professional & High-Ticket Services', fonts: ['Source Serif 4', 'Inter'] },
  { route: 'lumen-co', name: 'Lumen & Co.', category: 'Creative, Professional & High-Ticket Services', fonts: ['Cormorant', 'Inter Tight'] },
];

const BY_ROUTE = new Map(CATALOGUE.map((p) => [p.route, p]));

export function findProduct(route: string): CatalogueProduct | undefined {
  return BY_ROUTE.get(route.trim().toLowerCase().replace(/^\//, ''));
}

/** Audit one product's typefaces for resale safety. */
export function auditProduct(route: string): (FontAudit & { product: CatalogueProduct }) | null {
  const product = findProduct(route);
  if (!product) return null;
  return { ...auditFonts(product.fonts), product };
}

/** Audit the whole catalogue. Returns per-product audits and a roll-up. */
export function auditCatalogue(): {
  products: Array<{ route: string; name: string; clear: boolean; blocked: string[] }>;
  cleanProducts: string[];
  blockedProducts: string[];
} {
  const products = CATALOGUE.map((p) => {
    const audit = auditFonts(p.fonts);
    return {
      route: p.route,
      name: p.name,
      clear: audit.clear,
      blocked: [...audit.blocked, ...audit.unknown].map((f) => f.name),
    };
  });
  return {
    products,
    cleanProducts: products.filter((p) => p.clear).map((p) => p.route),
    blockedProducts: products.filter((p) => !p.clear).map((p) => p.route),
  };
}
