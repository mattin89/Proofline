import { buildOpenDataSignalSnapshot } from "./open-data-signals-v1.mjs";

export const OPEN_DATA_SIGNAL_ADAPTER_VERSION = "proofline.open-data-signal-adapter.v1";

const DATASET_MAP = Object.freeze({
  GLEIF_LEI: Object.freeze({
    datasetId: "GLEIF_LEI",
    datasetName: "GLEIF LEI Records",
    publisher: "Global Legal Entity Identifier Foundation",
    independenceFamily: "GLOBAL_LEGAL_ENTITY_IDENTITY",
    accessModel: "PUBLIC_REGISTER",
    sourceType: "LEGAL_ENTITY_REGISTER",
    officiality: "OFFICIAL_GLOBAL_LEI_REPOSITORY",
    license: "CC0-1.0"
  }),
  CLINICAL_TRIALS_GOV: Object.freeze({
    datasetId: "CLINICALTRIALS_GOV_V2",
    datasetName: "ClinicalTrials.gov API v2",
    publisher: "U.S. National Library of Medicine",
    independenceFamily: "US_CLINICAL_TRIAL_REGISTRY",
    accessModel: "OPEN_DATASET",
    sourceType: "CLINICAL_TRIAL_REGISTRY",
    officiality: "OFFICIAL_US_GOVERNMENT_REGISTRY",
    license: "PUBLIC_GOVERNMENT_DATA_WITH_CLINICALTRIALS_GOV_TERMS"
  }),
  NIH_REPORTER: Object.freeze({
    datasetId: "NIH_REPORTER_V2",
    datasetName: "NIH RePORTER API v2",
    publisher: "U.S. National Institutes of Health",
    independenceFamily: "US_FEDERAL_AWARD",
    accessModel: "OPEN_DATASET",
    sourceType: "FEDERAL_RESEARCH_AWARD",
    officiality: "OFFICIAL_US_GOVERNMENT_AWARD_RECORD",
    license: "US_FEDERAL_PUBLIC_RECORD"
  }),
  USA_SPENDING: Object.freeze({
    datasetId: "USASPENDING_API",
    datasetName: "USAspending API",
    publisher: "U.S. Department of the Treasury",
    independenceFamily: "US_FEDERAL_AWARD",
    accessModel: "OPEN_DATASET",
    sourceType: "FEDERAL_PRIME_AWARD",
    officiality: "OFFICIAL_US_GOVERNMENT_SPENDING_RECORD",
    license: "OPEN_GOVERNMENT_DATA_SUBJECT_TO_USASPENDING_DNB_LIMITATION"
  })
});

function compact(value, maximum = 300) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function slug(value) {
  return compact(value, 160).normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "UNKNOWN";
}

function safeObservedAt(value, asOf) {
  const parsed = Date.parse(String(value ?? ""));
  if (Number.isNaN(parsed) || parsed > Date.parse(asOf)) return asOf;
  return new Date(parsed).toISOString();
}

function sourceFor(record, providerDatasetId, asOf, overrides = {}) {
  const definition = DATASET_MAP[providerDatasetId];
  return {
    sourceId: `SOURCE-${definition.datasetId}-${slug(record.id || record.source?.url)}`,
    publisher: definition.publisher,
    datasetId: definition.datasetId,
    datasetName: definition.datasetName,
    datasetRecordId: compact(overrides.datasetRecordId || record.id, 500) || null,
    independenceFamily: definition.independenceFamily,
    recordTitle: compact(overrides.recordTitle || record.source?.title || definition.datasetName, 900),
    recordUrl: record.source?.url || overrides.recordUrl,
    accessModel: definition.accessModel,
    sourceType: definition.sourceType,
    officiality: definition.officiality,
    license: definition.license,
    publishedAt: overrides.publishedAt || null,
    capturedAt: asOf,
    repositoryEvidenceId: null,
    verificationStatus: "UNREVIEWED_EXACT_NORMALIZED_ENTITY_MATCH"
  };
}

function entityMatch(record, conflicts = []) {
  return {
    confidence: Number.isFinite(record?.entityMatch?.confidence) ? record.entityMatch.confidence : 0.9,
    method: compact(record?.entityMatch?.method || "PROVIDER_NORMALIZED_EXACT_ENTITY_MATCH", 400),
    matchedFields: ["company_name", "official_dataset_entity_name"],
    conflictingFields: conflicts,
    humanReviewed: false
  };
}

