import assert from "node:assert/strict";
import { test } from "node:test";

import { createProoflineServer } from "../server.mjs";
import {
  TREND_COMPANY_DISCOVERY_BOUNDARIES,
  TREND_COMPANY_DISCOVERY_CATALOG,
  TREND_COMPANY_DISCOVERY_LIMITS,
  TREND_DISCOVERY_REGIONS,
  TREND_DISCOVERY_SECTORS,
  TrendCompanyDiscoveryInputError,
  buildTrendCompanyDiscoveryPlan,
  githubSignalsFromSearchPayload,
  validateTrendCompanyDiscoveryInput
} from "../src/trend-company-discovery-v1.mjs";

const FIXED_TIME = Date.parse("2026-07-19T12:00:00.000Z");

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function withServer(options, callback) {
  const server = createProoflineServer({
    tavilyKey: "mock-tavily-secret",
    githubToken: "",
    now: () => FIXED_TIME,
    ...options
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function post(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/trends/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

function tavilySearch(index, payload) {
  const companies = [
    ["ArcField Robotics", "Nia Okafor", "https://arcfield.example"],
    ["CurrentMesh", "Eli Martin", "https://currentmesh.example"],
    ["FactoryShield", "Omar Silva", "https://factoryshield.example"],
    ["NeuralBridge", "Mei Laurent", "https://neuralbridge.example"]
  ];
  const [company, founder, website] = companies[index % companies.length];
  return {
    query: payload.query,
    answer: `${company} | ${founder} | ${website} | Named in a current public source aligned to the selected signal.`,
    results: [{
      title: `${company} launches a seed-stage product`,
      url: `${website}/news`,
      content: `${company}, founded by ${founder}, announced a product aligned to this selected public trend.`,
      score: 0.87,
      published_date: "2026-06-10"
    }],
    request_id: `mock-tavily-${index + 1}`,
    response_time: 0.03,
    usage: { credits: 1 }
  };
}

function githubSearch(index, duplicate = false) {
  const owner = duplicate ? "shared-builder" : `builder-${index + 1}`;
  const name = duplicate ? "trend-engine" : `trend-engine-${index + 1}`;
  const topicSets = [
    ["robotics", "autonomy"],
    ["datacenter", "energy"],
    ["industrial", "cybersecurity"],
    ["brain-computer-interface", "neurotechnology"]
  ];
  return {
    total_count: 1,
    incomplete_results: false,
    items: [{
      private: false,
      visibility: "public",
      fork: false,
      archived: false,
      is_template: false,
      mirror_url: null,
      name,
      full_name: `${owner}/${name}`,
      html_url: "http://127.0.0.1/private-ignored",
      description: "A public technical project aligned to the selected topic.",
      owner: { login: owner, type: "User", html_url: "http://10.0.0.1/ignored" },
      language: "Python",
      topics: duplicate ? ["robotics", "datacenter", "energy"] : topicSets[index % topicSets.length],
      stargazers_count: 140 - index,
      forks_count: 12,
      watchers_count: 140 - index,
      subscribers_count: 7,
      open_issues_count: 3,
      created_at: "2025-10-10T00:00:00Z",
      updated_at: "2026-07-10T00:00:00Z",
      pushed_at: "2026-07-15T00:00:00Z"
    }]
  };
}

test("shared catalog uses stable IDs and transparent non-investment trend indicators", () => {
  assert.equal(TREND_COMPANY_DISCOVERY_CATALOG.length, 9);
  assert.equal(new Set(TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => trend.id)).size, 9);
  assert.equal(new Set(TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => trend.evidenceId)).size, 9);
  for (const trend of TREND_COMPANY_DISCOVERY_CATALOG) {
    assert.match(trend.id, /^TREND-[A-Z0-9-]+$/);
    assert.match(trend.evidenceId, /^WEB-[a-f0-9]+$/);
    assert.match(trend.sourceUrl, /^https:\/\//);
    assert.ok(trend.keyFeatures.length >= 3);
    assert.ok(trend.sectors.length >= 1);
    assert.ok(trend.regions.length >= 1);
    assert.ok(trend.signalScore.value >= 0 && trend.signalScore.value <= 100);
    assert.match(trend.signalScore.formula, /40% source authority/);
    assert.equal(trend.signalScore.canAffectInvestmentScore, false);
  }
  assert.equal(TREND_COMPANY_DISCOVERY_BOUNDARIES.infersFounderAge, false);
  assert.equal(TREND_COMPANY_DISCOVERY_BOUNDARIES.githubPopularityIsInvestmentEvidence, false);
});

test("validated plans are bounded, use every selected frozen anchor, and keep GitHub on its fixed API", () => {
  const selectedTrendIds = TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 4).map((trend) => trend.id);
  const input = validateTrendCompanyDiscoveryInput({ selectedTrendIds, region: "EUROPE", sector: "ROBOTICS" });
  const plan = buildTrendCompanyDiscoveryPlan(input, () => FIXED_TIME);

  assert.equal(plan.tavilyQueries.length, 4);
  assert.equal(plan.githubQueries.length, 4);
  assert.equal(plan.providerCaps.tavilyCreditsUpperBound, 4);
  assert.equal(plan.filters.region.id, "EUROPE");
  assert.deepEqual(plan.filters.region.appliesTo, ["TAVILY_COMPANY_DISCOVERY"]);
  assert.match(plan.filters.region.caveat, /no reliable.*geography/i);
  assert.deepEqual(plan.filters.sector.appliesTo, ["TAVILY_COMPANY_DISCOVERY", "GITHUB_TOPIC_SEARCH"]);

  for (const [index, query] of plan.tavilyQueries.entries()) {
    const trend = input.selectedTrends[index];
    assert.equal(query.trendId, trend.id);
    assert.equal(query.sourceAnchor.url, trend.sourceUrl);
    assert.equal(query.sourceAnchor.title, trend.title);
    assert.equal(query.sourceContext.url, trend.sourceUrl);
    assert.equal(query.sourceContext.title, trend.title);
    assert.deepEqual(query.sourceContext.keyFeatures, trend.keyFeatures);
    assert.equal(query.sourceContext.treatment, "FROZEN_TREND_CONTEXT_NOT_SEARCH_TARGET");
    assert.doesNotMatch(query.query, new RegExp(trend.sourceHost.replace(/\./g, "\\."), "i"));
    assert.ok(trend.keyFeatures.every((feature) => query.query.includes(feature)));
    assert.ok(query.query.length <= TREND_COMPANY_DISCOVERY_LIMITS.maxTavilyQueryCharacters);
    assert.match(query.query, /Europe European/);
    assert.match(query.query, /robotics automation/);
    assert.match(query.query, /pre-seed seed/);
    assert.match(query.query, /startup founder funding raised launched/);
    assert.match(query.query, /2025 2026/);
    assert.equal(query.includeAnswer, false);
    assert.equal(query.topic, "news");
    assert.equal(query.queryPurpose, "ENTITY_FUNDING_PRODUCT_DISCOVERY");
    assert.deepEqual(query.excludeDomains, [trend.sourceHost]);
    assert.equal(query.startDate, "2025-01-01");
  }
  for (const [index, query] of plan.githubQueries.entries()) {
    const url = new URL(query.apiUrl);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(url.pathname, "/search/repositories");
    assert.equal(url.searchParams.get("per_page"), "5");
    assert.equal(url.searchParams.get("sort"), "stars");
    assert.ok(query.query.length <= TREND_COMPANY_DISCOVERY_LIMITS.maxGithubQueryCharacters);
    assert.doesNotMatch(query.query, /Europe/i);
    assert.match(query.query, /is:public/);
    assert.match(query.query, /archived:false/);
    assert.doesNotMatch(query.query, /fork:false/);
    assert.match(query.query, /mirror:false/);
    assert.match(query.query, /template:false/);
    assert.match(query.query, /in:name,description,topics/);
    assert.doesNotMatch(query.query, /readme/i);
    assert.deepEqual(
      query.requiredRelevanceTerms.slice(0, input.selectedTrends[index].githubTerms.length),
      input.selectedTrends[index].githubTerms
    );
  }
});

test("every catalog, region, and sector combination retains all bounded Tavily query segments", () => {
  let longest = 0;
  for (const trend of TREND_COMPANY_DISCOVERY_CATALOG) {
    for (const region of TREND_DISCOVERY_REGIONS) {
      for (const sector of TREND_DISCOVERY_SECTORS) {
        const input = validateTrendCompanyDiscoveryInput({
          selectedTrendIds: [trend.id],
          region: region.id,
          sector: sector.id
        });
        const discoveryPlan = buildTrendCompanyDiscoveryPlan(input, () => FIXED_TIME);
        const tavilyQuery = discoveryPlan.tavilyQueries[0];
        const query = tavilyQuery.query;
        const githubQuery = discoveryPlan.githubQueries[0];
        longest = Math.max(longest, query.length);
        assert.ok(query.length <= TREND_COMPANY_DISCOVERY_LIMITS.maxTavilyQueryCharacters);
        assert.equal(tavilyQuery.sourceContext.url, trend.sourceUrl, `${trend.id} must retain its complete source URL in provenance`);
        assert.deepEqual(tavilyQuery.sourceContext.keyFeatures, trend.keyFeatures);
        assert.equal(tavilyQuery.sourceContext.treatment, "FROZEN_TREND_CONTEXT_NOT_SEARCH_TARGET");
        assert.equal(query.includes(trend.sourceUrl), false, `${trend.id} source URL must not become a search target`);
        assert.equal(query.includes(trend.sourceHost), false, `${trend.id} source host must not become a search target`);
        assert.ok(trend.keyFeatures.every((feature) => query.includes(feature)), `${trend.id} must retain every feature`);
        assert.ok(query.includes(region.searchTerm), `${region.id} must survive query construction`);
        assert.ok(query.includes(sector.searchTerm), `${sector.id} must survive query construction`);
        assert.ok(query.includes("pre-seed seed"), "the stage signal must be unambiguous");
        assert.ok(query.includes("startup founder funding raised launched"));
        assert.ok(query.includes("2025 2026"), "the current range must be unambiguous");
        assert.equal(tavilyQuery.includeAnswer, false);
        assert.equal(tavilyQuery.topic, "news");
        assert.deepEqual(tavilyQuery.excludeDomains, [trend.sourceHost]);
        assert.equal(tavilyQuery.startDate, "2025-01-01");
        assert.ok(githubQuery.requiredRelevanceTerms.every((term) => githubQuery.query.includes(term)));
        assert.match(githubQuery.query, /in:name,description,topics/);
        assert.doesNotMatch(githubQuery.query, /readme/i);
        assert.ok(githubQuery.query.length <= TREND_COMPANY_DISCOVERY_LIMITS.maxGithubQueryCharacters);
      }
    }
  }
  assert.ok(longest > 0);
});

test("strict input validation rejects unknown IDs, duplicates, filters, fields, and oversized selections", () => {
  const known = TREND_COMPANY_DISCOVERY_CATALOG[0].id;
  const invalid = [
    [{ selectedTrendIds: [] }, "INVALID_TREND_SELECTION"],
    [{ selectedTrendIds: [known, known] }, "DUPLICATE_TREND_ID"],
    [{ selectedTrendIds: ["WEB-efe55344eacae6d4"] }, "UNKNOWN_TREND_ID"],
    [{ selectedTrendIds: [known], region: "https://attacker.example" }, "INVALID_REGION_FILTER"],
    [{ selectedTrendIds: [known], sector: "unknown sector" }, "INVALID_SECTOR_FILTER"],
    [{ selectedTrendIds: [known], urls: ["http://127.0.0.1/"] }, "UNKNOWN_FIELD"],
    [{ selectedTrendIds: TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 5).map((trend) => trend.id) }, "INVALID_TREND_SELECTION"]
  ];
  for (const [body, code] of invalid) {
    assert.throws(
      () => validateTrendCompanyDiscoveryInput(body),
      (error) => error instanceof TrendCompanyDiscoveryInputError && error.code === code
    );
  }
});

test("GitHub normalization reconstructs safe URLs, reports subscribers correctly, and never infers age", () => {
  const plan = {
    trendId: TREND_COMPANY_DISCOVERY_CATALOG[0].id,
    query: "robotics",
    apiUrl: "https://api.github.com/search/repositories?q=robotics",
    requiredRelevanceTerms: ["robotics", "autonomy"]
  };
  const payload = githubSearch(0);
  const [signal] = githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z");
  assert.equal(signal.repositoryUrl, "https://github.com/builder-1/trend-engine-1");
  assert.equal(signal.owner.profileUrl, "https://github.com/builder-1");
  assert.equal(signal.popularity.stars, 140);
  assert.equal(signal.popularity.subscribers, 7);
  assert.deepEqual(signal.matchedRelevanceTerms, ["robotics", "autonomy"]);
  assert.equal("watchers" in signal.popularity, false);
  assert.equal(signal.activity.recentlyCreatedProject, true);
  assert.equal(signal.activity.recentlyActiveProject, true);
  assert.match(signal.activity.basis, /does not infer.*biological age/i);
  assert.doesNotMatch(JSON.stringify(signal), /founderAge|biologicalAge|youngFounder/i);

  delete payload.items[0].subscribers_count;
  payload.items[0].watchers_count = 99_999;
  const [withoutSubscribers] = githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z");
  assert.equal(withoutSubscribers.popularity.subscribers, null);

  payload.items[0].private = true;
  assert.deepEqual(githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z"), []);
});

test("GitHub payload checks reject private, forked, archived, mirrored, and template repositories", () => {
  const plan = { trendId: TREND_COMPANY_DISCOVERY_CATALOG[0].id, requiredRelevanceTerms: ["robotics"] };
  const hostileMutations = [
    (item) => { item.private = true; },
    (item) => { item.visibility = "private"; },
    (item) => { item.fork = true; },
    (item) => { item.archived = true; },
    (item) => { item.is_template = true; },
    (item) => { item.mirror_url = "https://mirror.example/repository"; },
    (item) => { delete item.is_template; },
    (item) => { delete item.mirror_url; }
  ];
  for (const mutate of hostileMutations) {
    const payload = githubSearch(0);
    mutate(payload.items[0]);
    assert.deepEqual(githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z"), []);
  }
});

test("missing GitHub popularity counts and future timestamps remain unknown, never zero or recent", () => {
  const plan = { trendId: TREND_COMPANY_DISCOVERY_CATALOG[0].id, requiredRelevanceTerms: ["robotics"] };
  const payload = githubSearch(0);
  delete payload.items[0].stargazers_count;
  delete payload.items[0].forks_count;
  delete payload.items[0].subscribers_count;
  delete payload.items[0].open_issues_count;
  payload.items[0].created_at = "2200-01-01T00:00:00Z";
  payload.items[0].updated_at = "2200-01-01T00:00:00Z";
  payload.items[0].pushed_at = "2200-01-01T00:00:00Z";
  const [signal] = githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z");
  assert.deepEqual(signal.popularity, {
    rankWithinTrendQuery: 1,
    stars: null,
    forks: null,
    subscribers: null,
    openIssues: null
  });
  assert.equal(signal.activity.createdAt, null);
  assert.equal(signal.activity.updatedAt, null);
  assert.equal(signal.activity.pushedAt, null);
  assert.equal(signal.activity.recentlyCreatedProject, false);
  assert.equal(signal.activity.recentlyActiveProject, false);
  assert.deepEqual(signal.activity.timestampCoverage, {
    createdAt: "INVALID_OR_FUTURE",
    updatedAt: "INVALID_OR_FUTURE",
    pushedAt: "INVALID_OR_FUTURE"
  });
});

test("GitHub relevance filtering ignores README-only paper lists and retains controlled metadata matches", () => {
  const trend = TREND_COMPANY_DISCOVERY_CATALOG.find((item) => item.id === "TREND-SOFT-WEARABLES-2025");
  const input = validateTrendCompanyDiscoveryInput({ selectedTrendIds: [trend.id], sector: "WEARABLE_MEDTECH" });
  const plan = buildTrendCompanyDiscoveryPlan(input, () => FIXED_TIME).githubQueries[0];
  const payload = githubSearch(0);
  Object.assign(payload.items[0], {
    name: "awesome-papers",
    full_name: "paper-curator/awesome-papers",
    owner: { login: "paper-curator", type: "User" },
    description: "A curated list of academic papers and reading links.",
    topics: ["papers", "reading-list"]
  });
  assert.deepEqual(githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z"), []);

  payload.items[0].description = "Open-source soft robotics tooling for wearable systems.";
  const [signal] = githubSignalsFromSearchPayload(payload, plan, "2026-07-19T12:00:00.000Z");
  assert.deepEqual(signal.matchedRelevanceTerms, ["soft robotics", "wearable"]);
  assert.equal(signal.owner.founderOrStartupStatus, "NOT_ESTABLISHED");
  assert.match(signal.interpretation, /does not establish a company, founder relationship/i);
});

test("selected-trend endpoint makes one Tavily and one GitHub request per trend and reports provenance", async () => {
  const calls = [];
  let tavilyIndex = 0;
  let githubIndex = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === "https://api.tavily.com/search") {
      const payload = JSON.parse(options.body);
      const result = tavilySearch(tavilyIndex, payload);
      if (tavilyIndex === 0) result.query = "provider-normalized company discovery query";
      tavilyIndex += 1;
      return jsonResponse(result);
    }
    assert.match(url, /^https:\/\/api\.github\.com\/search\/repositories\?/);
    return jsonResponse(githubSearch(githubIndex++), 200, {
      "x-ratelimit-limit": "10",
      "x-ratelimit-remaining": String(9 - githubIndex),
      "x-ratelimit-reset": "1784466000"
    });
  };
  const selectedTrendIds = TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 2).map((trend) => trend.id);

  await withServer({ fetchImpl, githubToken: "mock-github-secret" }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds, region: "EUROPE", sector: "ROBOTICS" });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 4);
    const tavilyCalls = calls.filter((call) => call.url.includes("api.tavily.com"));
    const githubCalls = calls.filter((call) => call.url.includes("api.github.com"));
    assert.equal(tavilyCalls.length, 2);
    assert.equal(githubCalls.length, 2);
    assert.ok(tavilyCalls.every((call) => call.options.method === "POST"));
    assert.ok(tavilyCalls.every((call) => call.options.headers.Authorization === "Bearer mock-tavily-secret"));
    assert.ok(tavilyCalls.every((call) => JSON.parse(call.options.body).topic === "news"));
    assert.ok(tavilyCalls.every((call) => JSON.parse(call.options.body).include_answer === false));
    assert.ok(tavilyCalls.every((call) => JSON.parse(call.options.body).start_date === "2025-01-01"));
    assert.ok(tavilyCalls.every((call, index) => JSON.parse(call.options.body).exclude_domains.includes(TREND_COMPANY_DISCOVERY_CATALOG[index].sourceHost)));
    assert.ok(tavilyCalls.every((call, index) => !JSON.parse(call.options.body).query.includes(TREND_COMPANY_DISCOVERY_CATALOG[index].sourceUrl)));
    assert.ok(githubCalls.every((call) => call.options.method === "GET"));
    assert.ok(githubCalls.every((call) => call.options.headers.Authorization === "Bearer mock-github-secret"));
    assert.ok(githubCalls.every((call) => call.options.headers["X-GitHub-Api-Version"] === "2026-03-10"));
    assert.ok(githubCalls.every((call) => new URL(call.url).origin === "https://api.github.com"));
    assert.ok(githubCalls.every((call) => new URL(call.url).searchParams.get("q").includes("is:public")));

    assert.equal(body.schemaVersion, "proofline.trend-company-discovery.v1");
    assert.equal(body.mode, "SELECTED_TREND_COMPANY_DISCOVERY");
    assert.deepEqual(body.selectedTrends.map((trend) => trend.id), selectedTrendIds);
    assert.equal(body.candidates.length, 2);
    assert.ok(body.candidates.every((candidate) => candidate.selectedTrendIds.length === 1));
    assert.equal(body.githubSignals.length, 2);
    assert.equal(body.evidence.length, 2);
    assert.equal(body.sourceCount, 4);
    assert.equal(body.usage.reportedCredits, 2);
    assert.equal(body.usage.estimatedCreditsUpperBound, 2);
    assert.equal(body.usage.githubApiRequests, 2);
    assert.equal(body.usage.githubApiResponses, 2);
    assert.equal(body.usage.totalProviderCallsUpperBound, 4);
    assert.equal(body.usage.localRateUnitsCharged, 4);
    assert.equal(body.providers.github.authenticationMode, "SERVER_TOKEN");
    assert.equal(body.providers.github.warnings.length, 0);
    const serializedTavilyQuery = body.queries.find((query) => query.method === "TAVILY_SEARCH");
    assert.equal(serializedTavilyQuery.providerQuery, "provider-normalized company discovery query");
    assert.equal(serializedTavilyQuery.queryPurpose, "ENTITY_FUNDING_PRODUCT_DISCOVERY");
    assert.equal(serializedTavilyQuery.topic, "news");
    assert.equal(serializedTavilyQuery.sourceContext.url, TREND_COMPANY_DISCOVERY_CATALOG[0].sourceUrl);
    assert.deepEqual(serializedTavilyQuery.sourceContext.keyFeatures, TREND_COMPANY_DISCOVERY_CATALOG[0].keyFeatures);
    assert.deepEqual(serializedTavilyQuery.excludeDomains, [TREND_COMPANY_DISCOVERY_CATALOG[0].sourceHost]);
    assert.equal(body.evidence[0].trendSourceContext.treatment, "FROZEN_TREND_CONTEXT_NOT_SEARCH_TARGET");
    assert.ok(body.queries.filter((query) => query.method === "GITHUB_REPOSITORY_SEARCH").every((query) => query.status === "COMPLETED"));
    assert.equal(body.boundaries.canAffectStartupScore, false);
    assert.equal(body.boundaries.githubPopularityIsInvestmentEvidence, false);
    assert.equal(body.boundaries.infersFounderAge, false);
    assert.equal(body.nextRequiredAction, "INVESTIGATE_ENTITY_AND_EVIDENCE_BEFORE_SCORING");
    assert.doesNotMatch(JSON.stringify(body), /mock-(?:tavily|github)-secret/);
  });
});

