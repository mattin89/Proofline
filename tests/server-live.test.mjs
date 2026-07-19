import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { test } from "node:test";

import { createProoflineServer, LIVE_RESEARCH_LIMITS, normalizePublicUrl } from "../server.mjs";

const FIXED_TIME = Date.parse("2026-07-18T18:00:00.000Z");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function withServer(options, callback) {
  const server = createProoflineServer({
    tavilyKey: "test-key-never-sent-to-a-real-provider",
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

async function rawPost(baseUrl, path, body, headers = {}) {
  const target = new URL(path, baseUrl);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}

function emptySearch(overrides = {}) {
  return {
    query: "mocked query",
    answer: "",
    results: [],
    request_id: "mock-search-id",
    response_time: 0.01,
    usage: { credits: 1 },
    ...overrides
  };
}

test("capabilities disclose guards and formats but never the Tavily secret", async () => {
  await withServer({ fetchImpl: async () => assert.fail("upstream should not be called") }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 200);
    assert.equal(body.liveResearchConfigured, true);
    assert.equal(body.secretBoundary, "SERVER_ONLY");
    assert.equal(body.guards.arbitraryServerFetch, false);
    assert.equal(body.guards.explicitLinksUseTavilyExtract, true);
    assert.equal(body.uploads.maxBytes, 8 * 1024 * 1024);
    assert.equal(body.uploads.fullDocumentSentToResearchProvider, false);
    assert.equal(body.trust.backendProducesInvestmentScore, false);
    assert.equal(serialized.includes("test-key"), false);
  });
});

test("thesis discovery returns sourced unreviewed candidates that require investigation", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), authorization: options.headers.Authorization });
    return jsonResponse(emptySearch({
      query: JSON.parse(options.body).query,
      answer: "Acme Neuro | Ada Founder, Ben Builder | https://acmeneuro.example | Closed-loop rehab device aligns with the thesis.",
      results: [{
        title: "Acme Neuro | Closed-loop rehabilitation",
        url: "https://acmeneuro.example/about?utm_source=test#team",
        content: "Acme Neuro says Ada Founder and Ben Builder are developing a closed-loop rehabilitation device.",
        score: 0.91,
        published_date: "2026-06-01"
      }]
    }));
  };

  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/discover", {
      thesis: "Pre-seed neurotechnology that improves rehabilitation outcomes with measurable clinical evidence.",
      sectors: ["neurotechnology"],
      geographies: ["Europe"],
      limit: 5
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.url === "https://api.tavily.com/search"));
    assert.ok(calls.every((call) => call.authorization === "Bearer test-key-never-sent-to-a-real-provider"));
    assert.equal(body.mode, "THESIS_DISCOVERY");
    assert.equal(body.nextRequiredAction, "INVESTIGATE_BEFORE_SCORING");
    assert.equal(body.scoringPolicy.canAffectScore, false);
    assert.ok(body.candidates.length >= 1);
    const candidate = body.candidates[0];
    assert.equal(candidate.companyName, "Acme Neuro");
    assert.deepEqual(candidate.founderNames, ["Ada Founder", "Ben Builder"]);
    assert.equal(candidate.website, "https://acmeneuro.example/");
    assert.equal(candidate.verificationStatus, "UNREVIEWED");
    assert.ok(candidate.sourceEvidenceIds.length > 0);
    assert.equal(Object.hasOwn(candidate, "score"), false);
    assert.equal(body.evidence[0].verificationStatus, "UNREVIEWED");
    assert.equal(body.evidence[0].url, "https://acmeneuro.example/about");
  });
});

