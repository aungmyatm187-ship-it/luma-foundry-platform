/**
 * Exercises the MCP server over a real client/server connection using the SDK's
 * in-memory transport — the same JSON-RPC path a real MCP client would take.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Workspace, AsyncWorkspace, InMemoryRepository } from '@luma/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { SERVER_NAME, createServer } from '../src/index.js';

let client: Client;
let ws: Workspace;

/** Call a tool and parse its JSON text payload. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const first = (result.content as Array<{ type: string; text: string }>)[0];
  if (!first) throw new Error(`tool ${name} returned no content`);
  return JSON.parse(first.text) as Record<string, unknown>;
}

beforeAll(async () => {
  ws = new Workspace();
  const server = createServer(ws);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  client = new Client({ name: 'luma-test-client', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

describe('MCP server surface', () => {
  it('advertises the platform tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toContain('create_goal');
    expect(names).toContain('create_product');
    expect(names).toContain('record_evidence');
    expect(names).toContain('check_clearance');
    expect(names).toContain('evidence_review_packet');
    expect(names).toContain('set_product_status');
    expect(names).toEqual([
      'advance_workflow',
      'check_clearance',
      'create_decision',
      'create_goal',
      'create_handoff',
      'create_product',
      'create_work_item',
      'evidence_review_packet',
      'list_workflows',
      'record_evidence',
      'set_product_status',
      'snapshot',
      'start_workflow',
      'update_decision_status',
      'update_work_item_status',
      'workflow_gates',
    ]);
  });

  it('reports its identity', async () => {
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
  });

  it('drives the full pipeline through tool calls', async () => {
    const owner = await call('create_goal', {
      ownerId: 'missing-user',
      title: 'x',
      outcome: 'y',
    });
    // unknown owner is rejected, not silently accepted
    expect(owner.error).toMatch(/Unknown owner/);

    const snap0 = await call('snapshot');
    expect(snap0.goals).toEqual([]);
  });
});

describe('MCP governance enforcement', () => {
  it('refuses clearance and reports the blockers', async () => {
    // seed a real user + goal + product through the workspace (same instance the server holds)
    const user = ws.createUser('Owner', 'owner');
    const goal = ws.createGoal({ ownerId: user.id, title: 'Batch 01', outcome: 'cleared' });
    const product = ws.createProduct({
      goalId: goal.id,
      name: 'Axiom Grid',
      category: 'AI infrastructure',
      route: '/axiom-grid',
    });

    const report = await call('check_clearance', { productId: product.id });
    expect(report.clearable).toBe(false);
    expect((report.missing as string[]).length).toBe(8);

    const evidenceBeforePacket = ws.evidenceFor(product.id);
    const initialPacket = await call('evidence_review_packet', { productId: product.id });
    expect(initialPacket.requiredRecordsComplete).toBe(false);
    expect(initialPacket.ownerApproval).toBe('not_checked');
    expect(initialPacket.legalSufficiency).toBe('not_assessed');
    expect((initialPacket.items as unknown[]).length).toBe(8);
    expect((initialPacket.coverage as Record<string, unknown>).percent).toBe(0);
    expect(ws.evidenceFor(product.id)).toEqual(evidenceBeforePacket);

    // attempting clearance is rejected
    const blocked = await call('set_product_status', {
      productId: product.id,
      status: 'cleared',
    });
    expect(blocked.error).toMatch(/cannot be marked 'cleared'/);

    // a non-clearing transition succeeds
    const moved = await call('set_product_status', {
      productId: product.id,
      status: 'in_review',
    });
    expect(moved.status).toBe('in_review');

    // record every required kind through the tool surface, then clear
    const kinds = [
      'source_commit',
      'design_history',
      'asset_licence',
      'contributor_rights',
      'dependency_sbom',
      'third_party_notices',
      'counsel_review',
      'buyer_terms',
    ];
    for (const kind of kinds) {
      await call('record_evidence', {
        productId: product.id,
        kind,
        reference: `ref://${kind}`,
        note: kind,
        recordedBy: 'operator_b',
      });
    }

    const cleared = await call('check_clearance', { productId: product.id });
    expect(cleared.clearable).toBe(true);

    const packet = await call('evidence_review_packet', { productId: product.id });
    expect(packet.requiredRecordsComplete).toBe(true);
    expect(packet.ownerApproval).toBe('not_checked');
    expect(packet.legalSufficiency).toBe('not_assessed');
    expect((packet.coverage as Record<string, unknown>).percent).toBe(100);
    const counsel = (packet.items as Array<Record<string, unknown>>).find(
      (item) => item.kind === 'counsel_review',
    );
    expect(counsel?.state).toBe('recorded');
    expect(counsel?.expectedProducer).toBe('human');
    expect((counsel?.latest as Record<string, unknown>).recordedBy).toBe('operator_b');

    // The existing direct setter checks evidence-kind presence only; workflow owner approval
    // is a separate gate and is intentionally reported as not checked by this packet.
    const final = await call('set_product_status', {
      productId: product.id,
      status: 'cleared',
    });
    expect(final.status).toBe('cleared');
  });

  it('returns a structured error for an unknown product', async () => {
    const result = await call('check_clearance', { productId: 'prd-9999' });
    expect(result.error).toMatch(/Unknown product/);
  });
});

describe('MCP workflow surface', () => {
  it('lists the platform functions', async () => {
    const list = (await call('list_workflows')) as unknown as Array<Record<string, unknown>>;
    const ids = list.map((w) => w.id);
    expect(ids).toContain('hero-asset');
    expect(ids).toContain('workshop-track');
    expect(ids).toContain('evidence-review');
    expect(ids).toContain('product-release');
    expect(ids).toContain('automation-deploy');
  });

  it('starts a hero-asset run and reports the licence gate', async () => {
    const user = ws.createUser('Owner2', 'owner');
    const goal = ws.createGoal({ ownerId: user.id, title: 'Heroes', outcome: 'licensed' });
    const product = ws.createProduct({
      goalId: goal.id,
      name: 'Axiom Grid',
      category: 'AI infrastructure',
      route: '/axiom-grid',
    });

    const started = await call('start_workflow', {
      workflowId: 'hero-asset',
      productId: product.id,
      actor: 'Manus',
      capabilities: ['design', 'build', 'operate'],
    });
    expect(started.stage).toBe('intake');

    const runId = started.runId as string;

    const toDesign = await call('advance_workflow', {
      runId, to: 'design', actor: 'Manus', capabilities: ['design', 'build', 'operate'],
    });
    expect(toDesign.stage).toBe('design');

    const toAssets = await call('advance_workflow', {
      runId, to: 'assets', actor: 'Manus', capabilities: ['design', 'build', 'operate'],
    });
    expect(toAssets.stage).toBe('assets');

    // assets -> review demands the licence
    const blocked = await call('advance_workflow', {
      runId, to: 'review', actor: 'Manus', capabilities: ['design', 'build', 'operate'],
    });
    expect(blocked.error).toMatch(/Asset licence recorded/);

    // gates reports the same blocker without mutating
    const gates = await call('workflow_gates', { runId });
    expect(gates.clear).toBe(false);
    expect((gates.blockers as string[]).join(' ')).toMatch(/asset_licence/);

    // record the licence, then it clears
    await call('record_evidence', {
      productId: product.id,
      kind: 'asset_licence',
      reference: 'ref://licence',
      note: 'generated under commercial licence',
      recordedBy: 'operator_b',
    });

    const moved = await call('advance_workflow', {
      runId, to: 'review', actor: 'OpenHands', capabilities: ['review', 'evidence', 'operate'],
    });
    expect(moved.stage).toBe('review');
  });

  it('refuses to start without the entry capability', async () => {
    const r = await call('start_workflow', {
      workflowId: 'hero-asset',
      productId: 'x',
      actor: 'Stranger',
      capabilities: [],
    });
    expect(r.error).toMatch(/Cannot start/);
  });

  it('returns a structured error for an unknown run', async () => {
    const r = await call('workflow_gates', { runId: 'run-9999' });
    expect(r.error).toMatch(/Unknown run/);
  });
});

describe('MCP async handler safety', () => {
  it('returns real content from create_product, not a wrapped Promise', async () => {
    // Construct the server with a real AsyncWorkspace — this exercises the
    // async code path. If any handler forgets `await`, JSON.stringify(Promise)
    // yields "{}" and this test fails.
    const repo = new InMemoryRepository();
    const asyncWs = new AsyncWorkspace(repo);
    const server = createServer(asyncWs);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: 'async-safety-test', version: '1.0.0' });
    await Promise.all([c.connect(ct), server.connect(st)]);

    const user = await asyncWs.createUser('Owner', 'owner');
    const goal = await asyncWs.createGoal({
      ownerId: user.id,
      title: 'Async safety',
      outcome: 'verify content',
    });

    const res = await c.callTool({
      name: 'create_product',
      arguments: {
        goalId: goal.id,
        name: 'Axiom Grid',
        category: 'AI infrastructure',
        route: '/axiom-grid',
      },
    });

    const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(typeof parsed.id).toBe('string');
    expect(parsed.status).toBe('concept');
    expect(parsed.name).toBe('Axiom Grid');
    expect(parsed.route).toBe('/axiom-grid');

    await c.close();
    await server.close();
  });
});
