/**
 * Luma Foundry — evidence generator + honest clearance report.
 *
 * Produces every evidence kind a machine can legitimately generate, and emits a
 * per-product clearance report across the full 50-product catalogue. It does NOT
 * fabricate the four human-gated kinds (design_history, asset_licence,
 * contributor_rights, counsel_review) — those are reported as missing so the
 * clearance gate stays honest.
 *
 * Run:  node scripts/generate-evidence.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  CATALOGUE,
  HUMAN_EVIDENCE_KINDS,
  MACHINE_EVIDENCE_KINDS,
  REQUIRED_EVIDENCE,
  auditCatalogue,
  evaluateClearance,
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

/** Stable third-party notices block from the SBOM. */
function thirdPartyNotices() {
  return STOREFRONT_DEPENDENCIES.map(
    (d) => `${d.name} — ${d.licence}${d.resaleSafe ? ' (resale-safe)' : ''}`,
  ).join('\n');
}

/** Machine-generatable evidence records for one product. */
function machineEvidenceFor(route) {
  return [
    { kind: 'source_commit', reference: RECOVERED_SOURCE_COMMIT, note: `Recovered source commit for ${route}` },
    { kind: 'dependency_sbom', reference: 'scripts/generate-evidence.mjs#STOREFRONT_DEPENDENCIES', note: 'Resale-safe dependency inventory (SPDX)' },
    { kind: 'third_party_notices', reference: 'scripts/generate-evidence.mjs#thirdPartyNotices', note: 'Generated third-party notices' },
    { kind: 'buyer_terms', reference: '/licence.html', note: 'Buyer terms surface (licence.html)' },
  ];
}

function main() {
  const audit = auditCatalogue();
  const fontStatus = new Map(audit.products.map((p) => [p.route, p]));

  const perProduct = CATALOGUE.map((p) => {
    const font = fontStatus.get(p.route);
    const machine = machineEvidenceFor(p.route);
    const machineKinds = machine.map((e) => e.kind);
    const report = evaluateClearance({ id: `prd-${p.route}`, status: 'live' }, []);

    return {
      id: `prd-${p.route}`,
      name: p.name,
      category: p.category,
      route: `/${p.route}`,
      fontLicence: { clear: font ? font.clear : false, blocked: font ? font.blocked : [] },
      machineEvidencePresent: machineKinds,
      machineEvidenceMissing: MACHINE_EVIDENCE_KINDS.filter((k) => !machineKinds.includes(k)),
      humanEvidenceMissing: [...HUMAN_EVIDENCE_KINDS],
      clearable: report.clearable,
    };
  });

  const clearableCount = perProduct.filter((p) => p.clearable).length;

  const report = {
    generatedAtUtc: new Date().toISOString(),
    sourceCommit: RECOVERED_SOURCE_COMMIT,
    recoveredSourcePath: RECOVERED_SOURCE_PATH,
    catalogue: { total: CATALOGUE.length, fontResaleSafe: audit.cleanProducts.length, fontBlocked: audit.blockedProducts.length },
    sbom: { dependencies: STOREFRONT_DEPENDENCIES, allResaleSafe: STOREFRONT_DEPENDENCIES.every((d) => d.resaleSafe) },
    thirdPartyNotices: thirdPartyNotices(),
    clearance: {
      requiredEvidence: [...REQUIRED_EVIDENCE],
      machineEvidenceKinds: [...MACHINE_EVIDENCE_KINDS],
      humanEvidenceKinds: [...HUMAN_EVIDENCE_KINDS],
      productsClearable: clearableCount,
      productsTotal: CATALOGUE.length,
    },
    products: perProduct,
  };

  mkdirSync('data', { recursive: true });
  const outPath = 'data/evidence-report.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Wrote ${outPath}\n`);
  process.stdout.write(
    `Clearance: ${clearableCount}/${CATALOGUE.length} clearable. ` +
    `${audit.blockedProducts.length} blocked on commercial fonts. ` +
    `Machine evidence present for all; ${HUMAN_EVIDENCE_KINDS.length} human kinds outstanding per product.\n`,
  );
}

main();
