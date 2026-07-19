import assert from "node:assert/strict";
import test from "node:test";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import {
  EMOVO_OPEN_DATA_SIGNAL_DEMO_V1,
  OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS,
  OPEN_DATA_SIGNAL_INTEGRATION_GUIDANCE,
  OPEN_DATA_SIGNAL_SCHEMA_VERSION,
  OFFICIAL_OPEN_DATA_ADAPTERS_V1,
  buildOpenDataSignalSnapshot,
  createOpenDataSignalPolicyReview
} from "../src/open-data-signals-v1.mjs";

function indicator(id) {
  return EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.indicators.find((item) => item.indicatorId === id);
}

test("the deterministic Emovo snapshot uses only real public records already cited in the reviewed repository demo", () => {
  const sourceUrls = new Set(
    EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations.flatMap((item) => item.source ? [item.source.recordUrl] : [])
  );
  const reviewedUrls = new Set(createEmovoDemoAssessment().evidence.map((item) => new URL(item.sourceUrl).href));
  assert.deepEqual([...sourceUrls].sort(), [
    "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000",
    "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256"
  ].sort());
  for (const url of sourceUrls) assert.ok(reviewedUrls.has(url), `${url} must already exist in the reviewed demo evidence`);

  const snapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  assert.equal(snapshot.schemaVersion, OPEN_DATA_SIGNAL_SCHEMA_VERSION);
  assert.equal(snapshot.entity.canonicalName, "Emovo Care");
  assert.deepEqual(snapshot.entity.founderNames, ["Luca Randazzo", "Iselin Frøybu"]);
  assert.equal(snapshot.coverage.distinctSourceCount, 2);
  assert.equal(snapshot.coverage.distinctIndependenceFamilyCount, 2);
  assert.equal(snapshot.coverage.openDatasetObservationCount, 0);
  assert.equal(snapshot.coverage.publicRecordObservationCount, 8);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.observations), true);
  assert.equal(Object.isFrozen(snapshot.observations[0].source), true);
});