test("duplicate repositories merge across trends while preserving every selected trend association", async () => {
  let tavilyIndex = 0;
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") return jsonResponse(tavilySearch(tavilyIndex++, JSON.parse(options.body)));
    return jsonResponse(githubSearch(0, true));
  };
  const selectedTrendIds = TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 2).map((trend) => trend.id);
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds });
    assert.equal(response.status, 200);
    assert.equal(body.githubSignals.length, 1);
    assert.deepEqual(body.githubSignals[0].selectedTrendIds.sort(), [...selectedTrendIds].sort());
    assert.equal(body.githubSignals[0].popularity.rankWithinTrendQuery, 1);
  });
});

test("partial Tavily usage metadata never masquerades as a complete reported-credit total", async () => {
  let tavilyIndex = 0;
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") {
      const result = tavilySearch(tavilyIndex, JSON.parse(options.body));
      if (tavilyIndex === 1) delete result.usage;
      tavilyIndex += 1;
      return jsonResponse(result);
    }
    return jsonResponse(githubSearch(0, true));
  };
  const selectedTrendIds = TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 2).map((trend) => trend.id);
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds });
    assert.equal(response.status, 200);
    assert.equal(body.usage.reportedCredits, null);
    assert.equal(body.usage.reportedCreditsObserved, 1);
    assert.equal(body.usage.reportedCreditCoverage, "1/2 Tavily searches");
    assert.equal(body.usage.estimatedCreditsUpperBound, 2);
  });
});