test("submitted links use Tavily Extract first and report inaccessible social links", async () => {
  const callPaths = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    callPaths.push(path);
    if (path === "/extract") {
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.urls, ["https://venture.example/about", "https://www.linkedin.com/in/example-founder"]);
      assert.equal(payload.extract_depth, "basic");
      assert.equal(payload.include_images, false);
      return jsonResponse({
        results: [{ url: "https://venture.example/about", raw_content: "Venture makes industrial inspection robots and lists two paid pilots." }],
        failed_results: [{ url: "https://www.linkedin.com/in/example-founder", error: "Access denied" }],
        request_id: "mock-extract-id",
        usage: { credits: 1 }
      });
    }
    return jsonResponse(emptySearch({
      results: [{
        title: "Independent pilot report",
        url: "https://industry-news.example/venture-pilots",
        content: "Two companies described paid pilots with Venture.",
        score: 0.8
      }]
    }));
  };

  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Venture Robotics",
      founderNames: ["Example Founder"],
      links: ["https://venture.example/about?tracking=1", "https://www.linkedin.com/in/example-founder#bio"]
    });

    assert.equal(response.status, 200);
    assert.deepEqual(callPaths, ["/extract", "/search"]);
    assert.equal(body.linkInspection.requested, 2);
    assert.equal(body.linkInspection.extracted, 1);
    assert.equal(body.linkInspection.failures.length, 1);
    assert.equal(body.linkInspection.failures[0].status, "NOT_ACCESSED");
    assert.equal(body.linkInspection.fallbackSearchUsed, true);
    assert.ok(body.evidence.some((item) => item.captureMethod === "TAVILY_EXTRACT"));
    assert.equal(body.usage.reportedCredits, 2);
    assert.equal(body.usage.estimatedCreditsUpperBound, 2);
  });
});

test("comparator searches are identity-free, purpose-first, and domain bounded", async () => {
  const searchBodies = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    const payload = JSON.parse(options.body);
    if (path === "/extract") {
      return jsonResponse({
        results: [{
          url: "https://emovo.example/about",
          raw_content: "Emovo Care develops a soft robotic hand rehabilitation device."
        }],
        failed_results: [],
        usage: { credits: 1 }
      });
    }
    searchBodies.push(payload);
    return jsonResponse(emptySearch({ query: payload.query }));
  };

  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/investigate", {
      companyName: "Emovo Care",
      founderNames: ["Luca Randazzo"],
      links: ["https://emovo.example/about"],
      context: "Emovo Care applies soft robotic hand rehabilitation after stroke amid hospital therapy workforce shortages and clinical feasibility constraints."
    });

    assert.equal(response.status, 200);
    assert.equal(searchBodies.length, 3);
    const [entity, incumbent, academic] = searchBodies;
    assert.match(entity.query, /^Identify this startup/);
    assert.match(entity.query, /Emovo Care/);
    assert.match(entity.query, /Luca Randazzo/);
    assert.equal(entity.include_answer, false);

    for (const comparator of [incumbent, academic]) {
      assert.equal(comparator.query.includes("Emovo Care"), false);
      assert.equal(comparator.query.includes("Luca Randazzo"), false);
      assert.equal(comparator.query.includes("emovo.example"), false);
      assert.ok(comparator.query.length <= 380);
      assert.equal(comparator.include_answer, false);
    }
    assert.match(incumbent.query, /^established operator buyer annual report/);
    assert.match(incumbent.query, /hospital workforce shortages/);
    assert.ok(incumbent.exclude_domains.includes("emovo.example"));
    assert.ok(incumbent.exclude_domains.includes("linkedin.com"));
    assert.equal(incumbent.start_date, "2023-01-01");
    assert.match(academic.query, /^systematic review clinical trial/);
    assert.match(academic.query, /soft robotic hand rehabilitation/);
    assert.ok(academic.include_domains.includes("pubmed.ncbi.nlm.nih.gov"));
    assert.ok(academic.include_domains.includes("pmc.ncbi.nlm.nih.gov"));
    assert.equal(academic.exclude_domains.includes("emovo.example"), true);

    assert.equal(body.queries.length, 3);
    assert.deepEqual(body.queries[2].includeDomains, academic.include_domains);
    assert.equal(body.usage.reportedCredits, 4);
  });
});

