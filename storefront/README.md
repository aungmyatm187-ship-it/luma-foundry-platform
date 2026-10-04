# Storefront

The deployable Luma Foundry storefront — the recovered **literal** Operator A/B
master-shop source (`docs/recovery/literal-source`), made runnable and given a
real enquiry intake.

## Why this exists

The recovered source had a real defect: every CTA was a `sonner` toast stub
("Enquiry requested" with no backend). This app replaces that with a working
end-to-end enquiry flow, and exposes the buyer terms / licence surface so the
commercial path is honest rather than a dead end.

## Run it

```sh
npm start              # node server.mjs  -> http://localhost:4178
npm run generate       # rebuild catalogue.js from data/products-current.json
npm test               # syntax checks + smoke test (health, enquiry, licence, 50 products)
```

## Surfaces

| Route | Purpose |
|---|---|
| `/` | Redirects to `/shop.html` (the old Vite shell was removed) |
| `/shop.html` | 50-product catalogue (filters by buyer intent) |
| `/template.html?id=<product_id>` | Product direction page + enquiry form |
| `/licence.html` | Buyer terms & licence (single-use $79 / agency $249) |
| `POST /api/enquiry` | Real lead intake; append-only `enquiries.jsonl` ledger |
| `GET /api/health` | Health probe |

## Enquiry intake

`POST /api/enquiry` accepts `{ product_id, name, email, message }`, validates
`product_id` + a well-formed `email`, and appends one JSON line per enquiry to
`enquiries.jsonl` (gitignored). It is self-contained — no third-party email or
CRM is assumed. The merchant-of-record checkout (Lemon Squeezy) hooks in as a
separate step once activated; this intake is the lead-capture half of that path.

## Catalogue

`catalogue.js` is generated from `data/products-current.json` (the 50-product
Operator Sync sheet snapshot) by `scripts/generate-catalogue.mjs`. All 50
products are `status=live` and resolve to Luma-hosted preview URLs.
