# Hero Assets — Audit & What's Needed

Audited 2026-10-01 against the live site (`lumafoundry.live`) and the extracted bundle.

## The problem, measured

**47 catalogue entries share only 22 unique images. 40 of 47 products reuse another
product's hero.**

That is the "same photo using error" — and it is worse than it looks, because the reuse is not
random. It follows the batch structure exactly:

| Image | Used by | Count |
|---|---|---:|
| `kinetic-mesh-hero` | Kinetic Mesh, Pattern School, Corella Run | 3 |
| `lattice-labs-hero` | Lattice Labs, Civic Assembly, Arq Supply | 3 |
| `folio-forms-hero` | Folio Forms, Sable & Type, Havenlark | 3 |
| `aster-alder-hero` | Aster & Alder, Northline Counsel, Perrin Carry | 3 |
| `sardis-parfums-hero` | Sardis Parfums, Vesper Pantry, Ora Roasters | 3 |
| `peregrine-editions-hero` | Peregrine Editions, Kansa Objects, Formwell Interiors | 3 |
| `ruth-ibarra-hero` | Ruth Ibarra Botanics, Terra Forma, Alder House | 3 |
| `tempo-atelier-hero` | Tempo Atelier, Veloce District, Monolith Works | 3 |
| `caldera-optical-hero` | Caldera Optical, Hinge & Hearth, Studio Lumen | 3 |
| `mare-house-hero` | Maré House, Fieldnote Cabins, Nocturne Estates | 3 |
| `orbital-ledger-hero` | Orbital Ledger, Solace Audio | 2 |
| `helio-relay-hero` | Helio Relay, Basil & Bone | 2 |
| `elan-method-hero` | Élan Method, Wildercare | 2 |
| `vela-maison-hero` | Vela Maison, Maison Rook | 2 |
| `luma-intelligence-hero` | Luma Intelligence, **Ember Signal** | 2 |

The pattern: **only the first product of each batch got a bespoke hero.** The remaining four in
each batch inherited it. Ember Signal — one of the three flagship AI products — is showing Luma
Intelligence's hero.

## Second bug: format mislabelling

Every hero is served as **WebP but named `.png`**. Confirmed by fetching and reading the file
header:

```
axiom-grid-hero_46c3b0f8.png   HTTP 200   RIFF....WEBPVP8   1920x1080   283 KB
kinetic-mesh-hero_682e14df.png HTTP 200   RIFF....WEBPVP8   1920x1080   321 KB
luma-foundry-mark_e8a0bb3e.png HTTP 200   RIFF....WEBPVP8X  1920x1920   713 KB
```

Also: `/manus-storage/*` returns **307 redirects**, and the images are served through Manus's
proxy — not from the site's own origin. Every hero load pays that hop.

## Third issue: four assets are defined but never used

```
luma-foundry-mark_e8a0bb3e.png         (the brand mark — 1920x1920, 713 KB)
luma-intelligence-agents_352e3e15.png
luma-intelligence-memory_62a5a77a.png
luma-intelligence-synthesis_4cb322c5.png
```

These are paid for and unused. The three `luma-intelligence-*` images were built to show the
three pillars (agents, memory, synthesis) — that content exists but is not placed.

## What is needed

### 1. Bespoke heroes — 25 to make, not 50

Current unique images: 22. Products needing their own: 25 (the two- and three-way sharers,
minus the four flagship products that already have theirs).

| Priority | Products | Why first |
|---|---|---|
| **P0** | Ember Signal | Flagship product showing the wrong brand's hero |
| **P1** | Pattern School, Corella Run, Civic Assembly, Arq Supply, Sable & Type, Havenlark | Share a hero with a product from a **different category** — most visibly wrong |
| **P2** | The remaining 18 two/three-way sharers | Same-category sharing; still a defect |

The cross-category shares are the worst: **Sable & Type** (a brand agency) currently shows
**Folio Forms**' generative-brand art; **Arq Supply** (architect tools) shows **Lattice Labs**'
research art. A visitor comparing two products sees the same picture.

### 2. Fix the format label

Serve `.webp` as `.webp`. Either rename at the origin or add a rewrite. Cheap, immediate, and it
removes a correctness bug and a caching hazard.

### 3. Place the four unused assets

The `luma-intelligence-*` trio belongs on the Luma Intelligence page as its three pillars. The
brand mark belongs in the header/favicon. 713 KB is too heavy for a mark — downscale it.

### 4. Image specification

Current heroes are 1920x1080 WebP at ~300 KB. For a Myanmar audience on mobile data that is
heavy. Recommended:

| Property | Current | Target |
|---|---|---|
| Format | WebP mislabelled `.png` | WebP (AVIF fallback) |
| Hero size | 1920x1080, ~300 KB | 1600x900, <120 KB |
| Mark | 1920x1920, 713 KB | 512x512, <40 KB |
| Delivery | `/manus-storage/*` via 307 | site origin or CDN |
| Responsive | none observed | `srcset` at 640/1024/1600 |
| Lazy loading | none observed | `loading="lazy"` below the fold |

### 5. Art direction must be licensed, not just generated

This is the part that is easy to miss. **A new hero is not cleared because it exists.** The
platform's governance gate requires `asset_licence` — and generated imagery needs a stated
licence just as stock does. The `hero-asset` workflow in
`packages/core/src/workflows.ts` encodes this: the `assets` stage **cannot be left** until
`asset_licence` evidence is recorded.

That is deliberate. Generating 25 replacement heroes without recording their licence would move
the problem, not fix it.

## Who does what

This is not a single-actor job.

| Work | Actor | Notes |
|---|---|---|
| Art direction per product | Manus (Operator A) | The catalogue already specifies palette, type, and layout per product |
| Asset generation | Manus | Needs the batch's visual identity as input |
| Licence recording | Operator B | Gate: `asset_licence` evidence |
| Format/label fix | OpenHands | Origin config; no art needed |
| `srcset` + lazy loading | OpenHands | Front-end, no art needed |
| Placement of unused assets | OpenHands | Front-end |
| Approval to publish | Owner | Gate: `publish` stage |

## What is needed from the owner

1. **Which art source?** Generated, commissioned, or licensed stock. Each carries different
   licence evidence, and the gate will ask for it.
2. **Is there a budget for 25 heroes?** This is the one part of the pivot that may cost money.
3. **May the format/label and loading fixes ship without waiting for the art?** They are
   independent and would improve the site today.

Items 2 and 3 in the "who does what" table need no art and no budget — they can start now.
