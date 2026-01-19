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

test('CORS: GET /health with allowed Origin returns ACAO header (and never 403)', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const origin = 'https://spell-book.pages.dev';
    const response = await fetch(`http://localhost:${port}/health`, {
      headers: { Origin: origin }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  } finally {
    server.close();
  }
});

test('CORS: GET /health with disallowed Origin is still 200 but has no ACAO header', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      headers: { Origin: 'https://evil.example' }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    server.close();
  }
});

test('CORS: OPTIONS preflight /health returns 204 with proper allow headers/methods for allowed Origin', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const origin = 'https://spell-book.pages.dev';
    const response = await fetch(`http://localhost:${port}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);

    const allowMethods = response.headers.get('access-control-allow-methods') || '';
    assert.ok(allowMethods.includes('GET'));

    const allowHeaders = response.headers.get('access-control-allow-headers') || '';
    assert.ok(allowHeaders.toLowerCase().includes('content-type'));
  } finally {
    server.close();
  }
});

test('GET /debug returns ok and includes request origin/method/url + env subset', async () => {
  const server = await startServer();
  const { port } = server.address();

  try {
    const origin = 'https://spell-book.pages.dev';
    const response = await fetch(`http://localhost:${port}/debug`, {
      headers: { Origin: origin }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.origin, origin);
    assert.equal(body.method, 'GET');
    assert.equal(body.url, '/debug');
    assert.equal(typeof body.env, 'object');
    assert.ok('NODE_ENV' in body.env);
  } finally {
    server.close();
  }
});

