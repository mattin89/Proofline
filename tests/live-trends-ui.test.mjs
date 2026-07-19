import test from "node:test";
import assert from "node:assert/strict";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import { createLiveWorkspaceState, renderLiveWorkspace, renderTrendsDashboard } from "../src/live-workspace.mjs";

const thesis = {
  version: 1,
  name: "Early-stage deep technology",
  sectors: ["Health", "Robotics"],
  stages: ["Pre-seed", "Seed"],
  geographies: ["Europe"],
  riskAppetite: "Evidence-gated"
};

const tavily = { configured: true, exaConfigured: true };

function trendSnapshot() {
  return {
    researchId: "TREND-TEST-1",
    generatedAt: "2026-07-19T08:30:00.000Z",
    provider: "Tavily",
    focus: "robotics and medical technology",
    refreshCostUpperBound: 3,
    usage: { reportedCredits: 3 },
    interpretation: "Unreviewed public-web signals only.",
    sections: [
      {
        id: "INTERNET_TRENDS",
        queryKind: "CURRENT_INTERNET_TRENDS",
        title: "Current internet trends",
        evidenceIds: ["T-1", "T-UNSAFE"]
      },
      {
        id: "COMPANY_CHALLENGES",
        queryKind: "COMPANY_OPERATING_CHALLENGES",
        title: "Company challenges",
        evidenceIds: ["T-2"]
      },
      {
        id: "RESEARCH_FRONTIERS",
        queryKind: "RESEARCH_FRONTIERS",
        title: "Research frontiers",
        evidenceIds: ["T-3"]
      }
    ],
    evidence: [
      {
        id: "T-1",
        title: "Industry robotics report",
        url: "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026",
        excerpt: "A retained search excerpt.",
        publishedDate: "2026-01-08T00:00:00.000Z",
        sourceType: "INDUSTRY_REPORT",
        queryKind: "CURRENT_INTERNET_TRENDS",
        verificationStatus: "UNREVIEWED"
      },
      {
        id: "T-UNSAFE",
        title: "Unsafe link is shown without a hyperlink",
        url: "javascript:alert(1)",
        excerpt: "This test item verifies URL protocol filtering.",
        queryKind: "CURRENT_INTERNET_TRENDS"
      },
      {
        id: "T-2",
        title: "Manufacturing cybersecurity guidance",
        url: "https://www.nist.gov/news-events/news/2026/05/now-available-nist-sp-1800-41-responding-and-recovering-cyber-attack",
        excerpt: "A retained search excerpt.",
        publishedDate: "2026-05-01T00:00:00.000Z",
        sourceType: "GOVERNMENT_OR_REGULATORY",
        queryKind: "COMPANY_OPERATING_CHALLENGES"
      },
      {
        id: "T-3",
        title: "Research article",
        url: "https://www.nature.com/articles/s41591-026-04414-6",
        excerpt: "A retained search excerpt.",
        publishedDate: "2026-02-01T00:00:00.000Z",
        sourceType: "ACADEMIC_RESEARCH",
        queryKind: "RESEARCH_FRONTIERS"
      }
    ]
  };
}

test("Internet trends is placed directly before Discover and does not render an assessment underneath", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  live.selectedAssessmentId = assessment.id;
  live.mode = "trends";
  live.trends = trendSnapshot();

  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  const discoverIndex = html.indexOf('data-live-mode="discover"');
  const trendsIndex = html.indexOf('data-live-mode="trends"');
  const investigateIndex = html.indexOf('data-live-mode="investigate"');

  assert.ok(trendsIndex >= 0 && trendsIndex < discoverIndex);
  assert.ok(discoverIndex < investigateIndex);
  assert.doesNotMatch(html, /id="live-assessment"/);
  assert.match(html, /Opening this tab never spends credits/);
});

test("trend dashboard reports retained evidence and hosts honestly with safe direct links", () => {
  const live = createLiveWorkspaceState();
  live.trends = trendSnapshot();

  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /<strong>4<\/strong>/);
  assert.match(html, /<small>3 distinct public hosts<\/small>/);
  assert.match(html, /3 Tavily credits reported/);
  assert.match(html, /href="https:\/\/ifr\.org\//);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /Unreviewed signal layer—no score/);
  assert.match(html, /Refresh with Tavily · ≈3 credits/);
});

test("trend dashboard has an honest empty state and no placeholder claims", () => {
  const live = createLiveWorkspaceState();
  live.trends = null;
  live.trendsFocus = "";
  const html = renderTrendsDashboard(live, tavily);

  assert.match(html, /No captured trend snapshot/);
  assert.match(html, /No placeholder claims are shown/);
  assert.doesNotMatch(html, /trend-source-card/);
});