function missingObservation(observationId, metricId, subjectType, unit, reasonCode, note, datasetsAttempted) {
  return {
    observationId,
    metricId,
    subjectType,
    observationKind: "MISSING",
    observedAt: null,
    timePrecision: "UNKNOWN",
    value: null,
    unit,
    source: null,
    independenceKey: null,
    entityMatch: {
      confidence: null,
      method: "NO_EXACT_ENTITY_MATCH_RETAINED",
      matchedFields: [],
      conflictingFields: [],
      humanReviewed: false
    },
    missing: { reasonCode, note, datasetsAttempted },
    note: null,
    derivation: null
  };
}

function knownObservation({ observationId, metricId, unit, value, observedAt, source, independenceKey, match, note }) {
  return {
    observationId,
    metricId,
    subjectType: "STARTUP",
    observationKind: "SOURCE_REPORTED",
    observedAt,
    timePrecision: "DAY",
    value,
    unit,
    source,
    independenceKey,
    entityMatch: match,
    missing: null,
    note,
    derivation: null
  };
}

function snapshotObservationInput(observation) {
  return {
    observationId: observation.observationId,
    metricId: observation.metricId,
    subjectType: observation.subjectType,
    observationKind: observation.observationKind,
    observedAt: observation.observedAt,
    timePrecision: observation.timePrecision,
    value: observation.value,
    unit: observation.unit,
    source: observation.source,
    independenceKey: observation.independenceKey,
    entityMatch: observation.entityMatch,
    missing: observation.missing,
    note: observation.note,
    derivation: observation.derivation
  };
}

function gleifObservations(dataset, asOf) {
  if (dataset.status !== "MATCHED" || dataset.records.length !== 1) {
    const ambiguous = dataset.records.length > 1;
    return [missingObservation(
      `OBS-GLEIF-${ambiguous ? "AMBIGUOUS" : "UNKNOWN"}-${slug(asOf)}`,
      "LEGAL_ENTITY_INACTIVE_FLAG",
      "STARTUP",
      "BINARY",
      ambiguous ? "MULTIPLE_EXACT_LEGAL_NAME_MATCHES" : dataset.status === "UNAVAILABLE" ? "GLEIF_UNAVAILABLE" : "NO_EXACT_GLEIF_MATCH",
      ambiguous
        ? "More than one exact normalized legal-name record was retained; jurisdiction or a canonical LEI is required before selecting one."
        : "No single exact GLEIF legal-entity record was retained. Many startups do not have an LEI, so this remains unknown.",
      ["GLEIF_LEI"]
    )];
  }
  const record = dataset.records[0];
  const inactive = record.values.legalEntityStatus === "INACTIVE" ? 1 : 0;
  return [knownObservation({
    observationId: `OBS-GLEIF-${slug(record.values.lei)}-${slug(asOf)}`,
    metricId: "LEGAL_ENTITY_INACTIVE_FLAG",
    unit: "BINARY",
    value: inactive,
    observedAt: safeObservedAt(record.values.lastUpdateDate, asOf),
    source: sourceFor(record, "GLEIF_LEI", asOf, {
      datasetRecordId: record.values.lei,
      publishedAt: record.values.lastUpdateDate
    }),
    independenceKey: `GLEIF_LEI:${record.values.lei}`,
    match: entityMatch(record),
    note: "Binary display of the matched GLEIF legal-entity status only; it is not a solvency, operations, or investability conclusion."
  })];
}

function clinicalObservations(dataset, asOf, companyName) {
  if (dataset.status !== "MATCHED") {
    return [missingObservation(
      `OBS-CLINICAL-UNKNOWN-${slug(asOf)}`,
      "REGISTERED_CLINICAL_TRIAL_COUNT",
      "STARTUP",
      "COUNT",
      dataset.status === "UNAVAILABLE" ? "CLINICALTRIALS_GOV_UNAVAILABLE" : "NO_EXACT_SPONSOR_MATCH",
      "No exact normalized sponsor or collaborator match was retained. This is unknown and not evidence of zero clinical activity.",
      ["CLINICALTRIALS_GOV_V2"]
    )];
  }
  const record = dataset.records[0];
  const queryUrl = `${dataset.apiUrl}?query.spons=${encodeURIComponent(companyName)}&format=json`;
  return [knownObservation({
    observationId: `OBS-CLINICAL-COUNT-${slug(companyName)}-${slug(asOf)}`,
    metricId: "REGISTERED_CLINICAL_TRIAL_COUNT",
    unit: "COUNT",
    value: dataset.records.length,
    observedAt: asOf,
    source: sourceFor({ ...record, source: { ...record.source, url: queryUrl, title: `${companyName} exact sponsor/collaborator query` } }, "CLINICAL_TRIALS_GOV", asOf, {
      datasetRecordId: `SPONSOR_QUERY:${companyName}`,
      recordUrl: queryUrl
    }),
    independenceKey: `CLINICALTRIALS_GOV_SPONSOR:${slug(companyName)}`,
    match: entityMatch(record),
    note: `${dataset.records.length} exact normalized sponsor/collaborator match(es) retained. Registration and status do not establish efficacy, safety, approval, or revenue.`
  })];
}