test("official adapters have stable dataset IDs and NIH/USAspending share an overlap family", () => {
  assert.deepEqual(Object.keys(OFFICIAL_OPEN_DATA_ADAPTERS_V1), [
    "GLEIF_LEI",
    "CLINICALTRIALS_GOV_V2",
    "NIH_REPORTER_V2",
    "USASPENDING_API"
  ]);
  for (const [id, adapter] of Object.entries(OFFICIAL_OPEN_DATA_ADAPTERS_V1)) {
    assert.equal(adapter.datasetId, id);
    assert.equal(adapter.accessModel, "OPEN_DATASET");
    assert.match(adapter.officialUrl, /^https:\/\//);
    assert.match(adapter.scoreUse, /EXCLUDED.*POLICY_REVIEW/i);
  }
  assert.equal(OFFICIAL_OPEN_DATA_ADAPTERS_V1.NIH_REPORTER_V2.independenceFamily, "US_FEDERAL_AWARD");
  assert.equal(OFFICIAL_OPEN_DATA_ADAPTERS_V1.USASPENDING_API.independenceFamily, "US_FEDERAL_AWARD");
  assert.equal("GITHUB" in OFFICIAL_OPEN_DATA_ADAPTERS_V1, false);
});

test("time series preserve raw points and derive transparent growth and risk directions", () => {
  const commercial = indicator("COMMERCIAL_MILESTONE_MOMENTUM");
  assert.equal(commercial.signalClass, "GROWTH");
  assert.equal(commercial.rawValue, 3);
  assert.equal(commercial.normalizedValue, 60);
  assert.equal(commercial.trend.direction, "INCREASING");
  assert.equal(commercial.trend.rawDelta, 1);
  assert.match(commercial.normalization.formula, /lower bound.+upper bound/i);
  assert.match(commercial.referenceRangeCaveat, /not an industry percentile/i);

  const risk = indicator("REGULATORY_MILESTONE_GAP");
  assert.equal(risk.signalClass, "RISK");
  assert.equal(risk.rawValue, 0);
  assert.equal(risk.normalizedValue, 0);
  assert.equal(risk.trend.direction, "DECREASING");
  assert.equal(risk.trend.rawDelta, -1);
  assert.match(risk.trend.meaning, /risk proxy.+decreasing/i);
  assert.match(risk.referenceRangeCaveat, /does not measure total regulatory risk/i);

  const series = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.timeSeries.find((item) => item.metricId === "COMMERCIAL_MILESTONE_COUNT");
  assert.deepEqual(series.points.map((point) => point.value), [1, 2, 3]);
  assert.deepEqual(series.points.map((point) => point.observedAt), [
    "2021-12-31T00:00:00.000Z",
    "2025-12-01T00:00:00.000Z",
    "2026-05-01T00:00:00.000Z"
  ]);
});

test("freshness and entity match remain separate provenance dimensions rather than a hidden composite", () => {
  const latest = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations.find(
    (item) => item.observationId === "OBS-EMOVO-COMMERCIAL-2026-05"
  );
  assert.equal(latest.entityMatch.confidence, 0.98);
  assert.equal(latest.entityMatch.humanReviewed, true);
  assert.deepEqual(latest.entityMatch.matchedFields, ["company_name", "product_context"]);
  assert.ok(latest.freshness.score > 80 && latest.freshness.score <= 100);
  assert.ok(latest.freshness.ageDays > 0);
  assert.match(latest.freshness.formula, /age days.+stale-after days/i);
  assert.equal("confidenceAdjustedScore" in latest, false);
});

test("missing official records remain explicit unknowns and never become zeros", () => {
  for (const id of [
    "ANNUAL_REVENUE_DISCLOSURE",
    "FOUNDER_ROLE_CHANGE_RISK",
    "REGULATORY_ADVERSE_EVENT_RISK"
  ]) {
    const item = indicator(id);
    assert.equal(item.status, "UNKNOWN");
    assert.equal(item.rawValue, null);
    assert.equal(item.normalizedValue, null);
    assert.equal(item.trend.direction, "UNKNOWN");
    assert.equal(item.entityMatchConfidence, null);
    assert.ok(item.missingReasonCodes.length > 0);
  }
  const revenue = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations.find((item) => item.metricId === "ANNUAL_REVENUE_CHF");
  assert.equal(revenue.value, null);
  assert.equal(revenue.source, null);
  assert.match(revenue.missing.note, /must not be encoded as CHF 0/i);
  assert.equal(EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.coverage.unknownObservationCount, 6);
});

test("NIH RePORTER and USAspending overlap is collapsed by federal-award identity without losing provenance", () => {
  const source = (datasetId, publisher) => ({
    sourceId: `SOURCE-${datasetId}`,
    publisher,
    datasetId,
    datasetName: datasetId,
    datasetRecordId: "FEDERAL-AWARD-R01-123",
    independenceFamily: "US_FEDERAL_AWARD",
    recordTitle: "Matched federal award",
    recordUrl: datasetId === "NIH_REPORTER_V2" ? "https://reporter.nih.gov/" : "https://www.usaspending.gov/",
    accessModel: "OPEN_DATASET",
    sourceType: "US_FEDERAL_AWARD_RECORD",
    officiality: "US_GOVERNMENT_PRIMARY",
    license: "PUBLIC_ACCESS_TERMS_APPLY",
    publishedAt: "2025-10-01T00:00:00.000Z",
    capturedAt: "2026-07-19T00:00:00.000Z",
    repositoryEvidenceId: null,
    verificationStatus: "UNREVIEWED"
  });
  const observation = (observationId, datasetId, publisher, confidence) => ({
    observationId,
    metricId: "FEDERAL_AWARD_AMOUNT_USD",
    subjectType: "STARTUP",
    observationKind: "SOURCE_REPORTED",
    observedAt: "2025-10-01T00:00:00.000Z",
    timePrecision: "DAY",
    value: 500_000,
    unit: "USD",
    source: source(datasetId, publisher),
    independenceKey: "US_FEDERAL_AWARD:FEDERAL-AWARD-R01-123",
    entityMatch: {
      confidence,
      method: "EXACT_AWARD_IDENTIFIER_AND_RECIPIENT_NAME",
      matchedFields: ["award_id", "recipient_name"],
      conflictingFields: [],
      humanReviewed: false
    },
    missing: null,
    note: "The same federal award is exposed by two official datasets.",
    derivation: null
  });
  const snapshot = buildOpenDataSignalSnapshot({
    snapshotId: "OPEN-DATA-FEDERAL-OVERLAP",
    asOf: "2026-07-19T00:00:00.000Z",
    entity: {
      entityId: "STARTUP-EXAMPLE",
      entityType: "STARTUP",
      canonicalName: "Example Therapeutics",
      aliases: [],
      founderNames: []
    },
    observations: [
      observation("OBS-NIH", "NIH_REPORTER_V2", "National Institutes of Health", 0.97),
      observation("OBS-USASPENDING", "USASPENDING_API", "U.S. Department of the Treasury", 0.99)
    ]
  });
  assert.equal(snapshot.observations.length, 2);
  assert.equal(snapshot.deduplication.rawKnownObservationCount, 2);
  assert.equal(snapshot.deduplication.independentKnownObservationCount, 1);
  assert.equal(snapshot.deduplication.overlappingObservationsCollapsed, 1);
  const [group] = snapshot.deduplication.groups;
  assert.equal(group.independenceFamily, "US_FEDERAL_AWARD");
  assert.deepEqual(group.datasetIds, ["NIH_REPORTER_V2", "USASPENDING_API"]);
  assert.equal(group.selectedObservationId, "OBS-USASPENDING");
  assert.equal(group.conflictingValues, false);
  const award = snapshot.indicators.find((item) => item.indicatorId === "PUBLIC_FEDERAL_AWARD_CAPITAL");
  assert.equal(award.knownPointCount, 1);
  assert.equal(award.rawValue, 500_000);
  assert.equal(award.trend.direction, "UNKNOWN");
});

test("the signal layer is structurally isolated from the Opportunity score and check sizing", () => {
  const snapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  assert.deepEqual(snapshot.boundaries, {
    missingMeansUnknown: true,
    canAffectOpportunityScore: false,
    canAffectCheckSizing: false,
    producesSuccessProbability: false,
    founderTraitInferenceAllowed: false,
    policyReviewRequiredForAnyDecisionImpact: true
  });
  assert.equal(snapshot.integration.state, "ISOLATED_OBSERVATIONAL_LAYER");
  assert.equal(snapshot.integration.opportunityScoreInput, null);
  assert.equal("opportunityScore" in snapshot, false);
  assert.match(OPEN_DATA_SIGNAL_INTEGRATION_GUIDANCE.coreOpportunityScoreIntegration, /PROHIBITED.*POLICY_REVIEW.*VERSIONED_IMPLEMENTATION/i);
  assert.doesNotMatch(JSON.stringify(snapshot), /"successProbability"\s*:|"investmentRecommendation"\s*:/i);
});

test("invalid or misleading observations are rejected at the model boundary", () => {
  const base = {
    snapshotId: "INVALID-SNAPSHOT",
    asOf: "2026-07-19T00:00:00.000Z",
    entity: {
      entityId: "STARTUP-1",
      entityType: "STARTUP",
      canonicalName: "Example",
      aliases: [],
      founderNames: []
    }
  };
  const missingWithoutReason = {
    observationId: "OBS-MISSING",
    metricId: "ANNUAL_REVENUE_CHF",
    subjectType: "STARTUP",
    observationKind: "MISSING",
    observedAt: null,
    timePrecision: "UNKNOWN",
    value: null,
    unit: "CHF",
    source: null,
    entityMatch: {
      confidence: null,
      method: "NOT_ATTEMPTED",
      matchedFields: [],
      conflictingFields: [],
      humanReviewed: false
    },
    missing: null,
    note: null,
    derivation: null
  };
  assert.throws(() => buildOpenDataSignalSnapshot({ ...base, observations: [missingWithoutReason] }), /Missing-data record/);
  assert.throws(() => buildOpenDataSignalSnapshot({ ...base, observations: [], opportunityScore: 99 }), /unknown field opportunityScore/);

  const future = structuredClone(EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations[0]);
  for (const field of ["indicatorId", "signalClass", "normalizedValue", "freshness"]) delete future[field];
  future.observedAt = "2027-01-01T00:00:00.000Z";
  assert.throws(() => buildOpenDataSignalSnapshot({ ...base, observations: [future] }), /cannot be after snapshot asOf/);

  const badConfidence = structuredClone(EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations[0]);
  for (const field of ["indicatorId", "signalClass", "normalizedValue", "freshness"]) delete badConfidence[field];
  badConfidence.entityMatch.confidence = 1.1;
  assert.throws(() => buildOpenDataSignalSnapshot({ ...base, observations: [badConfidence] }), /confidence.+0 to 1/i);
});

test("explicit policy review creates a separate authorization envelope but still cannot mutate the core score", () => {
  const snapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  const review = createOpenDataSignalPolicyReview(snapshot, {
    reviewId: "POLICY-REVIEW-EMOVO-1",
    reviewer: "Mario",
    reviewedAt: "2026-07-19T12:00:00.000Z",
    policyVersion: "proofline.open-data-policy.v1",
    rationale: "Use named public milestones as a separate diligence input while preserving missingness and provenance.",
    targetUse: "VERSIONED_SCORE_POLICY_CANDIDATE",
    authorizedIndicatorIds: ["COMMERCIAL_MILESTONE_MOMENTUM", "REGULATORY_MILESTONE_GAP"],
    acknowledgements: OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS
  });
  assert.equal(review.status, "POLICY_REVIEWED_CANDIDATE_NOT_APPLIED");
  assert.equal(review.integrationBoundary.eligibleForExternalPolicyIntegration, true);
  assert.equal(review.integrationBoundary.coreOpportunityScoreModified, false);
  assert.equal(review.integrationBoundary.canAffectOpportunityScoreWithinThisModule, false);
  assert.equal(review.integrationBoundary.requiresSeparateVersionedScoringImplementation, true);
  assert.equal("opportunityScore" in review, false);
  assert.equal(snapshot.integration.policyReview, null);
  assert.equal(Object.isFrozen(review), true);

  assert.throws(() => createOpenDataSignalPolicyReview(snapshot, {
    reviewId: "INCOMPLETE",
    reviewer: "Mario",
    reviewedAt: "2026-07-19T12:00:00.000Z",
    policyVersion: "proofline.open-data-policy.v1",
    rationale: "Incomplete review.",
    targetUse: "DILIGENCE_PRIORITIZATION",
    authorizedIndicatorIds: ["COMMERCIAL_MILESTONE_MOMENTUM"],
    acknowledgements: OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS.slice(0, 2)
  }), /missing acknowledgements/i);
});