test("GitHub rate limits fail open without converting missing popularity into negative evidence", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") return jsonResponse(tavilySearch(0, JSON.parse(options.body)));
    return jsonResponse({ message: "API rate limit exceeded" }, 403, {
      "x-ratelimit-limit": "10",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1784466000"
    });
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.candidates.length, 1);
    assert.equal(body.githubSignals.length, 0);
    assert.equal(body.usage.githubApiRequests, 1);
    assert.equal(body.usage.githubApiResponses, 1);
    assert.equal(body.usage.githubApiRequestsCompleted, 0);
    assert.equal(body.providers.github.warnings[0].code, "GITHUB_UPSTREAM_RATE_LIMIT");
    assert.match(body.providers.github.warnings[0].message, /no negative signal/i);
  });
});

test("GitHub incomplete result sets are disclosed as coverage warnings, never comparative scores", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") return jsonResponse(tavilySearch(0, JSON.parse(options.body)));
    const payload = githubSearch(0);
    payload.total_count = 321;
    payload.incomplete_results = true;
    return jsonResponse(payload);
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.githubSignals.length, 1);
    assert.deepEqual(body.providers.github.resultCoverage, [{
      trendId: TREND_COMPANY_DISCOVERY_CATALOG[0].id,
      totalCount: 321,
      incompleteResults: true
    }]);
    assert.equal(body.providers.github.warnings[0].code, "GITHUB_INCOMPLETE_RESULTS");
    assert.match(body.providers.github.warnings[0].message, /coverage is partial/i);
    assert.doesNotMatch(JSON.stringify(body.providers.github.resultCoverage), /score|rank/i);
  });
});

