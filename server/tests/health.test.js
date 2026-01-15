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

test('GET /health returns ok', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    server.close();
  }
});

test('GET /spells validates limit and returns message', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/spells?limit=0`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(typeof body.message, 'string');
    assert.ok(body.message.includes('limit'));
  } finally {
    server.close();
  }
});