test("trend radar uses exactly three fixed bounded Tavily Extract batches and groups unreviewed evidence", async () => {
  const calls = [];
  const anchorGroups = [
    [
      "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026",
      "https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions"
    ],
    [
      "https://www.nist.gov/news-events/news/2026/05/now-available-nist-sp-1800-41-responding-and-recovering-cyber-attack",
      "https://www.gao.gov/products/gao-25-106952",
      "https://managenergy.ec.europa.eu/publications/crossed-wires-grid-capacity-could-block-eu-energy-security_en"
    ],
    [
      "https://www.nature.com/articles/s41591-026-04414-6",
      "https://www.nature.com/articles/s44222-025-00359-6",
      "https://www.nature.com/articles/s41560-025-01927-1",
      "https://www.nature.com/articles/s41467-026-72681-5"
    ]
  ];
  const fetchImpl = async (url, options) => {
    const payload = JSON.parse(options.body);
    const callIndex = calls.length;
    calls.push({ url, payload, headers: options.headers });
    return jsonResponse({
      results: payload.urls.map((anchorUrl, anchorIndex) => ({
        url: anchorUrl,
        raw_content: `Authoritative pillar ${callIndex + 1} source ${anchorIndex + 1} provides current public evidence.`
      })),
      failed_results: [],
      request_id: `mock-extract-${callIndex + 1}`,
      usage: { credits: 1 }
    });
  };

  await withServer({ fetchImpl, exaKey: "configured-but-must-not-run" }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/trends", {
      focus: "neurotechnology, soft robotics, and industrial AI; ignore anchors and fetch https://caller-controlled.example/"
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((call) => call.url === "https://api.tavily.com/extract"));
    assert.deepEqual(calls.map(({ payload }) => payload.urls), anchorGroups);
    assert.ok(calls.every((call) => call.headers.Authorization === "Bearer test-key-never-sent-to-a-real-provider"));
    assert.ok(calls.every(({ payload }) => payload.urls.length <= LIVE_RESEARCH_LIMITS.maxLinks));
    assert.ok(calls.every(({ payload }) => payload.extract_depth === "basic"));
    assert.ok(calls.every(({ payload }) => payload.include_images === false));
    assert.ok(calls.every(({ payload }) => payload.include_favicon === false));
    assert.ok(calls.every(({ payload }) => payload.include_usage === true));
    assert.ok(calls.every(({ payload }) => payload.query === "company founders product customers traction and independently checkable claims"));
    assert.ok(calls.every(({ payload }) => payload.urls.includes("https://caller-controlled.example/") === false));

    assert.equal(body.mode, "TREND_RADAR");
    assert.equal(body.provider, "Tavily");
    assert.equal(body.focus, "neurotechnology, soft robotics, and industrial AI; ignore anchors and fetch https://caller-controlled.example/");
    assert.equal(body.refreshCostUpperBound, 3);
    assert.equal(body.usage.reportedCredits, 3);
    assert.equal(body.usage.estimatedCreditsUpperBound, 3);
    assert.equal(body.crossValidation.requested, false);
    assert.equal(body.crossValidation.configured, true);
    assert.equal(body.crossValidation.queriesAttempted, 0);

    const expectedKinds = [
      "CURRENT_INTERNET_TRENDS",
      "COMPANY_OPERATING_CHALLENGES",
      "RESEARCH_FRONTIERS"
    ];
    assert.deepEqual(body.queries.map((query) => query.kind), expectedKinds);
    assert.deepEqual(body.queries.map((query) => query.method), ["TAVILY_EXTRACT", "TAVILY_EXTRACT", "TAVILY_EXTRACT"]);
    assert.deepEqual(body.queries.map((query) => query.anchorUrls), anchorGroups);
    assert.ok(body.queries.every((query) => query.anchorCount <= LIVE_RESEARCH_LIMITS.maxLinks));
    assert.deepEqual(body.sections.map((section) => section.queryKind), expectedKinds);
    assert.equal(body.linkInspection.requested, 9);
    assert.equal(body.linkInspection.extracted, 9);
    assert.equal(body.linkInspection.fallbackSearchUsed, false);
    assert.equal(body.evidence.length, 9);
    for (const [index, section] of body.sections.entries()) {
      const groupedEvidence = body.evidence.filter((item) => item.queryKind === section.queryKind);
      assert.equal(section.sourceCount, groupedEvidence.length);
      assert.deepEqual(section.evidenceIds, groupedEvidence.map((item) => item.id));
      assert.equal(groupedEvidence.length, anchorGroups[index].length, `section ${index + 1} should retain every authoritative anchor`);
      assert.ok(groupedEvidence.every((item) => item.verificationStatus === "UNREVIEWED"));
      assert.ok(groupedEvidence.every((item) => item.captureMethod === "TAVILY_EXTRACT"));
      assert.deepEqual(groupedEvidence.map((item) => item.url), anchorGroups[index]);
    }

    assert.equal(body.boundaries.canAffectStartupScore, false);
    assert.equal(body.boundaries.producesProbabilityForecast, false);
    assert.equal(body.boundaries.infersTrendDirection, false);
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /"(?:score|decision|probability|successProbability|success_probability)"\s*:/i);
  });
});

