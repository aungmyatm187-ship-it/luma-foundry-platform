/**
 * The workflow catalogue.
 *
 * These are the functions the platform performs. They are built from a shared
 * vocabulary of stages, so the same vessel is reused across domains — a content
 * workflow, an evidence workflow, and a deploy workflow all flow through the
 * same `review` and `clearance` stages rather than each defining its own.
 *
 * That reuse is the point. Adding a new function is composing existing stages in
 * a new order. The governance gates travel with the stage, so no new workflow can
 * accidentally omit them.
 */

import type { Stage, Workflow } from './workflow.js';
import { defineWorkflow } from './workflow.js';

/* ------------------------------------------------------------------ *
 * Shared stages — the reusable vessels.
 * ------------------------------------------------------------------ */

export const STAGE = {
  intake: {
    id: 'intake',
    name: 'Intake',
    requires: ['operate'],
    gates: [],
    emits: ['request'],
    optional: false,
  },
  design: {
    id: 'design',
    name: 'Design',
    requires: ['design'],
    gates: [],
    emits: ['design'],
    optional: false,
  },
  build: {
    id: 'build',
    name: 'Build',
    requires: ['build'],
    gates: [{ kind: 'artifact', name: 'build', label: 'A build must exist' }],
    emits: ['build'],
    optional: false,
  },
  assets: {
    id: 'assets',
    name: 'Asset production',
    requires: ['design'],
    gates: [
      { kind: 'evidence', kinds: ['asset_licence'], label: 'Asset licence recorded' },
    ],
    emits: ['assets'],
    optional: false,
  },
  review: {
    id: 'review',
    name: 'Review',
    requires: ['review'],
    gates: [{ kind: 'artifact', name: 'review', label: 'Review must be recorded' }],
    emits: ['review'],
    optional: false,
  },
  evidence: {
    id: 'evidence',
    name: 'Evidence',
    requires: ['evidence'],
    gates: [
      {
        kind: 'evidence',
        kinds: ['design_history', 'asset_licence', 'contributor_rights'],
        label: 'Rights evidence recorded',
      },
    ],
    emits: ['evidence'],
    optional: false,
  },
  clearance: {
    id: 'clearance',
    name: 'Clearance',
    requires: ['decide'],
    gates: [
      {
        kind: 'evidence',
        kinds: [
          'source_commit',
          'design_history',
          'asset_licence',
          'contributor_rights',
          'dependency_sbom',
          'third_party_notices',
          'counsel_review',
          'buyer_terms',
        ],
        label: 'All required evidence recorded',
      },
      { kind: 'approval', role: 'owner', label: 'Owner approval' },
    ],
    emits: ['clearance'],
    optional: false,
  },
  publish: {
    id: 'publish',
    name: 'Publish',
    requires: ['deploy'],
    gates: [{ kind: 'approval', role: 'owner', label: 'Owner approval to publish' }],
    emits: ['release'],
    optional: false,
  },
  workshop: {
    id: 'workshop',
    name: 'Workshop delivery',
    requires: ['operate'],
    gates: [{ kind: 'artifact', name: 'curriculum', label: 'Curriculum must exist' }],
    emits: ['curriculum'],
    optional: false,
  },
  automation: {
    id: 'automation',
    name: 'Automation build',
    requires: ['build'],
    gates: [{ kind: 'artifact', name: 'flow', label: 'A working flow must exist' }],
    emits: ['flow'],
    optional: false,
  },
  deploy: {
    id: 'deploy',
    name: 'Deploy',
    requires: ['deploy'],
    gates: [{ kind: 'approval', role: 'owner', label: 'Owner approval to deploy' }],
    emits: ['deployment'],
    optional: false,
  },
} satisfies Record<string, Stage>;

const ALL_STAGES = Object.values(STAGE);

/** Resolve a list of stage ids against the shared vocabulary. */
function stages(...ids: Array<keyof typeof STAGE>): Stage[] {
  return ids.map((id) => ALL_STAGES.find((s) => s.id === id) as Stage);
}

/* ------------------------------------------------------------------ *
 * The functions.
 * ------------------------------------------------------------------ */

