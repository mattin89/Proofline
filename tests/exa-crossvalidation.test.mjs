import assert from "node:assert/strict";
import { test } from "node:test";

import { createProoflineServer } from "../server.mjs";

const FIXED_TIME = Date.parse("2026-07-19T00:00:00.000Z");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function tavilySearch(overrides = {}) {
  return {
    query: "mocked query",
    answer: "",
    results: [],
    request_id: "tavily-request",
    usage: { credits: 1 },
    ...overrides
  };
}

async function withServer(options, callback) {
  const server = createProoflineServer({
    tavilyKey: "tavily-secret-for-test",
    exaKey: "exa-secret-for-test",
    now: () => FIXED_TIME,
    ...options
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test("capabilities report Exa availability without exposing either provider secret", async () => {
  await withServer({ fetchImpl: async () => assert.fail("no provider call expected") }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 200);
    assert.equal(body.liveResearchConfigured, true);
    assert.equal(body.crossValidationConfigured, true);
    assert.equal(body.providers.primary, "Tavily");
    assert.equal(body.providers.optionalCrossValidation, "Exa");
    assert.equal(body.guards.exaIsOptionalAndExplicit, true);
    assert.equal(body.guards.crossProviderSameUrlCountsOnce, true);
    assert.equal(serialized.includes("tavily-secret"), false);
    assert.equal(serialized.includes("exa-secret"), false);
  });
});

test("Exa is never called without an explicit per-run opt in", async () => {
  const hosts = [];
  await withServer({
    fetchImpl: async (url) => {
      hosts.push(new URL(url).hostname);
      return jsonResponse(tavilySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", { companyName: "Acme Robotics" });
    assert.equal(response.status, 200);
    assert.deepEqual(hosts, ["api.tavily.com"]);
    assert.equal(body.crossValidation.status, "NOT_REQUESTED");
    assert.equal(body.usage.exa.estimatedCostUpperBoundDollars, 0);
  });
});

test("opted-in Exa adds unique sources but a shared URL is counted once", async () => {
  const calls = [];
  await withServer({
    fetchImpl: async (url, options) => {
      const target = new URL(url);
      const payload = JSON.parse(options.body);
      calls.push({ host: target.hostname, payload, headers: options.headers });
      if (target.hostname === "api.tavily.com") {
        return jsonResponse(tavilySearch({
          results: [{
            title: "Acme deployment",
            url: "https://industry.example/acme?utm_source=test#top",
            content: "Acme Robotics deployed an inspection system with a customer.",
            score: 0.8,
            published_date: "2026-06-01"
          }]
        }));
      }
      return jsonResponse({
        requestId: "exa-request",
        costDollars: { total: 0.007 },
        results: [
          {
            title: "Acme deployment corroboration",
            url: "https://industry.example/acme",
            publishedDate: "2026-06-01T00:00:00.000Z",
            highlights: ["An independent report describes the Acme Robotics customer deployment."]
          },
          {
            title: "Acme technical filing",
            url: "https://filings.example/acme-robotics",
            publishedDate: "2026-05-01T00:00:00.000Z",
            highlights: ["The filing describes Acme Robotics inspection technology."]
          }
        ]
      });
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Acme Robotics",
      crossValidateWithExa: true
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls.map((item) => item.host), ["api.tavily.com", "api.exa.ai"]);
    const exaCall = calls.find((item) => item.host === "api.exa.ai");
    assert.equal(exaCall.headers["x-api-key"], "exa-secret-for-test");
    assert.equal(exaCall.payload.type, "auto");
    assert.equal(exaCall.payload.numResults, 5);
    assert.deepEqual(exaCall.payload.contents, { highlights: true });
    assert.equal(body.provider, "Tavily + Exa");
    assert.equal(body.evidence.length, 2);
    const shared = body.evidence.find((item) => item.url === "https://industry.example/acme");
    assert.deepEqual(shared.observedBy, ["Exa", "Tavily"]);
    assert.equal(shared.crossProviderRetrievalMatch, true);
    assert.equal(body.crossValidation.retrievalOverlapUrls, 1);
    assert.equal(body.crossValidation.uniqueSourcesAdded, 1);
    assert.equal(body.crossValidation.interpretation.includes("counted once"), true);
    assert.equal(body.usage.exa.reportedCostDollars, 0.007);
    assert.equal(body.usage.exa.estimatedCostUpperBoundDollars, 0.007);
  });
});

test("identity-bearing query parameters remain distinct across providers", async () => {
  await withServer({
    fetchImpl: async (url) => {
      if (new URL(url).hostname === "api.tavily.com") {
        return jsonResponse(tavilySearch({
          results: [{
            title: "Portfolio company one",
            url: "https://registry.example/company?id=101&utm_source=feed",
            content: "Registry record for company 101."
          }]
        }));
      }
      return jsonResponse({
        requestId: "exa-distinct-query-record",
        costDollars: { total: 0.007 },
        results: [{
          title: "Portfolio company two",
          url: "https://registry.example/company?id=202",
          highlights: ["Registry record for company 202."]
        }]
      });
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Registry Robotics",
      crossValidateWithExa: true
    });
    assert.equal(response.status, 200);
    assert.equal(body.evidence.length, 2);
    assert.equal(body.crossValidation.retrievalOverlapUrls, 0);
    assert.equal(body.crossValidation.uniqueSourcesAdded, 1);
    assert.deepEqual(body.evidence.map((item) => item.url).sort(), [
      "https://registry.example/company?id=101",
      "https://registry.example/company?id=202"
    ]);
  });
});

test("malformed or budget-blocked Exa responses fail open without contaminating Tavily evidence", async () => {
  for (const exaResponse of [
    jsonResponse({ results: "not-an-array", diagnostic: "SECRET-UPSTREAM-TEXT" }),
    new Response("SECRET-UPSTREAM-TEXT", { status: 402 })
  ]) {
    await withServer({
      fetchImpl: async (url) => {
        if (new URL(url).hostname === "api.exa.ai") return exaResponse.clone();
        return jsonResponse(tavilySearch({
          results: [{
            title: "Primary provider evidence",
            url: "https://evidence.example/acme",
            content: "Independent evidence about Acme Robotics.",
            score: 0.7
          }]
        }));
      }
    }, async (baseUrl) => {
      const { response, body } = await post(baseUrl, "/api/investigate", {
        companyName: "Acme Robotics",
        crossValidateWithExa: true
      });
      assert.equal(response.status, 200);
      assert.equal(body.evidence.length, 1);
      assert.equal(body.crossValidation.status, "FAILED_OPEN");
      assert.equal(body.crossValidation.warnings.length, 1);
      assert.equal(JSON.stringify(body).includes("SECRET-UPSTREAM-TEXT"), false);
    });
  }
});

test("requested Exa cross-validation reports not configured without making a second provider call", async () => {
  let calls = 0;
  await withServer({
    exaKey: "",
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(tavilySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Acme Robotics",
      crossValidateWithExa: true
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.equal(body.crossValidation.status, "NOT_CONFIGURED");
    assert.equal(body.crossValidation.queriesAttempted, 0);
  });
});

test("invalid cross-validation flags fail before either provider is called", async () => {
  let calls = 0;
  await withServer({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(tavilySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Acme Robotics",
      crossValidateWithExa: "yes"
    });
    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_CROSS_VALIDATION_FLAG");
    assert.equal(calls, 0);
  });
});