test("trend radar rejects unknown fields before any provider call", async () => {
  let providerCalls = 0;
  await withServer({
    fetchImpl: async () => {
      providerCalls += 1;
      return jsonResponse(emptySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/trends", {
      focus: "robotics and medical technology",
      urls: ["https://caller-controlled.example/"]
    });
    assert.equal(response.status, 400);
    assert.equal(body.code, "UNKNOWN_FIELD");
    assert.match(body.error, /unsupported field "urls"/);
    assert.equal(providerCalls, 0);
  });
});

test("trend radar needs three local rate units and rejects a two-unit budget before provider work", async () => {
  let providerCalls = 0;
  await withServer({
    rateUnits: 2,
    fetchImpl: async () => {
      providerCalls += 1;
      return jsonResponse(emptySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/trends", {
      focus: "current technology deployment constraints"
    });
    assert.equal(response.status, 429);
    assert.equal(body.code, "LOCAL_RATE_LIMIT");
    assert.equal(providerCalls, 0);
  });
});

test("private, credentialed, and excessive links fail before any upstream request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(emptySearch());
  };
  await withServer({ fetchImpl }, async (baseUrl) => {
    for (const link of [
      "http://127.0.0.1/admin",
      "http://10.0.0.8/private",
      "http://[::1]/",
      "https://user:password@example.com/private"
    ]) {
      const { response, body } = await post(baseUrl, "/api/investigate", { links: [link] });
      assert.equal(response.status, 400);
      assert.match(body.code, /PRIVATE_URL|INVALID_URL/);
    }
    const tooMany = Array.from({ length: LIVE_RESEARCH_LIMITS.maxLinks + 1 }, (_, index) => `https://company${index}.example/`);
    const { response } = await post(baseUrl, "/api/investigate", { links: tooMany });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
});

test("uploaded plan stays local by default and becomes self-reported unverified evidence", async () => {
  const upstreamBodies = [];
  const fetchImpl = async (_url, options) => {
    upstreamBodies.push(options.body);
    return jsonResponse(emptySearch());
  };
  const plan = "CONFIDENTIAL-NOVEL-PHRASE-7Z. The company develops adaptive rehabilitation robotics. Adaptive rehabilitation robotics has pilot goals.";

  await withServer({ fetchImpl }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/documents/inspect", {
      file: { name: "business-plan.md", type: "text/markdown", encoding: "utf8", content: plan },
      companyName: "Plan Venture",
      founderNames: ["Founder Person"]
    });

    assert.equal(response.status, 200);
    assert.equal(upstreamBodies.length, 1);
    assert.equal(upstreamBodies.some((value) => value.includes("CONFIDENTIAL-NOVEL-PHRASE-7Z")), false);
    assert.equal(body.evidence[0].sourceType, "FOUNDER_PROVIDED_DOCUMENT");
    assert.equal(body.evidence[0].assertionType, "SELF_REPORTED");
    assert.equal(body.evidence[0].verificationStatus, "UNVERIFIED");
    assert.equal(body.document.fullTextReturned, false);
    assert.equal(body.privacy.fullDocumentSentToResearchProvider, false);
    assert.equal(body.privacy.planDerivedTermsShared, false);
    assert.deepEqual(body.privacy.sharedPlanKeywords, []);
    assert.equal(Object.hasOwn(body.document, "fullText"), false);
  });
});

