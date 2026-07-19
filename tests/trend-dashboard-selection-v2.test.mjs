import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import {
  classifyTrendEvidence,
  createLiveWorkspaceState,
  renderLiveWorkspace,
  renderTrendsDashboard,
  trendSignalCompleteness
} from "../src/live-workspace.mjs";

const thesis = {
  version: 2,
  name: "Evidence-gated emerging technology",
  sectors: ["Robotics", "Health"],
  stages: ["Pre-seed", "Seed"],
  geographies: ["Europe"],
  riskAppetite: "Evidence-gated"
};

const tavily = { configured: true, exaConfigured: true };

test("Internet Trends is left of Discover and loads the real frozen catalog without spending credits", () => {
  const live = createLiveWorkspaceState();
  live.mode = "trends";
  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });

  const trendsIndex = html.indexOf('data-live-mode="trends"');
  const discoverIndex = html.indexOf('data-live-mode="discover"');
  assert.ok(trendsIndex >= 0 && trendsIndex < discoverIndex);
  assert.match(html, /data-trend-id="TREND-ROBOTICS-AUTONOMY-2026"/);
  assert.match(html, /data-source-evidence-id="WEB-efe55344eacae6d4"/);
  assert.match(html, /Top 5 Global Robotics Trends 2026/);
  assert.match(html, /autonomous robots/);
  assert.match(html, /40% source authority, 25% publication freshness, and 35% editorial commercialization relevance/);
  assert.match(html, /Not sampled yet/);
  assert.match(html, /Opening this tab never spends credits/);
  assert.match(html, /Select trends to find companies/);
  assert.doesNotMatch(html, /name="selectedTrendIds" value="WEB-/);
});

test("one to four stable trend IDs can form a bounded filtered company search", () => {
  const live = createLiveWorkspaceState();
  live.trendsRegion = "EUROPE";
  live.trendsSector = "AI_INFRASTRUCTURE";
  live.trendsSelectedIds = [
    "TREND-ROBOTICS-AUTONOMY-2026",
    "TREND-DATACENTER-BOTTLENECKS-2026"
  ];

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /Target company region/);
  assert.match(html, /GitHub repository search has no reliable geography qualifier/);
  assert.match(html, /value="TREND-ROBOTICS-AUTONOMY-2026"[^>]*checked/);
  assert.match(html, /value="TREND-DATACENTER-BOTTLENECKS-2026"[^>]*checked/);
  assert.match(html, /2 of 4 signals selected/);
  assert.match(html, /Find companies from 2 trends · ≤2 credits/);
  assert.match(html, /The server uses every selected signal's frozen features and primary link/);
  assert.match(html, /Europe · AI infrastructure/);
});

test("the selection cap disables additional cards without discarding the four selections", () => {
  const live = createLiveWorkspaceState();
  live.trendsSelectedIds = [
    "TREND-ROBOTICS-AUTONOMY-2026",
    "TREND-DATACENTER-BOTTLENECKS-2026",
    "TREND-INDUSTRIAL-CYBER-RECOVERY-2026",
    "TREND-BCI-ADOPTION-CHALLENGES-2025"
  ];
  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /4 of 4 signals selected/);
  assert.match(html, /Selection limit reached/);
  assert.match(html, /Find companies from 4 trends · ≤4 credits/);
});

test("real discovery results render candidate provenance and nested GitHub popularity without age inference", () => {
  const live = createLiveWorkspaceState();
  live.trendsSelectedIds = ["TREND-ROBOTICS-AUTONOMY-2026"];
  live.trendsDiscovery = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    candidates: [{
      id: "CANDIDATE-1",
      companyName: "Sourced Robotics Ltd",
      founderNames: ["Founder not independently verified"],
      website: "https://startup.example/",
      reason: "Named in a retained public source as an early-stage robotics company.",
      discoveryMethod: "TREND_GROUNDED_DISCOVERY",
      sourceEvidenceIds: ["DISCOVERY-SOURCE-1"]
    }],
    githubSignals: [{
      fullName: "builder-lab/robot-stack",
      repositoryUrl: "https://github.com/builder-lab/robot-stack",
      selectedTrendIds: ["TREND-ROBOTICS-AUTONOMY-2026"],
      owner: { login: "builder-lab", accountType: "Organization", founderOrStartupStatus: "NOT_ESTABLISHED" },
      popularity: { rankWithinTrendQuery: 1, stars: 1240, forks: 87, subscribers: 14, openIssues: 9 },
      activity: {
        createdAt: "2025-01-15T00:00:00.000Z",
        pushedAt: "2026-07-10T00:00:00.000Z",
        recentlyCreatedProject: true,
        recentlyActiveProject: true
      }
    }],
    evidence: [{
      id: "DISCOVERY-SOURCE-1",
      title: "Public startup announcement",
      url: "https://source.example/startup-announcement",
      provider: "Tavily"
    }],
    tavilySourceCount: 1,
    githubRepositoryCount: 1,
    usage: { reportedCredits: 1, githubApiRequests: 1 },
    providers: {
      tavily: { method: "BASIC_SEARCH" },
      github: { method: "PUBLIC_REPOSITORY_SEARCH_API" }
    }
  };

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /Sourced Robotics Ltd/);
  assert.match(html, /data-live-candidate="CANDIDATE-1"/);
  assert.match(html, /Public startup announcement ↗/);
  assert.match(html, /builder-lab\/robot-stack/);
  assert.match(html, /<dt>Stars<\/dt><dd>1\.2K<\/dd>/);
  assert.match(html, /<dt>Subscribers<\/dt><dd>14<\/dd>/);
  assert.doesNotMatch(html, /<dt>Watchers<\/dt>/);
  assert.match(html, /Tavily Basic Search \+ GitHub Public Repository Search API/);
  assert.match(html, /Repository owner: builder-lab · Organization/);
  assert.match(html, /Founder\/company relationship not established/);
  assert.match(html, /Emerging builder means recent observable project activity—not biological age/);
  assert.match(html, /does not infer age, protected traits, founder identity, or investment potential/);
});

