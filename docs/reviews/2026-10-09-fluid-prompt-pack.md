# Luma Foundry: “Solid + Liquid = Fluid” — Repository Analysis & Prompt Pack

**Prepared:** 2026-10-09  
**Repository reviewed:** `aungmyatm187-ship-it/luma-foundry-platform`  
**Reviewed branch:** `feat/evidence-review-packet` (commit `6ee045a` is in its recent history)  
**Purpose:** Turn “solid + liquid = fluid” into a practical product and engineering direction, then provide prompts that can be pasted into a coding agent one stage at a time.

## Executive reading

For Luma, interpret the phrase as:

- **Solid:** trustworthy product data, identity-bound permissions, explicit approval, append-only evidence, and legible release states.
- **Liquid:** reusable workflow stages that can be composed differently for product releases, evidence review, workshops, and deployments.
- **Fluid:** an experience that adapts to the person, product, and current stage; keeps context as work moves between surfaces; and makes the next action obvious—without bypassing any approval or evidence gate.

This is more than animation. The core workflow code already uses the “water / reusable vessels” metaphor (`packages/core/src/workflow.ts` and `packages/core/src/workflows.ts`). The next opportunity is to make the product surfaces embody the same idea.

**Safe default:** retain **Luma Foundry** as the public brand. Treat **Luma Intelligence** as a product-direction concept from the supplied notes, not an approved public rename. Use the selected **Signal Atelier** visual direction; do not mix it with the separate Ember Signal / AI Marketer color concept. Visual fluidity must never imply that a product is commercially cleared, that evidence is verified, or that checkout is available.

## Repository analysis

### What is already solid

1. **A useful domain model exists.** `packages/core/src/types.ts` defines explicit product statuses (`concept`, `in_build`, `in_review`, `conditional`, `cleared`, `blocked`), evidence kinds, work-item statuses, decision statuses, handoff statuses, and roles.
2. **The workflow engine supports flexible composition.** `packages/core/src/workflow.ts` declares stages, transitions, entry capabilities, and exit gates. `packages/core/src/workflows.ts` composes that engine into product-release, hero-asset, workshop, automation-deploy, and evidence-review workflows. Clearance is intended to require both evidence and owner approval.
3. **There is a reviewer packet, not an automatic verifier.** Commit `6ee045a` adds a read-only evidence packet through core, API, and MCP. It reports which required record types are present and explicitly warns that presence, a recorder-role label, and a reference do not independently prove truth, identity, rights, legal sufficiency, or owner approval.
4. **A real data-backed API path exists.** Authenticated API requests can use `AsyncWorkspace.fromDrizzle(authUserId)`; the Drizzle repository scopes queries through Supabase identity and database row-level security. The core also keeps an in-memory implementation for tests and local use.
5. **The public storefront has a working local foundation.** `/` redirects to `/shop.html`; the shop has six intent filters; `template.html?id=…` renders product details; a licence page exists; and `POST /api/enquiry` accepts and records enquiries in a local append-only JSONL file.
6. **Commercial limits are disclosed in places.** The active catalogue says payment is disconnected and template detail pages say checkout is offline; do not remove or contradict those disclosures until the payment and fulfilment path is truly configured.

### What is not yet fluid—and why

