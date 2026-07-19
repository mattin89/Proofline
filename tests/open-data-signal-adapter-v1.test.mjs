import assert from "node:assert/strict";
import test from "node:test";

import {
  OPEN_DATA_SIGNAL_ADAPTER_VERSION,
  buildOfficialProviderSignalSnapshot
} from "../src/open-data-signal-adapter-v1.mjs";
import { EMOVO_OPEN_DATA_SIGNAL_DEMO_V1 } from "../src/open-data-signals-v1.mjs";

const GENERATED_AT = "2026-07-19T12:00:00.000Z";
const COMPANY_NAME = "Acme Robotics, Inc.";

function providerRecord(datasetId, id, values, confidence = 0.98) {
  return {
    id,
    values,
    entityMatch: {
      confidence,
      method: "NORMALIZED_LEGAL_NAME_EXACT",
      matchedFields: ["company_name", "official_dataset_entity_name"],
      conflictingFields: []
    },
    source: {
      title: `${datasetId} record ${id}`,
      url: `https://example.gov/${datasetId.toLowerCase()}/${encodeURIComponent(id)}`
    }
  };
}

function dataset(id, status = "NO_EXACT_ENTITY_MATCH", records = []) {
  return {
    id,
    status,
    records,
    apiUrl: id === "CLINICAL_TRIALS_GOV" ? "https://clinicaltrials.gov/api/v2/studies" : undefined
  };
}

function providerResult({
  companyName = COMPANY_NAME,
  founderNames = ["Alice Founder"],
  gleif = dataset("GLEIF_LEI"),
  clinical = dataset("CLINICAL_TRIALS_GOV"),
  nih = dataset("NIH_REPORTER"),
  usaSpending = dataset("USA_SPENDING"),
  ...extra
} = {}) {
  return {
    version: "proofline.open-data-providers.v1",
    generatedAt: GENERATED_AT,
    entity: { companyName, founderNames },
    datasets: [gleif, clinical, nih, usaSpending],
    ...extra
  };
}

function observation(snapshot, metricId, datasetId = null) {
  return snapshot.observations.find((item) => (
    item.metricId === metricId && (!datasetId || item.source?.datasetId === datasetId)
  ));
}

function indicator(snapshot, indicatorId) {
  const match = snapshot.indicators.find((item) => item.indicatorId === indicatorId);
  assert.ok(match, `Expected indicator ${indicatorId}`);
  return match;
}

test("the adapter version is explicit and exact GLEIF ACTIVE/INACTIVE states map to 0/1 risk observations", () => {
  assert.equal(OPEN_DATA_SIGNAL_ADAPTER_VERSION, "proofline.open-data-signal-adapter.v1");

  for (const [legalEntityStatus, expectedValue, expectedNormalized] of [
    ["ACTIVE", 0, 0],
    ["INACTIVE", 1, 100]
  ]) {
    const gleifRecord = providerRecord("GLEIF_LEI", `LEI-${legalEntityStatus}`, {
      lei: `529900-${legalEntityStatus}`,
      legalEntityStatus,
      lastUpdateDate: "2026-06-30"
    });
    const snapshot = buildOfficialProviderSignalSnapshot(providerResult({
      gleif: dataset("GLEIF_LEI", "MATCHED", [gleifRecord])
    }));
    const item = observation(snapshot, "LEGAL_ENTITY_INACTIVE_FLAG", "GLEIF_LEI");

    assert.equal(item.observationKind, "SOURCE_REPORTED");
    assert.equal(item.value, expectedValue);
    assert.equal(item.normalizedValue, expectedNormalized);
    assert.equal(item.entityMatch.method, "NORMALIZED_LEGAL_NAME_EXACT");
    assert.equal(item.source.datasetRecordId, `529900-${legalEntityStatus}`);
    assert.equal(item.independenceKey, `GLEIF_LEI:529900-${legalEntityStatus}`);

    const risk = indicator(snapshot, "LEGAL_ENTITY_INACTIVE_RISK");
    assert.equal(risk.status, "OBSERVED");
    assert.equal(risk.rawValue, expectedValue);
    assert.equal(risk.normalizedValue, expectedNormalized);
    assert.equal(risk.canAffectOpportunityScore, false);
  }
});

