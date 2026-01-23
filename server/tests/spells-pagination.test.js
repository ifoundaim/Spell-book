import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });
}

function makeSupabaseMock({ result, onRange }) {
  return {
    from() {
      return this;
    },
    select() {
      return this;
    },
    order() {
      return this;
    },
    async range(from, to) {
      onRange?.({ from, to });
      return result;
    }
  };
}

test('GET /spells defaults limit=20 offset=0 and returns items/total', async () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  app.set(
    'supabase',
    makeSupabaseMock({
      result: { data: items, error: null, count: 123 }
    })
  );

  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/spells`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.items, items);
    assert.equal(body.limit, 20);
    assert.equal(body.offset, 0);
    assert.equal(body.total, 123);
  } finally {
    server.close();
  }
});

test('GET /spells caps limit at 50 and computes range correctly', async () => {
  let captured = null;
  app.set(
    'supabase',
    makeSupabaseMock({
      result: { data: [], error: null, count: 0 },
      onRange: (r) => {
        captured = r;
      }
    })
  );

  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/spells?limit=999&offset=10`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.limit, 50);
    assert.equal(body.offset, 10);
    assert.deepEqual(captured, { from: 10, to: 59 });
  } finally {
    server.close();
  }
});

test('GET /spells floors negative offset to 0', async () => {
  let captured = null;
  app.set(
    'supabase',
    makeSupabaseMock({
      result: { data: [], error: null, count: 0 },
      onRange: (r) => {
        captured = r;
      }
    })
  );

  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/spells?offset=-10`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.offset, 0);
    assert.deepEqual(captured, { from: 0, to: 19 });
  } finally {
    server.close();
  }
});

test('GET /spells returns 500 when supabase returns an error', async () => {
  app.set(
    'supabase',
    makeSupabaseMock({
      result: { data: null, error: { message: 'boom' }, count: null }
    })
  );

  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/spells`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, 'boom');
  } finally {
    server.close();
  }
});