| Area | Verified repository state | Product consequence |
|---|---|---|
| **The chosen visual system is not active in the shop** | The supplied notes choose Signal Atelier: cool ink, Signal Cyan `#5AF4E5`, violet, selective prismatic glass, Space Grotesk + Manrope, editorial asymmetry, and restrained motion. Active `storefront/styles.css` is black/cream/gold and uses Instrument Serif + Manrope. | Reconcile the design system deliberately instead of layering arbitrary glow or glass effects onto the current CSS. |
| **The shop is a filtered grid, not progressive discovery** | `shop.html` has category filters; `shop.js` only filters by collection. There is no full-text search, sort control, URL-synced filter state, or designed no-results experience. | Buyers cannot fluidly move from a broad collection to the right direction. |
| **Most catalogue cards have weak visual/content data** | The active generated catalogue contains 50 products in groups of 8 systems, 2 insight, 11 luxury, 13 spatial, 8 objects, and 8 practice. **45/50 lack image URLs** and **45/50 use the generic “An original [category] direction…” description.** | The grid looks repetitive and communicates little differentiation; prompts must use real data and honest placeholders, never invented product specifics. |
| **Catalogue refresh is manual and old** | `storefront/catalogue.js` says its source is a shared sheet and sync mode is manual. Its timestamp is `2026-08-27T02:44:28Z`, while the repository review is dated 2026-10-09. A generator maps the sheet snapshot into a browser JS module. | Show freshness honestly and validate the generated data; do not silently treat an old snapshot as live operational truth. |
| **Public catalogue and private domain products are different models** | The storefront snapshot has hosted preview URL, image, tone, collection, and release copy; the core `Product` type has goal, name, category, route, status, and timestamps. No clear adapter unifies the 50 shop records with the workspace products. | A shared interface needs explicit IDs/mapping and a source-of-truth decision, not two drifting product lists. |
| **No active browser workspace UI is present in the tracked app surface** | The active code has an API/core and a static storefront, but no current web client wired to the API. A React collaboration workspace exists under `docs/recovery/literal-source/`, which is a recovery artifact, not an active app. | Building a real private workspace is a separate, scoped frontend task—not just restyling the shop. |
| **The recovered workspace component is not a safe drop-in** | Its status vocabularies and assumptions do not match current types: it references `goal.status`, priorities such as `focus/next/later`, work states such as `backlog/review`, handoff `open`, and decision `pending`; current domain enums differ, IDs are UUID-like strings, and the current API requires fields the recovered component does not send. | Use it only as a visual/product reference. Regenerate the UI against the active API types and tests. |
| **Approval enforcement is not yet one path** | `STAGE.clearance` in the workflow catalogue requires owner approval, but `AsyncWorkspace.updateProductStatus()` calls `assertTransitionAllowed()` with product and evidence only. The workflow engine’s approval context is a separate layer. | A fluid status UI must not expose a status mutation that skips the actual owner approval workflow. Unify this before presenting a “clear” action. |
| **Some actor claims are caller-supplied** | API inputs include role-like values such as `recordedBy`, `decidedBy`, `fromRole`, and `toRole`; the product-status API is protected by authentication but uses the current evidence-only transition guard. | Authenticated is not the same as authorized as owner/operator. Derive actor identity and role server-side; never trust a browser-provided role as proof. |
| **Public rendering needs a data-safety pass** | `storefront/shop.js` and `storefront/template.js` interpolate catalogue strings and URLs into `innerHTML`. The catalogue is generated from sheet-like external data. | Validate/safely render all imported text and URLs to prevent injection or unsafe link targets. |
| **Mobile navigation is inconsistent** | The shop has a menu toggle; template and licence markup do not. CSS hides `.site-nav` at the mobile breakpoint, so those pages can lose the primary navigation. | A shared responsive shell is part of fluidity, not a decorative extra. |
| **The enquiry storage model does not match the deploy target by itself** | `storefront/server.mjs` uses Node’s filesystem `appendFile()` for enquiries. `wrangler.toml` declares only a static assets directory, while deployment docs discuss Cloudflare Pages/Workers. That declaration alone does not demonstrate that the Node endpoint or durable enquiry storage is deployed. | Keep local enquiry behavior honest; verify and design a Worker-compatible, durable endpoint before claiming production lead capture. No secrets or paid setup should be invented. |
| **Motion/accessibility needs a complete specification** | CSS has a reduced-motion block, but the chosen design notes require high-contrast focus halos and removal of all travel, shimmer, and nonessential pulses; current CSS does not show a shared focus treatment. | Add motion only to clarify state and progress; provide keyboard, reduced-motion, and mobile equivalents. |

### Recommended implementation order

1. **Solid first:** establish server-derived identity/role and one enforceable clearance/owner-approval path; test API, MCP, and repository paths.
2. **Make data trustworthy:** validate the generated catalogue, prevent unsafe HTML/URL interpolation, and define how storefront product IDs relate to core product records.
3. **Make the public journey liquid:** align the storefront to Signal Atelier, add search and URL-persistent discovery, and make each product/detail state truthful and responsive.
4. **Build the missing private surface:** implement a small authenticated workspace that uses current API contracts—not the archived component—and presents goals, work, handoffs, decisions, evidence, and blockers as contextual next actions.
5. **Verify the actual runtime:** test local/Termux behavior and separately document what is or is not deployed on Cloudflare; do not imply production persistence from a static-asset deploy.

## Copy-ready prompts

