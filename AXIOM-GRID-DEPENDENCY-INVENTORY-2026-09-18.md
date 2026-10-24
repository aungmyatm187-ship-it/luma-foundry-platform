# Axiom Grid — Release Dependency Inventory

**Prepared:** 2026-09-18  
**Product ID:** `prd-axiom-grid`  
**Release:** `checkpoint-4bf92357`  
**Immutable commit:** `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`  
**Evidence state:** Reproducible technical inventory; licence review and notices remain pending.

## Reproducible inputs

| File | SHA-256 |
|---|---|
| `package.json` | `1b5af45baa023864e9ba4ad2f4c6bde8c31bc5595e021621c69b289fd0a0dfaa` |
| `pnpm-lock.yaml` | `302c67a03d1c3f4d17e8f5108dd4ee09790f75a83ee8b15f03ec3f723afce857` |

The inventory was generated read-only from the current project state using the production dependency view (`pnpm list --prod --depth 0 --json`). It found **64 direct production dependency entries** and **64 resolved top-level entries** in the captured output. The lockfile remains the authoritative source for exact transitive resolution, peer variants, patches, and integrity metadata.

## Direct production dependency names

The captured direct production set includes React/React DOM, Express, tRPC, Drizzle ORM, MySQL2, AWS S3 client packages, Zod, Vite-adjacent UI packages, Tailwind utilities, Framer Motion, Recharts, Wouter, and related runtime libraries. The exact names are:

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@hookform/resolvers`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `@tanstack/react-query`, `@trpc/client`, `@trpc/react-query`, `@trpc/server`, `axios`, `class-variance-authority`, `clsx`, `cmdk`, `cookie`, `date-fns`, `dotenv`, `drizzle-orm`, `embla-carousel-react`, `express`, `framer-motion`, `input-otp`, `jose`, `lucide-react`, `mysql2`, `nanoid`, `next-themes`, `react`, `react-day-picker`, `react-dom`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `streamdown`, `superjson`, `tailwind-merge`, `tailwindcss-animate`, `vaul`, `wouter`, `zod`.

## Licence and notice boundary

This report verifies manifest hashes and the captured dependency inventory only. It does **not** establish:

- package-by-package licence identity or compatibility;
- completeness of transitive dependency review;
- absence of restrictive or reciprocal obligations;
- completeness of third-party notices or attribution text; or
- commercial clearance for Axiom Grid.

## Next verification step

Generate an owner-approved SPDX or CycloneDX artifact from this exact release, inspect package metadata and licence texts, identify notice/attribution obligations, assess restrictive licences against the intended template licence and delivery model, and record the reviewer/date in the shared register. Do not modify production dependencies for this evidence task.

**Current commercial decision:** `Conditional / blocked pending evidence`.
