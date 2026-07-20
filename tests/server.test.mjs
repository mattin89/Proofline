import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createProoflineServer } from "../server.mjs";

let server;
let baseUrl;

before(async () => {
  server = createProoflineServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("config reports only safe provider capability metadata", async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.mode, "optional");
  assert.equal(typeof body.liveResearchConfigured, "boolean");
  assert.equal(typeof body.crossValidationConfigured, "boolean");
  assert.deepEqual(Object.keys(body).sort(), ["crossValidationConfigured", "crossValidationProvider", "liveResearchConfigured", "mode", "provider"]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("static app is served with the security boundary intact", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(response.headers.get("content-security-policy"), /connect-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(html, /Proofline v3 — Cross-validated venture evidence/);
});

test("health check is minimal and does not disclose provider configuration", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("only explicit browser assets are publicly served", async () => {
  for (const path of ["/src/app.mjs", "/styles.css", "/live-styles.css", "/output/pdf/emovo-care-public-source-business-plan_v1.pdf"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should be public`);
    await response.arrayBuffer();
  }

  for (const path of ["/.env", "/.git/config", "/server.mjs", "/package.json", "/tests/server.test.mjs", "/docs/ARCHITECTURE.md"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, `${path} must not be public`);
    await response.arrayBuffer();
  }
});

test("unsupported mutation routes are rejected without reaching Tavily", async () => {
  const response = await fetch(`${baseUrl}/api/config`, { method: "POST" });
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.equal(body.error, "Method not allowed");
});

test("an invalid research query never triggers an upstream request", async () => {
  const config = await fetch(`${baseUrl}/api/config`).then((response) => response.json());
  const response = await fetch(`${baseUrl}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "a" })
  });
  const body = await response.json();

  assert.equal(response.status, config.liveResearchConfigured ? 400 : 503);
  assert.match(body.error, config.liveResearchConfigured ? /between 5 and 500/ : /not configured/);
});