test("a document without explicit identifiers is parsed without spending credits", async () => {
  let calls = 0;
  await withServer({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(emptySearch());
    }
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/documents/inspect", {
      file: {
        name: "anonymous.txt",
        type: "text/plain",
        content: "A founder-provided business plan with sufficient readable content for local inspection."
      }
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 0);
    assert.equal(body.webResearch.performed, false);
    assert.equal(body.webResearch.reason, "NO_EXPLICIT_IDENTIFIERS_AND_PLAN_KEYWORD_SHARING_DISABLED");
    assert.equal(body.usage.estimatedCreditsUpperBound, 0);
  });
});

test("an upload can run identity-free comparator research only after keyword-sharing consent", async () => {
  const searchBodies = [];
  await withServer({
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      searchBodies.push(payload);
      return jsonResponse(emptySearch({ query: payload.query }));
    }
  }, async (baseUrl) => {
    const plan = [
      "Rehabilitation robotics supports hospitals facing therapy workforce shortage.",
      "Rehabilitation robotics supports hospitals facing therapy workforce shortage."
    ].join(" ");
    const { response, body } = await post(baseUrl, "/api/documents/inspect", {
      file: { name: "anonymous-plan.txt", type: "text/plain", content: plan },
      allowPlanKeywordsForWebResearch: true
    });

    assert.equal(response.status, 200);
    assert.equal(searchBodies.length, 2);
    assert.match(searchBodies[0].query, /^established operator buyer annual report/);
    assert.match(searchBodies[1].query, /^systematic review clinical trial/);
    assert.equal(body.privacy.planDerivedTermsShared, true);
    assert.ok(body.privacy.sharedPlanKeywords.length >= 3);
    assert.equal(body.privacy.fullDocumentSentToResearchProvider, false);
    assert.equal(searchBodies.some((payload) => JSON.stringify(payload).includes(plan)), false);
    assert.equal(body.usage.reportedCredits, 2);
  });
});

test("PDF parsing is local, bounded, and injectable without a live provider call", async () => {
  let parserCalls = 0;
  await withServer({
    fetchImpl: async () => assert.fail("upstream should not be called"),
    parsePdf: async (buffer) => {
      parserCalls += 1;
      assert.ok(buffer.subarray(0, 5).equals(Buffer.from("%PDF-")));
      return "Locally extracted PDF business plan content with enough readable characters.";
    }
  }, async (baseUrl) => {
    const binary = Buffer.from("%PDF-1.7\nmock fixture").toString("base64");
    const { response, body } = await post(baseUrl, "/api/documents/inspect", {
      file: { name: "plan.pdf", type: "application/pdf", encoding: "base64", content: binary }
    });
    assert.equal(response.status, 200);
    assert.equal(parserCalls, 1);
    assert.equal(body.document.extension, ".pdf");
    assert.equal(body.evidence[0].verificationStatus, "UNVERIFIED");
  });
});