test("trend score and UI tags remain transparent, deterministic, and non-investment", () => {
  const item = {
    title: "European soft robotics research",
    excerpt: "A retained public source about soft robotic wearables.",
    url: "https://example.org/research",
    publishedDate: "2026-01-01",
    sourceRole: "PEER_REVIEWED_STUDY",
    captureMethod: "TAVILY_EXTRACT",
    provider: "Tavily"
  };

  const completeness = trendSignalCompleteness(item);
  const taxonomy = classifyTrendEvidence(item);
  assert.equal(completeness.score, 100);
  assert.deepEqual(completeness.components.map((component) => component.present), [true, true, true, true, true]);
  assert.ok(taxonomy.regions.includes("EUROPE"));
  assert.ok(taxonomy.sectors.includes("WEARABLE_MEDTECH"));
  assert.ok(taxonomy.sectors.includes("ROBOTICS"));
});

test("GitHub rate limits fail open in the dashboard and partial Tavily usage keeps its upper bound", () => {
  const selectedTrendId = "TREND-ROBOTICS-AUTONOMY-2026";
  const live = createLiveWorkspaceState();
  live.trendsSelectedIds = [selectedTrendId];
  live.trendsDiscovery = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    selectedTrends: [{
      id: selectedTrendId,
      searchLabel: "AI-enabled robotics and IT/OT convergence",
      sourceUrl: "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026"
    }],
    filters: {
      region: { id: "GLOBAL", label: "Global" },
      sector: { id: "ROBOTICS", label: "Robotics" }
    },
    queries: [{
      trendId: selectedTrendId,
      method: "GITHUB_REPOSITORY_SEARCH",
      status: "UNAVAILABLE",
      code: "GITHUB_UPSTREAM_RATE_LIMIT"
    }],
    candidates: [],
    githubSignals: [],
    evidence: [],
    tavilySourceCount: 0,
    githubRepositoryCount: 0,
    usage: {
      reportedCredits: null,
      reportedCreditsObserved: 2,
      reportedCreditCoverage: "2/4 Tavily searches",
      estimatedCreditsUpperBound: 4,
      githubApiRequests: 1,
      githubApiRequestsCompleted: 0
    },
    providers: {
      tavily: { method: "Basic Search" },
      github: {
        method: "Public Repository Search API",
        resultCoverage: [],
        warnings: [{
          trendId: selectedTrendId,
          code: "GITHUB_UPSTREAM_RATE_LIMIT",
          message: "GitHub repository-search rate limit was reached. Tavily company evidence was preserved and no negative signal was recorded."
        }]
      }
    }
  };

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /GitHub lookup unavailable for part or all of this run/);
  assert.match(html, /0 of 1 planned GitHub requests completed/);
  assert.match(html, /GITHUB_UPSTREAM_RATE_LIMIT/);
  assert.match(html, /Missing repository signals are unknown coverage—not a negative or empty-market signal/);
  assert.match(html, /Lookup unavailable · no negative signal/);
  assert.match(html, /Not sampled in this run/);
  assert.match(html, /GitHub lookup unavailable/);
  assert.doesNotMatch(html, /lookup returned no defensible public repository match/i);
  assert.match(html, /2 reported \(2\/4 Tavily searches\) · planned upper bound 4/);
});

