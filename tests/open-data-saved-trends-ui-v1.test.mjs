import test from "node:test";
import assert from "node:assert/strict";

import { createEmovoDemoAssessment } from "../src/demo-data-v2.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import {
  createLiveWorkspaceState,
  renderLiveWorkspace,
  renderSavedTrendsDashboard
} from "../src/live-workspace.mjs";
import { TREND_COMPANY_DISCOVERY_CATALOG } from "../src/trend-company-discovery-v1.mjs";
import {
  appendSavedTrendObservation,
  createSavedTrendObservationSnapshot,
  createSavedTrendsProfile,
  saveTrendToProfile
} from "../src/saved-trends-v1.mjs";
import { EMOVO_OPEN_DATA_SIGNAL_DEMO_V1 } from "../src/open-data-signals-v1.mjs";

const thesis = {
  version: 2,
  name: "Evidence-gated emerging technology",
  sectors: ["Robotics", "Health"],
  stages: ["Pre-seed", "Seed"],
  geographies: ["Europe"],
  riskAppetite: "Evidence-gated"
};
const tavily = { configured: true, exaConfigured: true };

function profileWithHistory() {
  const trend = TREND_COMPANY_DISCOVERY_CATALOG[0];
  let profile = createSavedTrendsProfile({ profileId: "Mario", createdAt: "2026-07-19T08:00:00.000Z" });
  profile = saveTrendToProfile(profile, {
    trendId: trend.id,
    actor: "Mario",
    occurredAt: "2026-07-19T10:00:00.000Z"
  });
  const snapshot = createSavedTrendObservationSnapshot({
    snapshotId: "SAVED-UI-OBS-1",
    capturedAt: "2026-07-19T11:00:00.000Z",
    provider: "Tavily + GitHub",
    trend,
    metrics: {
      sourceFreshness: 100,
      githubRepositoryCount: 2,
      githubStars: 125,
      githubForks: 10,
      companySignalCount: 3
    }
  });
  return appendSavedTrendObservation(profile, {
    trendId: trend.id,
    actor: "PROOFLINE_CURRENT_DATA_CAPTURE",
    occurredAt: "2026-07-19T11:00:01.000Z",
    currentSnapshot: snapshot
  });
}

test("saved trends render a reusable profile watch with explicit history and anti-forecast boundaries", () => {
  const live = createLiveWorkspaceState();
  live.savedTrendsProfile = profileWithHistory();
  live.savedTrendSelectionIds = [TREND_COMPANY_DISCOVERY_CATALOG[0].id];
  const html = renderSavedTrendsDashboard(live, tavily);

  assert.match(html, /Mario's profile · evidence watchlist/);
  assert.match(html, /Later observations<\/span><strong>1/);
  assert.match(html, /GitHub stars/);
  assert.match(html, /125/);
  assert.match(html, /data-saved-trend-select/);
  assert.match(html, /Load 1 saved trend into search/);
  assert.match(html, /Change is not a growth forecast/);
  assert.match(html, /Null means not sampled or not reported/);
});

test("assessment dashboard shows real Emovo public-record indicators and four official datasets without score authority", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  assessment.openDataSignalSnapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  assessment.openData = null;
  assessment.openDataLoading = false;
  assessment.openDataError = null;
  live.assessments = [assessment];
  live.selectedAssessmentId = assessment.id;
  live.mode = "assessments";
  live.capabilities = {
    providers: {
      officialOpenData: [
        { id: "GLEIF_LEI", label: "GLEIF LEI records", coverage: "Global legal entities", access: "No API key" },
        { id: "CLINICAL_TRIALS_GOV", label: "ClinicalTrials.gov", coverage: "Registered clinical studies", access: "No API key" },
        { id: "NIH_REPORTER", label: "NIH RePORTER", coverage: "U.S. research awards", access: "No API key" },
        { id: "USA_SPENDING", label: "USAspending.gov", coverage: "U.S. federal prime awards", access: "No API key" }
      ]
    }
  };

  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /Open-data growth &amp; risk context/);
  assert.match(html, /Check 4 official datasets · 0 API credits/);
  assert.match(html, /Public commercial milestones/);
  assert.match(html, /CHF\s*150,000/);
  assert.match(html, /Annual revenue amount/);
  assert.match(html, /No hidden score inflation/);
  assert.match(html, /These observations sit beside—not inside—the Opportunity score/);
  assert.match(html, /Not queried/);
  assert.match(html, /Entity query not run/);
  assert.match(html, /GLEIF LEI records/);
  assert.match(html, /ClinicalTrials\.gov/);
  assert.match(html, /NIH RePORTER/);
  assert.match(html, /USAspending\.gov/);
});

test("a completed no-match dataset never renders a zero-dollar award value", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  assessment.openDataSignalSnapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  assessment.openDataLoading = false;
  assessment.openDataError = null;
  assessment.openData = {
    generatedAt: "2026-07-19T12:00:00.000Z",
    coverage: { queriedDatasets: 4, completedDatasets: 4, matchedDatasets: 0, matchedRecords: 0, unavailableDatasets: 0 },
    usage: { providerCreditsUsed: 0, externalRequestsUpperBound: 5 },
    interpretation: "No score authority.",
    catalog: [],
    datasets: [{
      id: "NIH_REPORTER",
      label: "NIH RePORTER",
      access: "No API key",
      coverage: "NIH awards",
      documentationUrl: "https://api.reporter.nih.gov/",
      interpretation: "No exact awardee match is unknown.",
      status: "NO_EXACT_ENTITY_MATCH",
      matchedRecords: 0,
      records: [],
      warnings: [],
      summary: { exactAwardeeMatches: 0, reportedApplicationAwardsUsd: 0 }
    }]
  };
  live.assessments = [assessment];
  live.selectedAssessmentId = assessment.id;
  live.mode = "assessments";

  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /Reported application awards usd/);
  assert.match(html, /Unknown · no exact match/);
  assert.doesNotMatch(html, /<dd>\$0<\/dd>/);
});