function federalObservations(dataset, providerDatasetId, asOf) {
  if (dataset.status !== "MATCHED") return [];
  return dataset.records.flatMap((record) => {
    const values = record.values || {};
    const awardId = compact(values.coreProjectNumber || values.awardId || values.projectNumber, 160);
    const amount = Number(values.awardAmountUsd);
    if (!awardId || !Number.isFinite(amount)) return [];
    const observedAt = safeObservedAt(values.awardNoticeDate || values.startDate || values.projectStartDate, asOf);
    return [knownObservation({
      observationId: `OBS-${DATASET_MAP[providerDatasetId].datasetId}-${slug(awardId)}-${slug(record.id)}`,
      metricId: "FEDERAL_AWARD_AMOUNT_USD",
      unit: "USD",
      value: amount,
      observedAt,
      source: sourceFor(record, providerDatasetId, asOf, {
        datasetRecordId: awardId,
        publishedAt: observedAt
      }),
      independenceKey: `US_FEDERAL_AWARD:${slug(awardId)}`,
      match: entityMatch(record),
      note: "Officially reported federal-award amount. It is not necessarily cash received, recognized revenue, recurring demand, or profit."
    })];
  });
}

export function buildOfficialProviderSignalSnapshot(providerResult, { baseSnapshot = null } = {}) {
  if (!providerResult || !Array.isArray(providerResult.datasets) || !providerResult.entity?.companyName) {
    throw new TypeError("A valid official open-data provider result is required.");
  }
  const asOf = new Date(providerResult.generatedAt).toISOString();
  const byId = new Map(providerResult.datasets.map((dataset) => [dataset.id, dataset]));
  const nih = byId.get("NIH_REPORTER");
  const usa = byId.get("USA_SPENDING");
  const federal = [
    ...(nih ? federalObservations(nih, "NIH_REPORTER", asOf) : []),
    ...(usa ? federalObservations(usa, "USA_SPENDING", asOf) : [])
  ];
  if (!federal.length) {
    federal.push(missingObservation(
      `OBS-FEDERAL-AWARDS-UNKNOWN-${slug(asOf)}`,
      "FEDERAL_AWARD_AMOUNT_USD",
      "STARTUP",
      "USD",
      [nih, usa].some((item) => item?.status === "UNAVAILABLE") ? "US_FEDERAL_AWARD_DATASET_PARTIAL_OR_UNAVAILABLE" : "NO_EXACT_US_FEDERAL_AWARD_MATCH",
      "No exact matched NIH RePORTER or USAspending award was retained. This is unknown, not USD 0.",
      ["NIH_REPORTER_V2", "USASPENDING_API"]
    ));
  }
  const providerObservations = [
    ...gleifObservations(byId.get("GLEIF_LEI") || { status: "UNAVAILABLE", records: [] }, asOf),
    ...clinicalObservations(byId.get("CLINICAL_TRIALS_GOV") || { status: "UNAVAILABLE", records: [] }, asOf, providerResult.entity.companyName),
    ...federal
  ];
  const inheritedBase = baseSnapshot?.schemaVersion === "proofline.open-data-signals.v1"
    && baseSnapshot.entity?.canonicalName?.toLowerCase() === providerResult.entity.companyName.toLowerCase()
    ? baseSnapshot
    : null;
  const inherited = (inheritedBase?.observations || []).map(snapshotObservationInput);
  return buildOpenDataSignalSnapshot({
    snapshotId: `OPEN-DATA-${slug(providerResult.entity.companyName)}-${slug(asOf)}`,
    asOf,
    entity: {
      entityId: inheritedBase?.entity?.entityId || `STARTUP-${slug(providerResult.entity.companyName)}`,
      entityType: "STARTUP",
      canonicalName: providerResult.entity.companyName,
      aliases: inheritedBase?.entity?.aliases || [],
      founderNames: providerResult.entity.founderNames || []
    },
    observations: [...inherited, ...providerObservations]
  });
}
