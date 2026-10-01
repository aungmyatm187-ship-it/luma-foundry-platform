# Licensing and resale

This document records what may be shipped inside a product that Luma Foundry
sells, and what may not. The rules are enforced in code
(`packages/core/src/licensing.ts`), so this is a record of the reasoning behind
them rather than the only place they exist.

This is an engineering control, not legal advice. `counsel_review` remains a
separate required evidence kind before a product can reach `cleared`
(`governance.ts`).

## Why this exists

The product catalogue names its typefaces, because typography is part of what
makes each product distinct. Most of those typefaces are commercial faces sold
under licences that permit *display* but not *redistribution*. Selling a
template that bundles them would be a licence breach even though the design work
is entirely original.

The audit that motivated this document: **of the 50 products, 20 name at least
one typeface that cannot be redistributed in a sold product.**

## The rule

A font may ship inside a sold product only if its licence is one of:

| Licence class | Meaning | Examples |
|---|---|---|
| `permissive` | MIT, Apache-2.0, BSD, ISC | code dependencies |
| `font-open` | SIL Open Font License 1.1 | Space Grotesk, Inter, Archivo |
| `font-free` | ITF Free Font Licence | Satoshi, General Sans |

Two obligations attach to the safe classes:

- **SIL OFL:** the font may be embedded and redistributed, but may not be sold
  on its own, and any redistribution keeps the licence file alongside it.
- **ITF FFL:** free commercial use at any scale, but the licence file must be
  kept with the font files.

Anything classified `commercial`, `source-available`, `copyleft-strong` or
`proprietary` blocks resale. A font that is not in the registry is reported as
`unknown` and **counts as blocked** — silence is not permission.

## Findings

### Catalogue audit

```
total products   50
resale-safe      30
blocked          20
```

The 20 blocked products name one or more commercial faces. Each blocked font
carries suggested substitutes in the registry, so remediation is a substitution
rather than a redesign.

| Blocked typeface | Foundry | Use instead |
|---|---|---|
| Canela | Commercial Type | Fraunces, Instrument Serif |
| DIN, DIN Mono | Monotype | Archivo, Inter Tight / DM Mono |
| Aeonik | CoType Foundry | Space Grotesk, Geist |
| ABC Diatype, ABC Favorit | Dinamo | Inter Tight, Geist / Space Grotesk |
| Neue Montreal, Editorial New, PP Editorial New | Pangram Pangram | General Sans, Instrument Serif |
| Didot, Optima, Arial, Univers, Helvetica Now, Neue Haas | Monotype / Linotype | Playfair Display, EB Garamond, Archivo |
| Suisse, Suisse Int'l | Swiss Typefaces | Inter Tight, Archivo |
| Tiempos, National | Klim Type Foundry | Source Serif 4, Work Sans |
| Söhne | Klim Type Foundry | Inter, Geist |
| Freight Text | Adobe | Source Serif 4, EB Garamond |
| Basis Grotesque | Colophon Foundry | Work Sans, Inter Tight |
| Graphik, Lyon Text, Druk Condensed | Commercial Type | Archivo, Source Serif 4, Anton |
| Recoleta | Latinotype | Fraunces, Instrument Serif |
| Avenir | Linotype | Manrope, Plus Jakarta Sans |
| Yu Mincho | Microsoft | Noto Serif JP |
| OCR Mono | — | DM Mono, JetBrains Mono |

### Clean products (30)

Products whose typefaces are all resale-safe as written:

`axiom-grid`, `kinetic-mesh`, `orbital-ledger`, `stilla-care-systems`,
`noor-vale`, `vela-maison`, `ruth-ibarra-botanics`, `studio-lumen`,
`maison-rook`, `hinge-hearth`, `kansa-objects`, `ora-roasters`, `corella-run`,
`solace-audio`, `basil-bone`, `vesper-pantry`, `arq-supply`, `perrin-carry`,
`wildercare`, `havenlark`, `sable-type`, `civic-assembly`, `masonry-films`,
`northline-counsel`, `pattern-school`, `oriel-advisory`, `hinterland-sound`,
`quorum-house`, `adjacent-talent`, `lumen-co`.

### Blocked products (20)

`selene-agents`, `lattice-labs`, `morrow-compute`, `vanta-proof`, `helio-relay`,
`folio-forms`, `aster-alder`, `elan-method`, `sardis-parfums`, `tempo-atelier`,
`peregrine-editions`, `caldera-optical`, `mare-house`, `monolith-works`,
`nocturne-estates`, `alder-house`, `formwell-interiors`, `terra-forma`,
`veloce-district`, `fieldnote-cabins`.

## Checking a product

From the bot:

```
licence axiom-grid      # resale-safe
licence selene-agents   # blocked, with substitutes
```

From code:

```ts
import { auditProduct, auditCatalogue } from '@luma/core';

auditProduct('axiom-grid');   // { clear: true, findings: [...] }
auditCatalogue();             // { cleanProducts: [...30], blockedProducts: [...20] }
```

## Code dependencies

The same distinction applies to automation tooling, and it is easy to get wrong
because both sides are commonly called "open source":

| Dependency | Licence | Class | May ship in a sold product? |
|---|---|---|---|
| Activepieces | MIT | permissive | Yes |
| Temporal | MIT | permissive | Yes |
| BullMQ | MIT | permissive | Yes |
| MCP SDK | MIT | permissive | Yes |
| n8n | Sustainable Use License | source-available | No — restricted from resale |
| Windmill | AGPL-3.0 | copyleft-strong | No — network use triggers disclosure |

This is why the platform's own engine is built rather than adopted from a
workflow product: the permissively licensed options are thin, and the capable
options restrict resale.

## Other things that need clearing before a product is sold

Fonts are the largest exposure because the catalogue names them explicitly, but
they are not the only one. The evidence model in `governance.ts` covers the rest:

- **`asset_licence`** — imagery, icons and audio. The hero-asset audit found 47
  products sharing only 22 images; each image is a licence to check.
- **`dependency_sbom`** — a bill of materials for code dependencies.
- **`third_party_notices`** — the notices file that must ship with the product.
- **`contributor_rights`** — an assignment or licence from every contributor.
- **`design_history`** — a record the design originated here.
- **`buyer_terms`** — the licence the buyer receives.
- **`counsel_review`** — the only evidence that speaks to legal sufficiency.

A source commit is traceability, never proof of ownership. It proves the
artefact exists, not that it may be sold.

## Not legal advice

The classifications here are an engineering judgement from public licence texts.
Before any product is sold, `counsel_review` must be recorded. The value of the
registry is that it makes the question cheap to ask and impossible to skip —
not that it replaces a lawyer.
