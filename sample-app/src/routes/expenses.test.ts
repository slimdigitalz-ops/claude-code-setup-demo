import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../index.ts';
import * as repo from '../db/expenseRepository.ts';

const server = app.listen(0);
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

after(() => server.close());
beforeEach(() => repo._reset());

async function post(body: unknown, raw?: string) {
  return fetch(`${base}/expenses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
}

describe('POST /expenses', () => {
  it('creates an expense and returns the amount as a string', async () => {
    const res = await post({ description: 'Coffee', amount: '4.50', category: 'food' });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.amount, '4.50');
    assert.equal(body.description, 'Coffee');
    assert.ok(body.id);
  });

  it('rejects a missing description', async () => {
    const res = await post({ amount: '1.00', category: 'food' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'bad_request');
  });

  it('rejects a blank description', async () => {
    const res = await post({ description: '   ', amount: '1.00', category: 'food' });
    assert.equal(res.status, 400);
  });

  it('rejects a missing category', async () => {
    const res = await post({ description: 'x', amount: '1.00' });
    assert.equal(res.status, 400);
  });

  it('rejects a numeric amount — it must be a string', async () => {
    const res = await post({ description: 'x', amount: 4.5, category: 'food' });
    assert.equal(res.status, 400);
  });

  it('rejects an unparseable amount', async () => {
    const res = await post({ description: 'x', amount: '4.567', category: 'food' });
    assert.equal(res.status, 400);
  });

  it('trims the category so filtering can find it', async () => {
    await post({ description: 'x', amount: '1.00', category: '  food  ' });
    const res = await fetch(`${base}/expenses?category=food`);
    assert.equal((await res.json()).expenses.length, 1);
  });

  it('returns 400 for malformed JSON, not 500', async () => {
    const res = await post(null, '{"description":');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'bad_request');
  });
});

describe('GET /expenses', () => {
  it('totals without float drift', async () => {
    for (let i = 0; i < 10; i++) {
      await post({ description: `d${i}`, amount: '0.10', category: 'food' });
    }
    const body = await (await fetch(`${base}/expenses`)).json();
    assert.equal(body.total, '1.00');
  });

  it('filters by category', async () => {
    await post({ description: 'a', amount: '1.00', category: 'food' });
    await post({ description: 'b', amount: '2.00', category: 'travel' });

    const body = await (await fetch(`${base}/expenses?category=travel`)).json();
    assert.equal(body.expenses.length, 1);
    assert.equal(body.total, '2.00');
  });

  it('is empty on a fresh store', async () => {
    const body = await (await fetch(`${base}/expenses`)).json();
    assert.deepEqual(body.expenses, []);
    assert.equal(body.total, '0.00');
  });
});

describe('GET and DELETE /expenses/:id', () => {
  it('fetches one by id', async () => {
    const created = await (await post({ description: 'x', amount: '9.99', category: 'food' })).json();
    const res = await fetch(`${base}/expenses/${created.id}`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).amount, '9.99');
  });

  it('404s on an unknown id', async () => {
    const res = await fetch(`${base}/expenses/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'not_found');
  });

  it('deletes and then 404s', async () => {
    const created = await (await post({ description: 'x', amount: '1.00', category: 'food' })).json();
    assert.equal((await fetch(`${base}/expenses/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/expenses/${created.id}`)).status, 404);
  });

  it('404s deleting something that is not there', async () => {
    const res = await fetch(`${base}/expenses/nope`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });

  it('404s an unknown route', async () => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});
