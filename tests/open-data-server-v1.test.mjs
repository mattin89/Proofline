import assert from "node:assert/strict";
import { test } from "node:test";

import { createProoflineServer } from "../server.mjs";

const FIXED_TIME = Date.parse("2026-07-19T12:00:00.000Z");
const QUERIED_DATASET_IDS = [
  "GLEIF_LEI",
  "CLINICAL_TRIALS_GOV",
  "NIH_REPORTER",
  "USA_SPENDING"
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function withServer(options, callback) {
  const server = createProoflineServer({
    tavilyKey: "",
    exaKey: "",
    githubToken: "",
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

async function post(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/open-data/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

function noMatchOfficialFetch(calls) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push({
      url: url.href,
      hostname: url.hostname,
      pathname: url.pathname,
      method: options.method || "GET"
    });

    if (url.hostname === "api.gleif.org" && url.pathname === "/api/v1/lei-records") {
      return jsonResponse({ data: [] });
    }
    if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
      return jsonResponse({ totalCount: 0, studies: [] });
    }
    if (url.hostname === "api.reporter.nih.gov" && url.pathname === "/v2/projects/search") {
      return jsonResponse({ results: [] });
    }
    if (url.hostname === "api.usaspending.gov" && url.pathname === "/api/v2/search/spending_by_award/") {
      return jsonResponse({ results: [] });
    }
    throw new Error(`Unexpected upstream request in open-data route test: ${url.href}`);
  };
}

test("capabilities expose the credential-free official-data route without Tavily", async () => {
  const calls = [];
  await withServer({ fetchImpl: noMatchOfficialFetch(calls) }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.liveResearchConfigured, false);
    assert.equal(body.provider, null);
    assert.equal(body.endpoints.openDataSignals, "/api/open-data/signals");
    assert.equal(body.guards.maxOpenDataExternalRequests, 5);
    assert.equal(body.trust.openDataCanAffectOpportunityScore, false);

    const catalogIds = body.providers.officialOpenData.map((dataset) => dataset.id);
    assert.deepEqual(catalogIds.filter((id) => QUERIED_DATASET_IDS.includes(id)), QUERIED_DATASET_IDS);
    assert.ok(catalogIds.includes("GITHUB_PUBLIC_API"), "GitHub may remain separately catalogued");
    assert.equal(calls.length, 0, "capability inspection must not call any provider");
  });
});

test("open-data signals run without Tavily and preserve exact no-match as unknown", async () => {
  const calls = [];
  await withServer({ fetchImpl: noMatchOfficialFetch(calls) }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, {
      companyName: "No Match Robotics, Inc.",
      founderNames: ["Ada Example"]
    });

    assert.equal(response.status, 200);
    assert.equal(body.entity.companyName, "No Match Robotics, Inc.");
    assert.deepEqual(body.datasets.map((dataset) => dataset.id), QUERIED_DATASET_IDS);
    assert.ok(body.datasets.every((dataset) => dataset.status === "NO_EXACT_ENTITY_MATCH"));
    assert.ok(body.datasets.every((dataset) => dataset.matchedRecords === 0));
    assert.ok(body.datasets.every((dataset) => dataset.absenceIsNegative === false));
    assert.ok(body.datasets.every((dataset) => dataset.canAffectOpportunityScore === false));
    assert.deepEqual(body.coverage, {
      queriedDatasets: 4,
      completedDatasets: 4,
      matchedDatasets: 0,
      matchedRecords: 0,
      unavailableDatasets: 0
    });
    assert.deepEqual(body.usage, {
      credentialsRequired: false,
      providerCreditsUsed: 0,
      externalRequestsUpperBound: 5,
      queryIsEntityScoped: true
    });
    assert.equal(body.boundaries.absenceIsNegative, false);
    assert.equal(body.boundaries.canAffectOpportunityScore, false);
    assert.equal(body.boundaries.producesSuccessProbability, false);
    assert.equal(body.boundaries.producesRevenueForecast, false);
    assert.equal(body.opportunityScore, undefined);
    assert.equal(body.check, undefined);

    assert.equal(calls.length, 5);
    assert.equal(calls.filter((call) => call.hostname === "api.gleif.org").length, 1);
    assert.equal(calls.filter((call) => call.hostname === "clinicaltrials.gov").length, 1);
    assert.equal(calls.filter((call) => call.hostname === "api.reporter.nih.gov").length, 1);
    assert.equal(calls.filter((call) => call.hostname === "api.usaspending.gov").length, 2);
    assert.ok(calls.every((call) => !/tavily/i.test(call.hostname)));
  });
});

test("open-data signals reject invalid input before making upstream requests", async () => {
  const calls = [];
  await withServer({ fetchImpl: noMatchOfficialFetch(calls) }, async (baseUrl) => {
    const missingCompany = await post(baseUrl, { founderNames: [] });
    assert.equal(missingCompany.response.status, 400);
    assert.equal(missingCompany.body.code, "INVALID_TEXT");

    const tooManyFounders = await post(baseUrl, {
      companyName: "Bounded Robotics",
      founderNames: Array.from({ length: 9 }, (_, index) => `Founder ${index + 1}`)
    });
    assert.equal(tooManyFounders.response.status, 400);
    assert.equal(tooManyFounders.body.code, "INVALID_LIST");

    const unknownField = await post(baseUrl, {
      companyName: "Bounded Robotics",
      scoreOverride: 100
    });
    assert.equal(unknownField.response.status, 400);
    assert.equal(unknownField.body.code, "UNKNOWN_FIELD");
    assert.equal(calls.length, 0);
  });
});
