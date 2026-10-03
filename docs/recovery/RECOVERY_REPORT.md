# Luma Foundry — Live Bundle Recovery Report (2026-10-03)

Recovered from `https://lumafoundry.live/assets/index-CKuzowX7.js` (1,001,691 bytes,
minified Vite/React bundle) WITHOUT spending Manus credits. Beautified with prettier 3.9.9.

## Source architecture (from 2877 `data-loc` annotations, 38 files)
- `client/src/App.tsx` (62), `client/src/main.tsx` (3)
- `client/src/components/DashboardLayout.tsx` (45) + ui/* (avatar, button, card, dropdown, sheet, sidebar, skeleton, sonner, tooltip)
- `client/src/contexts/ThemeContext.tsx`, `client/src/components/ErrorBoundary.tsx`
- `client/src/pages/` — 24 page files, of which 10 `*Batch*.tsx` files each bundle ~5 products → 50 products:
  ArchitectureBatchFive, CommerceBatchSeven, CommerceBatchEight, EmberSignal, FolioForms,
  HelioRelay, KineticMesh, LatticeLabs, LumaIntelligence, LuxuryBatchThree, LuxuryBatchFour,
  MorrowCompute, OrbitalLedger, SeleneAgents, ServiceBatchNine, ServiceBatchTen,
  SpatialBatchSix, StillaCareSystems, VantaProof, AxiomGrid, Home, NotFound,
  CollaborationWorkspace + others.

## Root defect (P0-P7 confirmed in code)
1. SPA catch-all: every unmatched path (sitemap.xml, robots.txt, /api/*, /api/lead*,
   *.map) returns HTTP 200 + same 370KB shell. `/api/signals` (406B JSON) is the only real endpoint.
2. Route titles exist ONLY client-side (G8 route->title map, q8 overrides) — no SSR,
   so crawlers see one title/description for all routes (P1).
3. CTA buttons are toast-only stubs: `_e("Enquiry requested", { description: "...premium template concept." })`
   — no lead endpoint/form/mail wiring (P2).
4. og:image hardcoded to `__manus/checkpoint-screenshot.png` for every route (P1/P3).
5. No source map served (.map also returns shell) (P3).

## Fonts — MAJOR finding for IP/legal clearance
Live CSS uses ONLY licence-safe Google Fonts:
  DM Sans, Archivo, Space Grotesk, Fraunces, IBM Plex Mono, JetBrains Mono, Manrope,
  Plus Jakarta Sans, Source Serif 4, Cormorant Garamond, Lora, Sora, Bodoni Moda,
  Instrument Serif, DM Mono, Arial, Georgia.
The "20 font-blocked" products are flagged for NAMING commercial typefaces in concept/copy
(Canela, Söhne/Neue Haas, DIN Mono, Aeonik, ABC Diatype, Neue Montreal, Didot/Suisse Int'l,
Editorial New, Optima, etc.) — NOT importing them. Clearance = switch concept references
to licence-safe named alternatives + record counsel_review evidence.

## Hero assets (26 unique /manus-storage/*.png) — P0
26 unique hero images, reachable set ~30 (Operator A archived 29/30 before credit exhaustion).
`masonry-films` hero = 403 (Broken). All .png-named files are actually WebP content
(need srcset + correct content-type).

## 50 product routes (slug -> title) — FULL MAP
See `catalogue.json` in this directory.

## Manus API facts (verified 2026-10-03)
- API key valid (95 chars), user 310519663909230850, credits 272/day.
- Operator A task gM8FwhLSHM7Xvq7bvUmfD2 = UNRECOVERABLE ("task has encountered an
  unrecoverable error, please start a new task") — cannot resume via task.sendMessage.
- Operator B task qZJwYN3snzuYwh1PcmNHBU = stopped.
- NO source export endpoint exists (website.export/getVersions/task.export/listFiles all 404).
- task.sendMessage schema: POST /v2/task.sendMessage {task_id, message:{content: string|array}}.
- website.status/website.listCheckpoints WORK (read-only project metadata).
- WebDev project: website_id Jx4vEohgXwp36BXoGegYMH, /home/ubuntu/luma-foundry, version bba1c8dd.
- Immutable release commit (Operator B): 4bf92357a9a47653af1331e63bc1befcd4f7bcd8 (not in any public repo).

## Credentials status (2026-10-03)
- Cloudflare token cfut_... = active, not_before 2026-10-03, expires 2027-01-01.
  Verify OK (token id bdfd0f9c76ee6b407f27e20dca5f1925). BUT zones list = empty (0 zones)
  and /user = 9109 Unauthorized (scope-limited token). 2 tokens exist on account: "Eeed", "Production".
- OpenHands API key (sk-oh..., 38 chars) committed to API-keys repo — DIFFERENT from runtime OPENHANDS_API_KEY.
- Mistral (mstrl_...), Cohere live. OpenAI live. Groq/Cerebras 403, DeepSeek 401, Anthropic 400 (header), Geminix/xAI no key.

## Accounts
- highfive251677-wq: 12 public repos (luma-foundry-core = docs only; ember-signal/ember-lite/ember-signal-backend = peripheral).
- aungmyatm187-ship-it: API-keys (private), luma-foundry-platform (public).