Paste the prompts **in order**, into a coding agent opened at the repository root. Each is intentionally scoped so a large redesign does not obscure security or data truth. “Do not ask me questions” is included; when a low-risk choice is open, use the conservative default above and record it.

### Prompt 0 — Repository truth and implementation plan (read-only)

```text
You are working in the existing Luma Foundry repository. Do not ask me questions. First inspect the current branch, working tree, package scripts, active app directories, core/API/MCP/workflow code, storefront source and generated catalogue, database migrations, deployment configuration, and relevant docs. Separate tracked active code from docs/recovery/literal-source artifacts; never describe a recovered file as an active feature.

Product thesis: “Solid + liquid = fluid.” Solid means reliable domain data, identity-bound authorization, explicit approvals, and auditable evidence. Liquid means recomposable stages and role/context-sensitive work. Fluid means the user can move through the experience with preserved context and an obvious next action, without weakening any gate. Use the supplied Signal Atelier direction: cool near-black ink, Signal Cyan #5AF4E5, restrained violet, hard readable typography, Space Grotesk + Manrope, glass only for selected elevated surfaces, solid surfaces for dense work, an orbital signal motif only when it communicates status/progression, high-contrast keyboard focus, and reduced-motion support. Retain the public brand name Luma Foundry; treat “Luma Intelligence” as a concept, not an approved rename. Do not mix in the separate Ember Signal orange/lime direction.

Produce a concise but evidence-based audit with: (1) active architecture and user journeys; (2) domain/API contracts and current state vocabularies; (3) actual product-catalogue fields, freshness, missing fields, and counts; (4) auth, role, evidence, and owner-approval paths; (5) UI/accessibility/mobile gaps; (6) local versus Cloudflare deployment/runtime behavior; (7) exact risks, file paths/line references, and a staged plan with acceptance tests. Check claims against source code, not README statements alone. Do not edit files, install dependencies, write to databases, push, deploy, or change credentials. Make conservative assumptions explicit rather than asking me.
```

### Prompt 1 — Make the governance foundation genuinely solid

```text
Implement the smallest secure change that makes Luma’s product-clearance and actor-attribution rules true at every active write boundary. Before editing, trace the current product-status mutation through the API, AsyncWorkspace, repository implementations, MCP, workflow context, and tests.

Non-negotiable invariants:
- Derive the authenticated user and effective role on the server from the verified Supabase identity and its user record. A request field such as recordedBy, decidedBy, fromRole, toRole, or role is descriptive input at most; it must never grant authority or impersonate another actor.
- Owner clearance/approval must be an actual persisted decision attributable to the authenticated owner, not merely a Role string in client input or a boolean in the browser.
- The “cleared” product transition must require the same required evidence and owner approval regardless of whether it is attempted through tRPC, MCP, a workflow, or another repository-backed route. Reuse/refactor the existing domain policy rather than creating a second inconsistent rule set.
- Preserve evidence as append-only and preserve the evidence-review packet’s explicit limitation: record presence is not proof of truth, authorship, scope, provenance, or legal sufficiency.
- Keep row-level isolation. Do not add an override flag, trust a forged client role, or weaken a trigger/RLS policy to make the UI easier.

Add focused unit and API/MCP tests for: an authenticated non-owner cannot approve or clear; a client cannot claim owner/Operator B identity; missing evidence blocks; complete evidence without a real owner decision blocks; a real authorized owner decision plus the required records succeeds; unauthenticated access is rejected; read-only evidence packet calls remain non-mutating. Use existing enum values and schema unless a migration is demonstrably required. If a required identity mapping or persisted approval model is missing, implement the minimal coherent model with a migration and rollback/compatibility notes; do not silently fake it. Run the relevant tests, full build, and git diff --check. Do not deploy, push, or change external account settings. Summarize files changed, invariant coverage, tests, and any remaining limitations.
```

### Prompt 2 — Make catalogue data safe, current, and coherent