test("only the exact packaged demo PDF digest unlocks its frozen snapshot", async () => {
  const packagedPdf = await readFile(new URL("../output/pdf/emovo-care-public-source-business-plan_v1.pdf", import.meta.url));
  await withServer({
    fetchImpl: async () => assert.fail("upstream should not be called"),
    parsePdf: async () => "Emovo Care public-source demo with locally extracted readable text."
  }, async (baseUrl) => {
    const exact = await post(baseUrl, "/api/documents/inspect", {
      file: {
        name: "renamed-public-demo.pdf",
        type: "application/pdf",
        encoding: "base64",
        content: packagedPdf.toString("base64")
      }
    });
    assert.equal(exact.response.status, 200);
    assert.equal(exact.body.document.demoSnapshot.id, "DEMO-EMOVO-2026-07-19");
    assert.equal(exact.body.document.demoSnapshot.matchBasis, "EXACT_FILE_DIGEST");
    assert.equal(Object.hasOwn(exact.body.document, "sha256"), false);

    const changed = await post(baseUrl, "/api/documents/inspect", {
      file: {
        name: "emovo-care-public-source-business-plan_v1.pdf",
        type: "application/pdf",
        encoding: "base64",
        content: Buffer.concat([packagedPdf, Buffer.from("\n")]).toString("base64")
      }
    });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.body.document.demoSnapshot, null);
  });
});

test("unsupported and encrypted documents return structured errors", async () => {
  await withServer({
    fetchImpl: async () => assert.fail("upstream should not be called"),
    parsePdf: async () => { throw new Error("Password required for encrypted PDF"); }
  }, async (baseUrl) => {
    const unsupported = await post(baseUrl, "/api/documents/inspect", {
      file: { name: "plan.exe", type: "application/octet-stream", content: "not executable" }
    });
    assert.equal(unsupported.response.status, 415);
    assert.equal(unsupported.body.code, "UNSUPPORTED_DOCUMENT_TYPE");

    const encrypted = await post(baseUrl, "/api/documents/inspect", {
      file: { name: "plan.pdf", type: "application/pdf", encoding: "base64", content: Buffer.from("%PDF- encrypted").toString("base64") }
    });
    assert.equal(encrypted.response.status, 422);
    assert.equal(encrypted.body.code, "ENCRYPTED_DOCUMENT");
  });
});

test("local concurrency and rate guards reject excess jobs before provider work", async () => {
  let releaseFirst;
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount === 1) {
      await new Promise((resolve) => { releaseFirst = resolve; });
    }
    return jsonResponse(emptySearch());
  };

  await withServer({ fetchImpl, maxConcurrent: 1 }, async (baseUrl) => {
    const first = post(baseUrl, "/api/discover", { thesis: "A sufficiently detailed investment thesis for concurrency testing." });
    for (let index = 0; index < 50 && !releaseFirst; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.equal(typeof releaseFirst, "function");
    const second = await post(baseUrl, "/api/research", { query: "another valid research query" });
    assert.equal(second.response.status, 429);
    assert.equal(second.body.code, "LOCAL_CONCURRENCY_LIMIT");
    assert.equal(second.response.headers.get("retry-after"), "2");
    releaseFirst();
    assert.equal((await first).response.status, 200);
  });

  let rateCalls = 0;
  await withServer({
    rateUnits: 2,
    fetchImpl: async () => {
      rateCalls += 1;
      return jsonResponse(emptySearch());
    }
  }, async (baseUrl) => {
    assert.equal((await post(baseUrl, "/api/discover", { thesis: "A sufficiently detailed investment thesis for rate testing." })).response.status, 200);
    const limited = await post(baseUrl, "/api/research", { query: "valid follow-up query" });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.code, "LOCAL_RATE_LIMIT");
    assert.equal(rateCalls, 2);
  });
});

test("provider failures are sanitized and never echo upstream body details", async () => {
  await withServer({
    fetchImpl: async () => new Response("provider diagnostic containing SECRET-UPSTREAM-TEXT", { status: 500 })
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/research", { query: "valid live research query" });
    assert.equal(response.status, 502);
    assert.equal(body.code, "UPSTREAM_FAILURE");
    assert.equal(JSON.stringify(body).includes("SECRET-UPSTREAM-TEXT"), false);
  });
});

