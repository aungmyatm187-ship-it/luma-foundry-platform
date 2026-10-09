# Fluid Prompt Pack — Task Breakdown

**Source:** `docs/reviews/2026-10-09-fluid-prompt-pack.md`
**Purpose:** Decompose each prompt into discrete, applicable steps.

## Total realistic effort

| Prompt | Sessions | Calendar |
|---|---|---|
| 0 — Audit | 1 | 1 day |
| 1 — Governance | 3 | 1 week |
| 2 — Catalogue | 2 | 2 days |
| 3 — Storefront | 3 | 1 week |
| 4 — Workspace | 10–12 | 2–3 weeks |
| 5 — Integration | 2 | 2 days |

**Total: 21–23 sessions, ~6–8 weeks part-time.**

## Prompt 1 — Solid governance foundation (4–6 hours)

### 1.1 — Server-derived actor role (2h)
- Add `effectiveRole` to tRPC context by querying `users.role` with `ctx.authUserId`
- Reject mutations where the client role does not match `effectiveRole`
- Tests: `operator_a` claiming `owner` rejected; `owner` claiming `operator_b` recorded as `owner`; unknown user rejected; valid role accepted

### 1.2 — Persisted owner approval model (4h)
- New table `approvals` (id, decision_id, approver_auth_id, approver_role, approved_at, note)
- RLS policy: only owner role can insert
- New `SECURITY DEFINER` function `record_owner_approval`
- New trigger on `products` that blocks `cleared` unless approval row exists
- **Do not start before 1.1 is green**

### 1.3 — Unify `assertTransitionAllowed` with workflow approval (1h)
- Pass `approvals` into `assertTransitionAllowed`
- If `status === 'cleared'`, require an `approvals` row with `approver_role = 'owner'`

## Prompt 2 — Safe catalogue (2 hours)

### 2.1 — Contract validator (45m)
- `storefront/scripts/validate-catalogue.mjs`
- Rejects: missing id, duplicate id, malformed URL, invalid collection

### 2.2 — Replace `innerHTML` with DOM construction (60m)
- Rewrite `shop.js` / `template.js` with `document.createElement` + `textContent`
- URL allowlist

### 2.3 — Honest state language (15m)
- Distinguish catalogue-listed / live preview / cleared / checkout-enabled

## Prompt 3 — Fluid storefront (6–8 hours)

### 3.1 — Design tokens (2h)
- Replace `styles.css` color variables with Signal Atelier palette
- Load Space Grotesk + Manrope

### 3.2 — Search + URL sync (2h)
- Full-text search over name/category/direction
- URL query params, popstate restore

### 3.3 — Responsive nav shell (1h)
- Shared across shop, template, licence
- Mobile hamburger, desktop horizontal

### 3.4 — Motion + a11y (2h)
- Press/lift/hover, 220–320ms
- Focus halos
- `prefers-reduced-motion` disables travel

## Prompt 4 — Private workspace UI (2–3 weeks)

### 4.1 — Frontend stack decision (1 session)
### 4.2 — Auth session in browser (2 sessions)
### 4.3 — Workspace shell (3 sessions)
### 4.4 — Product detail view (2 sessions)
### 4.5 — Approval flow (2 sessions)

**Do not start before prompts 1–3 are merged.**

## Prompt 5 — Integration pass (3 hours)

### 5.1 — Trace one product end to end
### 5.2 — Trace one workspace product
### 5.3 — Reconcile deployment reality
### 5.4 — Final test pass

## Sequence

1. Save these docs (today)
2. Prompt 0 — read-only audit (fresh session)
3. Prompt 1.1 — server-derived actor roles (fresh session)
4. Stop, review, decide
5. Then continue