```text
Harden Luma’s catalogue without inventing product facts. Inspect storefront/data/products-current.json, storefront/scripts/generate-catalogue.mjs, storefront/catalogue.js, the core Product type, and all uses of catalogue values in HTML/JavaScript. Preserve stable product IDs and existing hosted preview destinations unless validation proves a URL invalid.

Implement:
1. A validated catalogue contract for required IDs, names, categories/collections, preview URLs, image URLs, and explicit release/payment state. Reject malformed records at generation time with a useful product-specific error. Allow an intentionally absent image/description, but render an honest designed placeholder rather than fabricating one.
2. Safe output handling. Do not interpolate sheet/catalogue text or arbitrary URLs into innerHTML. Use DOM construction and textContent, or a well-reviewed escaping/URL-validation layer. Allow only the expected https preview/image origins or an explicit documented allowlist; external links must use safe target/rel behavior. Add regression tests with HTML/script payloads and unsafe URL schemes.
3. A clear source-of-truth statement and reproducible generation check. Report the source snapshot timestamp in the UI or an unobtrusive status element without calling stale data “live”. Keep catalogue product identity separate from workspace product lifecycle until an explicit, tested ID mapping exists.
4. Honest state language: distinguish “catalogue-listed,” “live preview,” “commercially cleared,” and “checkout enabled.” A sheet status of live must not be presented as legal clearance or a functioning purchase path.

Do not invent images, customer outcomes, metrics, rights, release proof, or new commercial terms. Do not change prices or activate checkout. Add tests for all 50 current records, unique IDs, collection mapping, URL validity, missing-image behavior, and safe rendering. Run storefront tests, full build/tests, and git diff --check; do not push or deploy.
```

### Prompt 3 — Make the public storefront fluid (Signal Atelier)

```text
Improve the active public storefront in storefront/—shop.html, template.html, licence.html, shop.js, template.js, and styles.css—without replacing it with a new framework or copying archived recovery code. First confirm the current markup and tests. Keep Luma Foundry as the public brand; treat Luma Intelligence as a concept only. Use Signal Atelier: cool near-black ink, Signal Cyan #5AF4E5 for active flow/focus, restrained violet for authored possibility, quiet pearl/fog text, Space Grotesk for display/navigation and Manrope for body/data, editorial asymmetry, and selective prismatic glass. Solid panels must anchor dense product information. No ambient glow overload, no unsupported performance promises, and no use of the separate Ember Signal orange/lime palette.

Build a cohesive, progressively enhanced customer journey:
- Add accessible full-text search over real name/category/direction fields; keep the existing category filters; add a useful sort only if it uses real catalogue values. Sync search/filter state to URL query parameters and restore it on back/forward navigation.
- Include clear no-results/reset states, a correct live result count, keyboard-operable controls, visible focus halos, and mobile-safe controls. Give shop, detail, and licence pages a consistent responsive menu; do not leave the detail/legal page with its navigation hidden on mobile.
- Make product cards useful even when their preview image is absent (45 of the current 50 records lack images). Do not generate fake thumbnails or pretend that missing imagery is available. Improve the template detail route with clear category, preview, and next-action context using only stored data.
- Use motion only to explain interaction or progression: press response, subtle card lift, and restrained 220–320 ms transitions. Add tasteful entrance/reveal only where it improves orientation. Under prefers-reduced-motion, remove travel, shimmer, pulsing, and nonessential animation; do not rely on animation to communicate state.
- Preserve accessible source order, skip links, semantic headings, contrast, and useful status announcements. The existing unused product dialog may be removed or made purposeful; do not leave dead controls.
- Keep live demos clearly separate from purchase: checkout is disconnected, and an enquiry is not an order. Do not activate payment, claim commercial clearance, or invent release/evidence details. Ensure enquiry feedback handles loading, failure, and success accurately.

Prefer shared tokens and small components over a wholesale rewrite. Add browser-level or DOM tests for keyboard, URL state, empty results, responsive navigation, reduced-motion CSS, safe catalogue content, and demo/enquiry labels. Run the storefront tests and full repository build/tests; verify the pages at mobile and desktop widths if a browser test setup exists. Do not push or deploy.
```

### Prompt 4 — Build the missing private Foundry workspace against real contracts