test("ClinicalTrials matched records become one exact sponsor-query count rather than invented trial outcomes", () => {
  const records = ["NCT00000001", "NCT00000002", "NCT00000003"].map((nctId) => (
    providerRecord("CLINICAL_TRIALS_GOV", nctId, { nctId })
  ));
  const snapshot = buildOfficialProviderSignalSnapshot(providerResult({
    clinical: dataset("CLINICAL_TRIALS_GOV", "MATCHED", records)
  }));
  const count = observation(snapshot, "REGISTERED_CLINICAL_TRIAL_COUNT", "CLINICALTRIALS_GOV_V2");

  assert.equal(count.value, 3);
  assert.equal(count.unit, "COUNT");
  assert.equal(count.observedAt, GENERATED_AT);
  assert.equal(count.source.datasetRecordId, `SPONSOR_QUERY:${COMPANY_NAME}`);
  assert.equal(new URL(count.source.recordUrl).searchParams.get("query.spons"), COMPANY_NAME);
  assert.match(count.note, /3 exact normalized sponsor\/collaborator match\(es\)/i);

  const execution = indicator(snapshot, "PUBLIC_CLINICAL_TRIAL_EXECUTION");
  assert.equal(execution.rawValue, 3);
  assert.equal(execution.normalizedValue, 30);
  assert.equal(execution.knownPointCount, 1);
});

test("NIH and USAspending observations for the same award retain both provenances but count once", () => {
  const nihRecord = providerRecord("NIH_REPORTER", "NIH-APPLICATION-101", {
    coreProjectNumber: "R43NS000001",
    awardAmountUsd: 500_000,
    awardNoticeDate: "2025-10-01"
  }, 0.97);
  const spendingRecord = providerRecord("USA_SPENDING", "USA-AWARD-101", {
    awardId: "R43NS000001",
    awardAmountUsd: 500_000,
    startDate: "2025-10-01"
  }, 0.99);
  const snapshot = buildOfficialProviderSignalSnapshot(providerResult({
    nih: dataset("NIH_REPORTER", "MATCHED", [nihRecord]),
    usaSpending: dataset("USA_SPENDING", "MATCHED", [spendingRecord])
  }));
  const federal = snapshot.observations.filter((item) => item.metricId === "FEDERAL_AWARD_AMOUNT_USD");

  assert.equal(federal.length, 2);
  assert.deepEqual(federal.map((item) => item.source.datasetId).sort(), ["NIH_REPORTER_V2", "USASPENDING_API"]);
  assert.deepEqual(new Set(federal.map((item) => item.independenceKey)), new Set(["US_FEDERAL_AWARD:R43NS000001"]));
  assert.equal(snapshot.deduplication.rawKnownObservationCount, 2);
  assert.equal(snapshot.deduplication.independentKnownObservationCount, 1);
  assert.equal(snapshot.deduplication.overlappingObservationsCollapsed, 1);

  const [group] = snapshot.deduplication.groups.filter((item) => item.metricId === "FEDERAL_AWARD_AMOUNT_USD");
  assert.deepEqual(group.datasetIds, ["NIH_REPORTER_V2", "USASPENDING_API"]);
  assert.equal(group.selectedObservationId, "OBS-USASPENDING_API-R43NS000001-USA-AWARD-101");
  assert.equal(group.conflictingValues, false);

  const capital = indicator(snapshot, "PUBLIC_FEDERAL_AWARD_CAPITAL");
  assert.equal(capital.rawValue, 500_000);
  assert.equal(capital.knownPointCount, 1);
});

test("all official no-matches remain explicit unknowns, never zero or adverse evidence", () => {
  const snapshot = buildOfficialProviderSignalSnapshot(providerResult());

  assert.equal(snapshot.coverage.observationCount, 3);
  assert.equal(snapshot.coverage.knownObservationCount, 0);
  assert.equal(snapshot.coverage.unknownObservationCount, 3);
  assert.equal(snapshot.deduplication.rawKnownObservationCount, 0);
  assert.equal(snapshot.deduplication.independentKnownObservationCount, 0);
  assert.ok(snapshot.observations.every((item) => item.observationKind === "MISSING"));
  assert.ok(snapshot.observations.every((item) => item.value === null && item.normalizedValue === null));
  assert.ok(snapshot.observations.every((item) => item.source === null));

  for (const indicatorId of [
    "LEGAL_ENTITY_INACTIVE_RISK",
    "PUBLIC_CLINICAL_TRIAL_EXECUTION",
    "PUBLIC_FEDERAL_AWARD_CAPITAL"
  ]) {
    const item = indicator(snapshot, indicatorId);
    assert.equal(item.status, "UNKNOWN");
    assert.equal(item.rawValue, null);
    assert.equal(item.normalizedValue, null);
    assert.equal(item.entityMatchConfidence, null);
    assert.ok(item.missingReasonCodes.length > 0);
  }
  assert.match(
    observation(snapshot, "FEDERAL_AWARD_AMOUNT_USD").missing.note,
    /unknown, not USD 0/i
  );
});