test("overflowing GitHub rate-reset metadata fails open without dropping valid provider results", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") return jsonResponse(tavilySearch(0, JSON.parse(options.body)));
    return jsonResponse(githubSearch(0), 200, { "x-ratelimit-reset": "9000000000000000" });
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.githubSignals.length, 1);
    assert.equal(body.providers.github.warnings.length, 0);
  });
});

test("an echoed pipe-delimited provider header can never become a company candidate", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") {
      const result = tavilySearch(0, JSON.parse(options.body));
      result.answer = `Company | Founders | URL | Reason\n${result.answer}`;
      result.results[0].content += " This company has public evidence.";
      return jsonResponse(result);
    }
    return jsonResponse(githubSearch(0));
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.candidates.length, 1);
    assert.equal(body.candidates[0].companyName, "ArcField Robotics");
    assert.equal(body.candidates.some((candidate) => candidate.companyName === "Company"), false);
  });
});

test("Markdown pipe tables retain corroborated candidates while dropping header and separator rows", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") {
      const payload = JSON.parse(options.body);
      return jsonResponse({
        query: payload.query,
        answer: [
          "| Company | Founder(s) | URL | Reason |",
          "| :--- | ---: | :---: | --- |",
          "| WeaveMotion | Ada Rivera | https://weavemotion.example | Soft wearable actuation aligned to the selected source. |"
        ].join("\n"),
        results: [{
          title: "WeaveMotion company profile",
          url: "https://weavemotion.example/updates/soft-wearable",
          content: "WeaveMotion, led by Ada Rivera, published a soft wearable prototype update.",
          score: 0.84
        }],
        request_id: "markdown-table-regression",
        usage: { credits: 1 }
      });
    }
    return jsonResponse(githubSearch(0));
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.candidates.length, 1);
    assert.equal(body.candidates[0].companyName, "WeaveMotion");
    assert.deepEqual(body.candidates[0].founderNames, ["Ada Rivera"]);
    assert.equal(body.candidates[0].website, "https://weavemotion.example/");
    assert.equal(body.candidates[0].sourceEvidenceIds.length, 1);
    assert.equal(body.candidates.some((candidate) => /^(?:Company|:?-{3,}:?)$/.test(candidate.companyName)), false);
  });
});