test("incomplete GitHub results disclose partial coverage and reported match totals", () => {
  const selectedTrendId = "TREND-ROBOTICS-AUTONOMY-2026";
  const live = createLiveWorkspaceState();
  live.trendsSelectedIds = [selectedTrendId];
  live.trendsDiscovery = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    selectedTrends: [{ id: selectedTrendId, searchLabel: "AI-enabled robotics and IT/OT convergence" }],
    filters: { region: { id: "GLOBAL", label: "Global" }, sector: { id: "ALL", label: "All sectors" } },
    queries: [{ trendId: selectedTrendId, method: "GITHUB_REPOSITORY_SEARCH", status: "COMPLETED", incompleteResults: true }],
    candidates: [],
    githubSignals: [],
    evidence: [],
    usage: { reportedCredits: 1, reportedCreditCoverage: "1/1 Tavily searches", estimatedCreditsUpperBound: 1, githubApiRequests: 1, githubApiRequestsCompleted: 1 },
    providers: {
      github: {
        method: "Public Repository Search API",
        resultCoverage: [{ trendId: selectedTrendId, totalCount: 321, incompleteResults: true }],
        warnings: [{ trendId: selectedTrendId, code: "GITHUB_INCOMPLETE_RESULTS", message: "Coverage is partial and no negative signal is inferred." }]
      }
    }
  };

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /GitHub repository coverage is partial/);
  assert.match(html, /321 reported repository matches/);
  assert.match(html, /partial result set/);
  assert.match(html, /No repository signal shown under partial coverage/);
  assert.match(html, /Zero retained signals cannot be interpreted as an ecosystem absence/);
  assert.match(html, /Partial coverage · no absence inference/);
});

test("stale results preserve and label the executed filters and frozen source anchors", () => {
  const selectedTrendId = "TREND-ROBOTICS-AUTONOMY-2026";
  const live = createLiveWorkspaceState();
  live.trendsRegion = "EUROPE";
  live.trendsSector = "GRID_TECH";
  live.trendsSelectedIds = ["TREND-EU-GRID-CAPACITY-2026"];
  live.trendsDiscoveryStale = true;
  live.trendsDiscovery = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    selectedTrends: [{
      id: selectedTrendId,
      searchLabel: "AI-enabled robotics and IT/OT convergence",
      sourceUrl: "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026"
    }],
    filters: { region: { id: "GLOBAL", label: "Global" }, sector: { id: "ROBOTICS", label: "Robotics" } },
    candidates: [],
    githubSignals: [],
    evidence: [],
    usage: { reportedCredits: 1, reportedCreditCoverage: "1/1 Tavily searches", estimatedCreditsUpperBound: 1, githubApiRequests: 1, githubApiRequestsCompleted: 1 },
    providers: { github: { method: "Public Repository Search API", warnings: [], resultCoverage: [] } }
  };

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /Filters or selected signals changed after this result was captured/);
  assert.match(html, /Previous run—inputs changed/);
  assert.match(html, /Executed region/);
  assert.match(html, /<strong>Global<\/strong>/);
  assert.match(html, /Executed sector/);
  assert.match(html, /<strong>Robotics<\/strong>/);
  assert.match(html, /AI-enabled robotics and IT\/OT convergence ↗/);
});

test("missing GitHub popularity counts stay unknown instead of becoming zero", () => {
  const selectedTrendId = "TREND-ROBOTICS-AUTONOMY-2026";
  const live = createLiveWorkspaceState();
  live.trendsSelectedIds = [selectedTrendId];
  live.trendsDiscovery = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    selectedTrends: [{ id: selectedTrendId }],
    filters: { region: { id: "GLOBAL", label: "Global" }, sector: { id: "ROBOTICS", label: "Robotics" } },
    queries: [{ trendId: selectedTrendId, method: "GITHUB_REPOSITORY_SEARCH", status: "COMPLETED", incompleteResults: false }],
    candidates: [],
    githubSignals: [{
      fullName: "unknown-lab/null-metrics",
      repositoryUrl: "https://github.com/unknown-lab/null-metrics",
      selectedTrendIds: [selectedTrendId],
      owner: { login: "unknown-lab", accountType: "Organization", founderOrStartupStatus: "NOT_ESTABLISHED" },
      popularity: { rankWithinTrendQuery: 1, stars: null, forks: null, subscribers: null, openIssues: null },
      activity: { createdAt: null, pushedAt: null, recentlyCreatedProject: false, recentlyActiveProject: false }
    }],
    evidence: [],
    githubRepositoryCount: 1,
    usage: { reportedCredits: 1, reportedCreditCoverage: "1/1 Tavily searches", estimatedCreditsUpperBound: 1, githubApiRequests: 1, githubApiRequestsCompleted: 1 },
    providers: { github: { method: "Public Repository Search API", warnings: [], resultCoverage: [{ trendId: selectedTrendId, totalCount: 1, incompleteResults: false }] } }
  };

  const html = renderTrendsDashboard(live, tavily);
  const start = html.indexOf("unknown-lab/null-metrics");
  const card = html.slice(start, html.indexOf("</article>", start));

  assert.ok(start >= 0);
  assert.match(html, /1 linked repo · stars not reported/);
  assert.doesNotMatch(html, /1 linked repo · 0 stars/);
  assert.match(card, /<dt>Stars<\/dt><dd>Not reported<\/dd>/);
  assert.match(card, /<dt>Forks<\/dt><dd>Not reported<\/dd>/);
  assert.match(card, /<dt>Open issues<\/dt><dd>Not reported<\/dd>/);
  assert.doesNotMatch(card, /<dt>Subscribers<\/dt>/);
  assert.doesNotMatch(card, /<dd>0<\/dd>/);
});