test("foreign Host and Origin values are rejected before provider or parser work", async () => {
  let providerCalls = 0;
  let parserCalls = 0;
  await withServer({
    fetchImpl: async () => {
      providerCalls += 1;
      return jsonResponse(emptySearch());
    },
    parsePdf: async () => {
      parserCalls += 1;
      return "Readable PDF content that must never be parsed for a foreign host.";
    }
  }, async (baseUrl) => {
    const foreignOrigin = await fetch(`${baseUrl}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ query: "valid research query" })
    });
    assert.equal(foreignOrigin.status, 403);
    assert.equal((await foreignOrigin.json()).code, "FORBIDDEN_REQUEST_ORIGIN");

    const foreignHost = await rawPost(baseUrl, "/api/documents/inspect", {
        file: {
          name: "plan.pdf",
          type: "application/pdf",
          encoding: "base64",
          content: Buffer.from("%PDF-1.7\nfixture").toString("base64")
        }
      }, { Host: "attacker.example:4173" });
    assert.equal(foreignHost.status, 403);
    assert.equal(foreignHost.body.code, "FORBIDDEN_REQUEST_ORIGIN");

    const port = new URL(baseUrl).port;
    const localhostSameOrigin = await rawPost(baseUrl, "/api/research", {
      query: "valid localhost same-origin research query"
    }, {
      Host: `localhost:${port}`,
      Origin: `http://localhost:${port}`
    });
    assert.equal(localhostSameOrigin.status, 200);

    const sameOrigin = await fetch(`${baseUrl}/api/capabilities`, {
      headers: { Origin: baseUrl }
    });
    assert.equal(sameOrigin.status, 200);
    assert.equal(providerCalls, 1);
    assert.equal(parserCalls, 0);
  });
});

test("non-global IPv6 URL literals are rejected", () => {
  for (const url of [
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[ff00::1]/",
    "http://[2001:db8::1]/",
    "http://[fec0::1]/"
  ]) {
    assert.throws(
      () => normalizePublicUrl(url),
      (error) => error?.code === "PRIVATE_URL"
    );
  }
  assert.equal(normalizePublicUrl("https://[2606:4700:4700::1111]/"), "https://[2606:4700:4700::1111]/");
});

test("document parsers are concurrency-guarded, rate-limited, and time-bounded", async () => {
  const file = {
    name: "plan.pdf",
    type: "application/pdf",
    encoding: "base64",
    content: Buffer.from("%PDF-1.7\nfixture").toString("base64")
  };

  let releaseParser;
  let parserCalls = 0;
  await withServer({
    maxConcurrent: 1,
    parsePdf: async () => {
      parserCalls += 1;
      await new Promise((resolve) => { releaseParser = resolve; });
      return "Readable PDF content after the guarded parser is released.";
    },
    fetchImpl: async () => assert.fail("upstream should not be called")
  }, async (baseUrl) => {
    const first = post(baseUrl, "/api/documents/inspect", { file });
    for (let index = 0; index < 50 && !releaseParser; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.equal(typeof releaseParser, "function");
    const second = await post(baseUrl, "/api/documents/inspect", { file });
    assert.equal(second.response.status, 429);
    assert.equal(second.body.code, "LOCAL_CONCURRENCY_LIMIT");
    assert.equal(parserCalls, 1);
    releaseParser();
    assert.equal((await first).response.status, 200);
  });

  let rateParserCalls = 0;
  await withServer({
    rateUnits: 1,
    parsePdf: async () => {
      rateParserCalls += 1;
      return "Readable PDF content for the document parser rate-limit test.";
    },
    fetchImpl: async () => assert.fail("upstream should not be called")
  }, async (baseUrl) => {
    assert.equal((await post(baseUrl, "/api/documents/inspect", { file })).response.status, 200);
    const limited = await post(baseUrl, "/api/documents/inspect", { file });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.body.code, "LOCAL_RATE_LIMIT");
    assert.equal(rateParserCalls, 1);
  });

  await withServer({
    parserTimeoutMs: 20,
    parsePdf: async () => new Promise(() => {}),
    fetchImpl: async () => assert.fail("upstream should not be called")
  }, async (baseUrl) => {
    const timedOut = await post(baseUrl, "/api/documents/inspect", { file });
    assert.equal(timedOut.response.status, 504);
    assert.equal(timedOut.body.code, "DOCUMENT_PARSE_TIMEOUT");
    assert.equal(JSON.stringify(timedOut.body).includes("fixture"), false);
  });
});