test("the Emovo base snapshot is inherited while provider metadata cannot alter score or check sizing", () => {
  const input = providerResult({
    companyName: "Emovo Care",
    founderNames: ["Luca Randazzo", "Iselin Frøybu"],
    opportunityScore: 100,
    recommendedCheckUsd: 10_000_000,
    checkSizeUsd: 10_000_000
  });
  const snapshot = buildOfficialProviderSignalSnapshot(input, {
    baseSnapshot: EMOVO_OPEN_DATA_SIGNAL_DEMO_V1
  });
  const inheritedIds = new Set(snapshot.observations.map((item) => item.observationId));

  for (const item of EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations) {
    assert.ok(inheritedIds.has(item.observationId), `Expected inherited observation ${item.observationId}`);
  }
  assert.equal(snapshot.entity.entityId, EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.entity.entityId);
  assert.deepEqual(snapshot.entity.aliases, EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.entity.aliases);
  assert.deepEqual(snapshot.entity.founderNames, EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.entity.founderNames);
  assert.equal(
    snapshot.observations.length,
    EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations.length + 3
  );

  const baseIndicatorState = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.indicators.map((item) => [
    item.indicatorId, item.status, item.rawValue, item.normalizedValue
  ]);
  const inheritedIndicatorState = snapshot.indicators.map((item) => [
    item.indicatorId, item.status, item.rawValue, item.normalizedValue
  ]);
  assert.deepEqual(inheritedIndicatorState, baseIndicatorState);

  assert.equal(snapshot.boundaries.canAffectOpportunityScore, false);
  assert.equal(snapshot.boundaries.canAffectCheckSizing, false);
  assert.equal(snapshot.integration.opportunityScoreInput, null);
  for (const prohibited of ["opportunityScore", "recommendedCheckUsd", "checkSizeUsd"]) {
    assert.equal(Object.hasOwn(snapshot, prohibited), false);
  }
});

test("a base snapshot for another entity is not inherited", () => {
  const snapshot = buildOfficialProviderSignalSnapshot(providerResult(), {
    baseSnapshot: EMOVO_OPEN_DATA_SIGNAL_DEMO_V1
  });
  const outputIds = new Set(snapshot.observations.map((item) => item.observationId));

  assert.equal(snapshot.observations.length, 3);
  assert.equal(
    EMOVO_OPEN_DATA_SIGNAL_DEMO_V1.observations.some((item) => outputIds.has(item.observationId)),
    false
  );
  assert.equal(snapshot.entity.entityId, "STARTUP-ACME-ROBOTICS-INC");
  assert.deepEqual(snapshot.entity.aliases, []);
});

test("malformed provider results are rejected before a misleading snapshot can be produced", () => {
  assert.throws(
    () => buildOfficialProviderSignalSnapshot(null),
    /valid official open-data provider result/i
  );
  assert.throws(
    () => buildOfficialProviderSignalSnapshot({ entity: { companyName: COMPANY_NAME }, datasets: {} }),
    /valid official open-data provider result/i
  );
  assert.throws(
    () => buildOfficialProviderSignalSnapshot({ datasets: [], entity: {} }),
    /valid official open-data provider result/i
  );
  assert.throws(
    () => buildOfficialProviderSignalSnapshot(providerResult({ generatedAt: "not-a-date" })),
    /invalid time value/i
  );
  assert.throws(
    () => buildOfficialProviderSignalSnapshot(providerResult({
      gleif: { id: "GLEIF_LEI", status: "MATCHED", records: null }
    })),
    TypeError
  );
});
