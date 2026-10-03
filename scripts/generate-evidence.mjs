/**
 * Luma Foundry — evidence generator.
 *
 * Produces the evidence kinds that are *deterministically* generatable from the
 * recovered storefront source and the core catalogue, using the real audit
 * functions in @luma/core. It deliberately does NOT fabricate the kinds that
 * require a human (counsel_review) or an owner-signed record
 * (contributor_rights, design_history). Those are reported as missing so the
 * clearance gate stays honest.
 *
 * Run:  node scripts/generate-evidence.mjs
 */
import {
  auditCatalogue,
  CATALOGUE,
  evaluateClearance,
  REQUIRED_EVIDENCE,
} from '../packages/core/dist/index.js';

/**
 * Real dependency inventory recovered from the literal storefront source
 * (docs/recovery/literal-source/A*__*.tsx imports). Licence classifications
 * follow the SPDX identifiers and the resale-safe model in licensing.ts.
 */
const STOREFRONT_DEPENDENCIES = [
  { name: 'react', licence: 'MIT', resaleSafe: true },
  { name: 'react-dom', licence: 'MIT', resaleSafe: true },
  { name: 'wouter', licence: 'MIT', resaleSafe: true },
  { name: 'sonner', licence: 'MIT', resaleSafe: true },
  { name: 'lucide-react', licence: 'ISC', resaleSafe: true },
  { name: 'class-variance-authority', licence: 'Apache-2.0', resaleSafe: true },
  { name: '@radix-ui/react-slot', licence: 'MIT', resaleSafe: true },
];

const RECOVERED_SOURCE_COMMIT = process.env.LUMA_SOURCE_COMMIT ?? '695842a8e436aa6ddff43f5adb9d0b53397d48aa';
const RECOVERED_SOURCE_PATH = 'docs/recovery/literal-source/';

/** Emit a stable third-party notices block from the SBOM. */
function thirdPartyNotices() {
  return STOREFRONT_DEPENDENCIES.map(
    (d) => `${d.name} — ${d.licence}${d.resaleSafe ? ' (resale-safe)' : ''}`,
  ).join('\n');
}

function main() {
  const audit = auditCatalogue();

  const report = {
    generatedAtUtc: new Date().toISOString(),
    sourceCommit: RECOVERED_SOURCE_COMMIT,
    recoveredSourcePath: RECOVERED_SOURCE_PATH,
    catalogue: {
      total: CATALOGUE.length,
      fontResaleSafe: audit.cleanProducts.length,
      fontBlocked: audit.blockedProducts.length,
      blocked: audit.products.filter((p) => !p.clear),
    },
    sbom: {
      dependencies: STOREFRONT_DEPENDENCIES,
      allResaleSafe: STOREFRONT_DEPENDENCIES.every((d) => d.resaleSafe),
    },
    thirdPartyNotices: thirdPartyNotices(),
    clearance: {
      requiredEvidence: [...REQUIRED_EVIDENCE],
      // A product can only be marked cleared when every required kind is present.
      // No evidence records exist yet for the recovered catalogue, so every
      // product reports all eight kinds as missing — this is the honest state.
      productsClearable: 0,
      productsTotal: CATALOGUE.length,
      sample: evaluateClearance(
        { id: 'prd-axiom-grid', status: 'live' },
        [],
      ),
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main();