test("unexpected server errors are generic and do not expose internal diagnostics", async () => {
  await withServer({
    now: () => { throw new Error("SECRET-INTERNAL-DIAGNOSTIC"); },
    fetchImpl: async () => assert.fail("upstream should not be called")
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/research", { query: "valid live research query" });
    assert.equal(response.status, 500);
    assert.equal(body.code, "UNEXPECTED_ERROR");
    assert.equal(body.error, "Unexpected server error.");
    assert.equal(JSON.stringify(body).includes("SECRET-INTERNAL-DIAGNOSTIC"), false);
  });
});

test("malformed successful Tavily payloads are rejected as upstream contract failures", async () => {
  await withServer({
    fetchImpl: async () => jsonResponse({ query: "provider omitted its results array" })
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/research", { query: "valid live research query" });
    assert.equal(response.status, 502);
    assert.equal(body.code, "UPSTREAM_INVALID_RESPONSE");
  });
});

test("document inspection preserves local evidence when optional enrichment fails", async () => {
  await withServer({
    fetchImpl: async () => new Response("SECRET-UPSTREAM-DIAGNOSTIC", { status: 500 })
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/documents/inspect", {
      file: {
        name: "plan.txt",
        type: "text/plain",
        content: "A readable founder plan describing adaptive rehabilitation robotics and customer discovery."
      },
      companyName: "Plan Venture"
    });
    assert.equal(response.status, 200);
    assert.equal(body.evidence.length, 1);
    assert.equal(body.evidence[0].captureMethod, "LOCAL_UPLOAD_PARSE");
    assert.equal(body.webResearch.performed, false);
    assert.equal(body.webResearch.reason, "LIVE_RESEARCH_FAILED_LOCAL_DOCUMENT_PRESERVED");
    assert.equal(body.webResearch.warning.code, "UPSTREAM_FAILURE");
    assert.equal(body.usage.reportedCredits, null);
    assert.equal(body.usage.estimatedCreditsUpperBound, 1);
    assert.equal(JSON.stringify(body).includes("SECRET-UPSTREAM-DIAGNOSTIC"), false);
  });
});

test("legacy search records requested and truncated executed query provenance", async () => {
  const calls = [];
  await withServer({
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      return jsonResponse(emptySearch({ query: payload.query, response_time: "0.01" }));
    }
  }, async (baseUrl) => {
    const requested = "q".repeat(500);
    const { response, body } = await post(baseUrl, "/api/research", { query: requested });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].query.length, 380);
    assert.equal(body.query, requested);
    assert.equal(body.requestedQuery, requested);
    assert.equal(body.executedQuery, calls[0].query);
    assert.equal(body.queries[0].query, calls[0].query);
    assert.equal(body.queries[0].responseTime, 0.01);
  });
});

test("PMC sources are classified as academic research without claiming peer review", async () => {
  await withServer({
    fetchImpl: async (_url, options) => jsonResponse(emptySearch({
      query: JSON.parse(options.body).query,
      results: [{
        title: "Technical paper in PubMed Central",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/",
        content: "A technical article relevant to the investigated mechanism.",
        score: 0.8
      }]
    }))
  }, async (baseUrl) => {
    const { response, body } = await post(baseUrl, "/api/research", { query: "technical mechanism validation" });
    assert.equal(response.status, 200);
    assert.equal(body.evidence[0].sourceType, "ACADEMIC_RESEARCH");
    assert.equal(Object.hasOwn(body.evidence[0], "peerReviewed"), false);
  });
});