test("short company names cannot attach to evidence through incidental substrings", async () => {
  const fetchImpl = async (url, options) => {
    if (url === "https://api.tavily.com/search") {
      const payload = JSON.parse(options.body);
      return jsonResponse({
        query: payload.query,
        answer: "AI | Unknown | N/A | A supposed match that must remain unsupported.",
        results: [{
          title: "Infrastructure market report",
          url: "https://unrelated.example/report",
          content: "The report said demand increased, but it does not name the proposed entity.",
          score: 0.5
        }],
        request_id: "substring-regression",
        usage: { credits: 1 }
      });
    }
    return jsonResponse(githubSearch(0));
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, { selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id] });
    assert.equal(response.status, 200);
    assert.equal(body.candidates.length, 0);
    assert.equal(body.evidence.length, 1);
  });
});

test("invalid input and an insufficient local credit budget fail before either provider is called", async () => {
  let providerCalls = 0;
  const fetchImpl = async () => {
    providerCalls += 1;
    return assert.fail("provider must not be called");
  };
  await withServer({ fetchImpl, rateUnits: 3 }, async (baseUrl) => {
    const invalid = await post(baseUrl, {
      selectedTrendIds: [TREND_COMPANY_DISCOVERY_CATALOG[0].id],
      region: "file:///etc/passwd"
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.code, "INVALID_REGION_FILTER");

    const overBudget = await post(baseUrl, {
      selectedTrendIds: TREND_COMPANY_DISCOVERY_CATALOG.slice(0, 4).map((trend) => trend.id)
    });
    assert.equal(overBudget.response.status, 429);
    assert.equal(overBudget.body.code, "LOCAL_RATE_LIMIT");
    assert.equal(providerCalls, 0);
  });
});

test("capabilities disclose hard bounds and endpoint without exposing provider credentials", async () => {
  await withServer({
    githubToken: "capability-github-secret",
    fetchImpl: async () => assert.fail("capabilities must not call a provider")
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    assert.equal(response.status, 200);
    assert.equal(body.endpoints.trendCompanyDiscovery, "/api/trends/discover");
    assert.equal(body.providers.repositorySignals, "GitHub Public Repository Search API");
    assert.equal(body.guards.selectedTrendIdsAreServerKnown, true);
    assert.equal(body.guards.maxSelectedTrendsPerCompanyDiscovery, 4);
    assert.equal(body.guards.maxTrendDiscoveryTavilyCredits, 4);
    assert.equal(body.guards.maxTrendDiscoveryGithubRequests, 4);
    assert.equal(body.guards.maxTrendDiscoveryProviderCalls, 8);
    assert.doesNotMatch(serialized, /capability-github-secret|mock-tavily-secret/);
  });
});