/** The original Operator A → Operator B product pipeline, now enforceable. */
export const PRODUCT_RELEASE = defineWorkflow({
  id: 'product-release',
  name: 'Product release',
  purpose: 'Take a product from concept to commercially cleared release.',
  entry: 'intake',
  stages: stages('intake', 'design', 'build', 'assets', 'review', 'evidence', 'clearance', 'publish'),
  transitions: [
    { from: 'intake', to: 'design', when: 'Request accepted' },
    { from: 'design', to: 'build', when: 'Design approved' },
    { from: 'build', to: 'assets', when: 'Build produces asset requirements' },
    { from: 'assets', to: 'review', when: 'Assets licensed and recorded' },
    { from: 'review', to: 'evidence', when: 'Operator B review complete' },
    { from: 'evidence', to: 'clearance', when: 'Rights evidence complete' },
    { from: 'clearance', to: 'publish', when: 'Cleared and owner approved' },
  ],
});

/** Hero asset production — the audit finding, as a governed workflow. */
export const HERO_ASSET = defineWorkflow({
  id: 'hero-asset',
  name: 'Hero asset production',
  purpose:
    'Produce and license a hero image so no two products share an asset and every asset is licensed.',
  entry: 'intake',
  stages: stages('intake', 'design', 'assets', 'review', 'evidence'),
  transitions: [
    { from: 'intake', to: 'design', when: 'Product identified and asset gap confirmed' },
    { from: 'design', to: 'assets', when: 'Art direction set' },
    { from: 'assets', to: 'review', when: 'Asset produced' },
    { from: 'review', to: 'evidence', when: 'Asset approved and licence recorded' },
  ],
});

/** Myanmar workshop vertical: industry becomes a teachable track. */
export const WORKSHOP_TRACK = defineWorkflow({
  id: 'workshop-track',
  name: 'Workshop track',
  purpose: 'Turn a product vertical into a deliverable workshop for Myanmar participants.',
  entry: 'intake',
  stages: stages('intake', 'workshop', 'automation', 'review', 'publish'),
  transitions: [
    { from: 'intake', to: 'workshop', when: 'Vertical selected' },
    { from: 'workshop', to: 'automation', when: 'Curriculum drafted' },
    { from: 'automation', to: 'review', when: 'Working flow built' },
    { from: 'review', to: 'publish', when: 'Reviewed and owner approved' },
  ],
});

/** Deploy a product's automation into a customer's operation. */
export const AUTOMATION_DEPLOY = defineWorkflow({
  id: 'automation-deploy',
  name: 'Automation deployment',
  purpose: 'Build and deploy a working automation for a client, with owner sign-off.',
  entry: 'intake',
  stages: stages('intake', 'automation', 'review', 'deploy'),
  transitions: [
    { from: 'intake', to: 'automation', when: 'Client request qualified' },
    { from: 'automation', to: 'review', when: 'Flow built' },
    { from: 'review', to: 'deploy', when: 'Reviewed and owner approved' },
  ],
});

/** Evidence review — the 31-item queue in ember-signal-backend. */
export const EVIDENCE_REVIEW = defineWorkflow({
  id: 'evidence-review',
  name: 'Evidence review',
  purpose: 'Resolve a queue of unreviewed evidence items without approving on a claim.',
  entry: 'intake',
  stages: stages('intake', 'review', 'evidence', 'clearance'),
  transitions: [
    { from: 'intake', to: 'review', when: 'Item queued for review' },
    { from: 'review', to: 'evidence', when: 'Review outcome recorded' },
    { from: 'evidence', to: 'clearance', when: 'Rights evidence complete' },
  ],
});

export const WORKFLOWS: Workflow[] = [
  PRODUCT_RELEASE,
  HERO_ASSET,
  WORKSHOP_TRACK,
  AUTOMATION_DEPLOY,
  EVIDENCE_REVIEW,
];

export function findWorkflow(id: string): Workflow {
  const wf = WORKFLOWS.find((w) => w.id === id);
  if (!wf) throw new Error(`Unknown workflow: ${id}`);
  return wf;
}