```text
Create a minimal, real private workspace UI for Luma Foundry, but first inspect the active root workspace scripts, apps, API router, tRPC/client support, auth flow, core types, and test patterns. The active repository contains a backend/API and static public storefront; the React component under docs/recovery/literal-source is only a historical visual reference and its data contracts are incompatible. Do not copy it wholesale and do not add a second fake/mock domain model.

Use the existing authenticated API and generated types. The application must keep public storefront browsing separate from the private workspace’s authentication boundary while using the same Signal Atelier design tokens. Retain Luma Foundry as the product name. Build a progressive, contextual work surface around the actual domain: Goals → Products → Work items → Handoffs → Decisions → Evidence review packet. Show only actions the authenticated user is permitted to perform. The next action should adapt to the selected product’s actual status and recorded blockers rather than presenting a generic linear wizard.

Use exactly the active enum values from packages/core/src/types.ts: product concept/in_build/in_review/conditional/cleared/blocked; work todo/in_progress/blocked/done; decisions open/approved/declined/deferred; handoffs draft/sent/accepted/returned; priorities low/medium/high/critical. Do not add legacy states such as backlog, pending, or open handoff. Use string IDs, not numeric casts. Do not infer authorization from a client-side role selector. The API must supply authoritative identity/role and reject unauthorized writes. Never treat the evidence packet as a verifier or approval.

Provide loading, empty, stale/error, retry, success, and blocked states; explain blockers in plain language and link each to its evidence/action. Do not optimistic-update a clearance state before the server confirms it. Keep keyboard navigation, reduced-motion support, responsive/mobile layout, and a readable dense-data mode. Do not add speculative analytics, fake data, customer evidence, or a payment flow.

If there is no suitable active frontend stack, choose the smallest maintainable option compatible with the existing monorepo and Termux/Linux Node workflow; explain any dependency before adding it. Add UI/API integration tests proving auth, role boundaries, state transitions, evidence packet limitations, and failure/loading states. Run the full build/tests. Do not deploy or push.
```

### Prompt 5 — Make the product journey and runtime actually join up

```text
Do a release-readiness integration pass for the Luma Foundry experience after the prior prompts are implemented. Trace one real product record from catalogue listing through preview/detail/enquiry, then trace an authenticated workspace product from goal through work, handoff, evidence packet, owner approval, and cleared status. Identify where IDs, data, state, errors, or user context are lost; fix the smallest real defects and test them.

Specifically verify:
- The public catalogue stays read-only and does not accidentally mutate workspace records.
- Any catalogue-to-workspace link uses an explicit stable mapping; absent a mapping, show a deliberate handoff state instead of guessing by product name.
- All transitions are enforced server-side and use the same governance rule in API/MCP/repository paths. The UI does not claim that “all evidence kinds recorded” means proof or legal approval.
- Product copy distinguishes concept, live demo/preview, review, conditional, cleared, and payment/checkout state accurately. Do not expose a purchase action unless checkout, fulfilment, rights evidence, and the applicable approval gates are truly active.
- Public enquiry handling is validated, bounded, privacy-conscious, and has accurate success/failure behavior. Do not store production personal data in an ephemeral local filesystem or claim a static asset deployment is a durable API.
- Reconcile storefront/server.mjs and its filesystem JSONL behavior with wrangler.toml and .github/workflows/storefront-deploy.yml. The current Wrangler config declares static assets; the local Node server’s appendFile endpoint is not thereby proven to run on the deployed Worker. If a Worker/API/storage binding is not already configured, document the exact production blocker and keep local behavior honest; do not fabricate a binding, secret, deployment, or live URL.
- Run format/typecheck/build/unit/API/MCP/storefront tests; add regression tests for any issue found. Check mobile/desktop keyboard flows, reduced motion, and no-JavaScript/error cases where relevant. Run git diff --check and report exact commands/results.

Do not change DNS, secrets, checkout/billing, database contents, or production deployment. Do not push or merge. Finish with a concise go/no-go table: local functionality, authorization/governance, catalogue truth, accessibility, and production runtime—each backed by a test or an explicit unresolved blocker.
```

## Definition of “fluid” for acceptance reviews

A future reviewer can call the experience **fluid** only when all of these are true:

1. **The surface adapts; the rules do not drift.** UI state is contextual, while server-side authorization and domain gates remain authoritative.
2. **One next action is visible.** The user can see why that action is relevant and what blocks it; no silent automation or implied approval.
3. **The same product keeps its identity.** Public catalogue and private workspace records are connected by a stable, explicit ID—not name matching or duplicate hand-maintained status.
4. **State language is truthful.** A preview is not a sale, a record is not proof, and a complete evidence-kind checklist is not legal clearance.
5. **Motion has a purpose and an off switch.** Every animation explains focus/progression, works with a keyboard, and disappears under reduced-motion preferences.
6. **Production claims match the runtime.** A local JSONL file is not cloud persistence; static assets are not automatically an API; a visible price is not a working checkout.

## Scope note

This file is a **prompt pack and repository analysis**, not an implementation commit. It proposes a safe order of work and does not alter application code, database state, payment configuration, or deployment settings.
