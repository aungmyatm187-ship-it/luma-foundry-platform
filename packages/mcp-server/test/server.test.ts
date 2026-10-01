/**
 * Exercises the MCP server over a real client/server connection using the SDK's
 * in-memory transport — the same JSON-RPC path a real MCP client would take.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Workspace } from '@luma/core';
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
    expect(names).toContain('set_product_status');
    expect(names).toEqual([
      'check_clearance',
      'create_decision',
      'create_goal',
      'create_handoff',
      'create_product',
      'create_work_item',
      'record_evidence',
      'set_product_status',
      'snapshot',
      'update_decision_status',
      'update_work_item_status',
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
