export const OPEN_DATA_SIGNAL_SCHEMA_VERSION = "proofline.open-data-signals.v1";
export const OPEN_DATA_POLICY_REVIEW_SCHEMA_VERSION = "proofline.open-data-signal-policy-review.v1";
export const OPEN_DATA_SIGNAL_DEMO_CAPTURED_AT = "2026-07-19T00:00:00.000Z";

const MS_PER_DAY = 86_400_000;
const SIGNAL_CLASSES = new Set(["GROWTH", "RISK"]);
const SUBJECT_TYPES = new Set(["STARTUP", "FOUNDER", "FOUNDER_TEAM"]);
const OBSERVATION_KINDS = new Set(["SOURCE_REPORTED", "TRANSPARENT_DERIVATION", "MISSING"]);
const TIME_PRECISIONS = new Set(["DAY", "MONTH", "YEAR", "UNKNOWN"]);
const ACCESS_MODELS = new Set(["OPEN_DATASET", "PUBLIC_REGISTER", "PUBLIC_RECORD"]);
const REVIEW_TARGETS = new Set(["DILIGENCE_PRIORITIZATION", "VERSIONED_SCORE_POLICY_CANDIDATE"]);

export const OFFICIAL_OPEN_DATA_ADAPTERS_V1 = deepFreeze({
  GLEIF_LEI: {
    datasetId: "GLEIF_LEI",
    label: "GLEIF LEI Records",
    publisher: "Global Legal Entity Identifier Foundation",
    accessModel: "OPEN_DATASET",
    officialUrl: "https://api.gleif.org/api/v1/lei-records",
    independenceFamily: "GLOBAL_LEGAL_ENTITY_IDENTITY",
    intendedSignals: ["LEGAL_ENTITY_INACTIVE_RISK"],
    scoreUse: "EXCLUDED_UNTIL_EXPLICIT_POLICY_REVIEW"
  },
  CLINICALTRIALS_GOV_V2: {
    datasetId: "CLINICALTRIALS_GOV_V2",
    label: "ClinicalTrials.gov API v2",
    publisher: "U.S. National Library of Medicine",
    accessModel: "OPEN_DATASET",
    officialUrl: "https://clinicaltrials.gov/data-api/api",
    independenceFamily: "US_CLINICAL_TRIAL_REGISTRY",
    intendedSignals: ["PUBLIC_CLINICAL_TRIAL_EXECUTION"],
    scoreUse: "EXCLUDED_UNTIL_EXPLICIT_POLICY_REVIEW"
  },
  NIH_REPORTER_V2: {
    datasetId: "NIH_REPORTER_V2",
    label: "NIH RePORTER API v2",
    publisher: "U.S. National Institutes of Health",
    accessModel: "OPEN_DATASET",
    officialUrl: "https://api.reporter.nih.gov/",
    independenceFamily: "US_FEDERAL_AWARD",
    independenceKeyTemplate: "US_FEDERAL_AWARD:{federal_award_identifier}",
    intendedSignals: ["PUBLIC_FEDERAL_AWARD_CAPITAL"],
    scoreUse: "EXCLUDED_UNTIL_EXPLICIT_POLICY_REVIEW"
  },
  USASPENDING_API: {
    datasetId: "USASPENDING_API",
    label: "USAspending API",
    publisher: "U.S. Department of the Treasury",
    accessModel: "OPEN_DATASET",
    officialUrl: "https://api.usaspending.gov/",
    independenceFamily: "US_FEDERAL_AWARD",
    independenceKeyTemplate: "US_FEDERAL_AWARD:{federal_award_identifier}",
    intendedSignals: ["PUBLIC_FEDERAL_AWARD_CAPITAL"],
    scoreUse: "EXCLUDED_UNTIL_EXPLICIT_POLICY_REVIEW"
  }
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function frozenClone(value) {
  return deepFreeze(clone(value));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function text(value, label, maximum = 4_000) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return normalized;
}

function optionalText(value, label, maximum = 4_000) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (normalized.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return normalized || null;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const seen = new Set();
  return value.flatMap((item) => {
    const normalized = text(item, `${label} item`, 500);
    const key = normalized.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

function exactEnum(value, allowed, label) {
  const normalized = text(value, label, 100);
  if (!allowed.has(normalized)) throw new Error(`${label} ${normalized} is not supported.`);
  return normalized;
}

function timestamp(value, label, { nullable = false } = {}) {
  if (value == null && nullable) return null;
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(value).toISOString();
}

function publicUrl(value, label) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.href;
  } catch {
    throw new Error(`${label} must be a public HTTP(S) URL.`);
  }
}

function assertAllowedKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}.`);
  }
}

const INDICATOR_ROWS = [
  {
    indicatorId: "COMMERCIAL_MILESTONE_MOMENTUM",
    metricId: "COMMERCIAL_MILESTONE_COUNT",
    label: "Public commercial milestones",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 5,
    staleAfterDays: 730,
    referenceRangeCaveat: "The 0–5 display range is a declared milestone-count scale, not an industry percentile or revenue forecast."
  },
  {
    indicatorId: "REGULATORY_MILESTONE_PROGRESS",
    metricId: "REGULATORY_MILESTONE_COUNT",
    label: "Publicly reported regulatory milestones",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 3,
    staleAfterDays: 1_095,
    referenceRangeCaveat: "The scale counts retained milestones only; it is not a legal opinion on compliance or market authorization."
  },
  {
    indicatorId: "REGULATORY_MILESTONE_GAP",
    metricId: "REGULATORY_MILESTONE_GAP_COUNT",
    label: "Declared regulatory-milestone gap proxy",
    subjectType: "STARTUP",
    signalClass: "RISK",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 2,
    staleAfterDays: 1_095,
    referenceRangeCaveat: "A transparent two-milestone demo proxy only; it does not measure total regulatory risk."
  },
  {
    indicatorId: "PUBLIC_NON_DILUTIVE_CAPITAL",
    metricId: "PUBLIC_AWARD_AMOUNT_CHF",
    label: "Public non-dilutive award amount",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "CHF",
    lowerBound: 0,
    upperBound: 250_000,
    staleAfterDays: 3_650,
    referenceRangeCaveat: "The CHF 0–250K range is a declared display bound, not a valuation, financing-quality score, or cross-currency benchmark."
  },
  {
    indicatorId: "ANNUAL_REVENUE_DISCLOSURE",
    metricId: "ANNUAL_REVENUE_CHF",
    label: "Annual revenue amount",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "CHF",
    lowerBound: 0,
    upperBound: 5_000_000,
    staleAfterDays: 730,
    referenceRangeCaveat: "A display range only. Missing financial filings remain unknown and never become zero revenue."
  },
  {
    indicatorId: "FOUNDER_ROLE_CHANGE_RISK",
    metricId: "FOUNDER_ROLE_CHANGE_EVENT_COUNT",
    label: "Founder role-change events",
    subjectType: "FOUNDER_TEAM",
    signalClass: "RISK",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 5,
    staleAfterDays: 730,
    referenceRangeCaveat: "Role changes require an official dated record and human entity review; absence of retained data is unknown."
  },
  {
    indicatorId: "REGULATORY_ADVERSE_EVENT_RISK",
    metricId: "REGULATORY_ADVERSE_EVENT_COUNT",
    label: "Regulatory adverse-event records",
    subjectType: "STARTUP",
    signalClass: "RISK",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 10,
    staleAfterDays: 730,
    referenceRangeCaveat: "Only matched official records may be counted. An unqueried or unmatched register is unknown, not zero adverse events."
  },
  {
    indicatorId: "LEGAL_ENTITY_INACTIVE_RISK",
    metricId: "LEGAL_ENTITY_INACTIVE_FLAG",
    label: "Legal-entity inactive status",
    subjectType: "STARTUP",
    signalClass: "RISK",
    unit: "BINARY",
    lowerBound: 0,
    upperBound: 1,
    staleAfterDays: 365,
    referenceRangeCaveat: "GLEIF status is an identity/register signal, not proof of solvency, operations, or investability."
  },
  {
    indicatorId: "PUBLIC_CLINICAL_TRIAL_EXECUTION",
    metricId: "REGISTERED_CLINICAL_TRIAL_COUNT",
    label: "Matched registered clinical trials",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "COUNT",
    lowerBound: 0,
    upperBound: 10,
    staleAfterDays: 730,
    referenceRangeCaveat: "A matched registration is an execution signal only; it does not establish efficacy, completion, regulatory approval, or commercial traction."
  },
  {
    indicatorId: "PUBLIC_FEDERAL_AWARD_CAPITAL",
    metricId: "FEDERAL_AWARD_AMOUNT_USD",
    label: "Matched U.S. federal award amount",
    subjectType: "STARTUP",
    signalClass: "GROWTH",
    unit: "USD",
    lowerBound: 0,
    upperBound: 5_000_000,
    staleAfterDays: 3_650,
    referenceRangeCaveat: "Award amount is non-equity public support, not revenue, valuation, private financing, or proof of execution. NIH and USAspending overlap is collapsed by federal-award identity."
  }
];

export const OPEN_DATA_INDICATOR_DEFINITIONS = deepFreeze(Object.fromEntries(
  INDICATOR_ROWS.map((row) => [row.indicatorId, {
    ...row,
    normalization: {
      method: "BOUNDED_LINEAR",
      lowerBound: row.lowerBound,
      upperBound: row.upperBound,
      clamp: true,
      formula: "100 × clamp((value − lower bound) ÷ (upper bound − lower bound), 0, 1)"
    }
  }])
));

const DEFINITION_BY_METRIC = new Map(
  Object.values(OPEN_DATA_INDICATOR_DEFINITIONS).map((definition) => [definition.metricId, definition])
);

export const OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS = deepFreeze([
  "ENTITY_MATCH_AND_CONFLICTS_REVIEWED",
  "SOURCE_PROVENANCE_AND_LICENSE_REVIEWED",
  "MISSING_VALUES_REMAIN_UNKNOWN",
  "CORE_SCORE_REQUIRES_SEPARATE_VERSIONED_IMPLEMENTATION"
]);

export const OPEN_DATA_SIGNAL_INTEGRATION_GUIDANCE = deepFreeze({
  defaultUse: "SEPARATE_DILIGENCE_AND_MONITORING_LAYER",
  defaultDecisionImpact: "NONE",
  coreOpportunityScoreIntegration: "PROHIBITED_WITHOUT_EXPLICIT_POLICY_REVIEW_AND_SEPARATE_VERSIONED_IMPLEMENTATION",
  requiredSequence: [
    "Resolve the entity against the source record and inspect conflicts.",
    "Review source provenance, access terms, record dates, and missing coverage.",
    "Approve named indicators and their reference ranges under a versioned policy.",
    "Implement and validate any core-score change in a separate versioned scoring module."
  ],
  prohibitedShortcuts: [
    "Do not treat a missing record as zero growth, zero risk, or a negative founder judgment.",
    "Do not average growth and risk indicators into an investment score.",
    "Do not infer founder age, worth, integrity, or protected traits from public records.",
    "Do not let repository popularity, press volume, or record count bypass evidence review."
  ]
});

function normalizeEntity(candidate) {
  assertAllowedKeys(candidate, new Set(["entityId", "entityType", "canonicalName", "aliases", "founderNames"]), "Entity");
  return {
    entityId: text(candidate.entityId, "Entity ID", 300),
    entityType: exactEnum(candidate.entityType, new Set(["STARTUP"]), "Entity type"),
    canonicalName: text(candidate.canonicalName, "Canonical entity name", 500),
    aliases: stringArray(candidate.aliases || [], "Entity aliases"),
    founderNames: stringArray(candidate.founderNames || [], "Founder names")
  };
}

function normalizeSource(candidate, observationId, asOf) {
  assertAllowedKeys(candidate, new Set([
    "sourceId", "publisher", "datasetId", "datasetName", "datasetRecordId", "independenceFamily", "recordTitle", "recordUrl",
    "accessModel", "sourceType", "officiality", "license", "publishedAt", "capturedAt",
    "repositoryEvidenceId", "verificationStatus"
  ]), `Source for ${observationId}`);
  const capturedAt = timestamp(candidate.capturedAt, `Source capturedAt for ${observationId}`);
  const publishedAt = timestamp(candidate.publishedAt, `Source publishedAt for ${observationId}`, { nullable: true });
  if (Date.parse(capturedAt) > Date.parse(asOf)) throw new Error(`Source capturedAt for ${observationId} cannot be after snapshot asOf.`);
  if (publishedAt && Date.parse(publishedAt) > Date.parse(capturedAt)) {
    throw new Error(`Source publishedAt for ${observationId} cannot be after capture time.`);
  }
  return {
    sourceId: text(candidate.sourceId, `Source ID for ${observationId}`, 300),
    publisher: text(candidate.publisher, `Source publisher for ${observationId}`, 500),
    datasetId: text(candidate.datasetId, `Dataset ID for ${observationId}`, 300),
    datasetName: text(candidate.datasetName, `Dataset or record-set name for ${observationId}`, 1_000),
    datasetRecordId: optionalText(candidate.datasetRecordId, `Dataset record ID for ${observationId}`, 1_000),
    independenceFamily: text(candidate.independenceFamily, `Independence family for ${observationId}`, 300),
    recordTitle: text(candidate.recordTitle, `Source record title for ${observationId}`, 1_000),
    recordUrl: publicUrl(candidate.recordUrl, `Source record URL for ${observationId}`),
    accessModel: exactEnum(candidate.accessModel, ACCESS_MODELS, `Source access model for ${observationId}`),
    sourceType: text(candidate.sourceType, `Source type for ${observationId}`, 200),
    officiality: text(candidate.officiality, `Source officiality for ${observationId}`, 200),
    license: text(candidate.license, `Source license for ${observationId}`, 500),
    publishedAt,
    capturedAt,
    repositoryEvidenceId: optionalText(candidate.repositoryEvidenceId, `Repository evidence ID for ${observationId}`, 300),
    verificationStatus: text(candidate.verificationStatus, `Verification status for ${observationId}`, 200)
  };
}

function normalizeEntityMatch(candidate, observationId, missing) {
  assertAllowedKeys(candidate, new Set([
    "confidence", "method", "matchedFields", "conflictingFields", "humanReviewed"
  ]), `Entity match for ${observationId}`);
  const confidence = candidate.confidence;
  if (confidence == null) {
    if (!missing) throw new Error(`Entity-match confidence for ${observationId} is required for a known value.`);
  } else if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Entity-match confidence for ${observationId} must be from 0 to 1 or null for missing data.`);
  }
  return {
    confidence: confidence == null ? null : confidence,
    method: text(candidate.method, `Entity-match method for ${observationId}`, 500),
    matchedFields: stringArray(candidate.matchedFields || [], `Entity-match fields for ${observationId}`),
    conflictingFields: stringArray(candidate.conflictingFields || [], `Entity-match conflicts for ${observationId}`),
    humanReviewed: candidate.humanReviewed === true
  };
}

function freshness(observedAt, asOf, staleAfterDays) {
  if (!observedAt) {
    return {
      score: null,
      ageDays: null,
      status: "UNKNOWN",
      staleAfterDays,
      formula: "100 × clamp(1 − age days ÷ stale-after days, 0, 1)"
    };
  }
  const ageDays = (Date.parse(asOf) - Date.parse(observedAt)) / MS_PER_DAY;
  if (ageDays < 0) throw new Error("Observation time cannot be after snapshot asOf.");
  const score = round(clamp(100 * (1 - ageDays / staleAfterDays), 0, 100));
  return {
    score,
    ageDays: round(ageDays),
    status: score >= 67 ? "CURRENT" : score >= 34 ? "AGING" : "STALE",
    staleAfterDays,
    formula: "100 × clamp(1 − age days ÷ stale-after days, 0, 1)"
  };
}

function normalizedMagnitude(value, definition) {
  if (value == null) return null;
  const range = definition.normalization.upperBound - definition.normalization.lowerBound;
  const ratio = (value - definition.normalization.lowerBound) / range;
  return round(clamp(ratio, 0, 1) * 100);
}

function normalizeObservation(candidate, asOf) {
  assertAllowedKeys(candidate, new Set([
    "observationId", "metricId", "subjectType", "observationKind", "observedAt", "timePrecision",
    "value", "unit", "source", "independenceKey", "entityMatch", "missing", "note", "derivation"
  ]), "Open-data observation");
  const observationId = text(candidate.observationId, "Observation ID", 300);
  const definition = DEFINITION_BY_METRIC.get(text(candidate.metricId, `Metric ID for ${observationId}`, 300));
  if (!definition) throw new Error(`Metric ID for ${observationId} is not supported.`);
  const subjectType = exactEnum(candidate.subjectType, SUBJECT_TYPES, `Subject type for ${observationId}`);
  if (subjectType !== definition.subjectType) throw new Error(`Subject type for ${observationId} does not match its indicator definition.`);
  const observationKind = exactEnum(candidate.observationKind, OBSERVATION_KINDS, `Observation kind for ${observationId}`);
  const missing = candidate.value == null;
  if (missing !== (observationKind === "MISSING")) {
    throw new Error(`${observationId} must use MISSING exactly when its value is null.`);
  }
  if (!missing && !Number.isFinite(candidate.value)) throw new Error(`Value for ${observationId} must be finite or null.`);
  const unit = text(candidate.unit, `Unit for ${observationId}`, 100);
  if (unit !== definition.unit) throw new Error(`Unit for ${observationId} must be ${definition.unit}.`);
  const observedAt = timestamp(candidate.observedAt, `Observation time for ${observationId}`, { nullable: missing });
  if (observedAt && Date.parse(observedAt) > Date.parse(asOf)) throw new Error(`Observation time for ${observationId} cannot be after snapshot asOf.`);
  const missingRecord = missing
    ? (() => {
        assertAllowedKeys(candidate.missing, new Set(["reasonCode", "note", "datasetsAttempted"]), `Missing-data record for ${observationId}`);
        return {
          reasonCode: text(candidate.missing.reasonCode, `Missing-data reason for ${observationId}`, 200),
          note: text(candidate.missing.note, `Missing-data note for ${observationId}`, 2_000),
          datasetsAttempted: stringArray(candidate.missing.datasetsAttempted || [], `Datasets attempted for ${observationId}`)
        };
      })()
    : null;
  if (!missing && candidate.missing != null) throw new Error(`${observationId} cannot carry missing-data metadata with a known value.`);
  if (!missing && candidate.source == null) throw new Error(`Source for ${observationId} is required for a known value.`);
  if (missing && candidate.source != null) throw new Error(`Missing observation ${observationId} cannot imply a source record that was not retained.`);
  const independenceKey = missing
    ? null
    : text(candidate.independenceKey, `Independence key for ${observationId}`, 1_000);
  if (missing && candidate.independenceKey != null) throw new Error(`Missing observation ${observationId} cannot carry an independence key.`);
  if (!candidate.entityMatch) throw new Error(`Entity match for ${observationId} is required.`);
  const derivation = candidate.derivation == null
    ? null
    : (() => {
        assertAllowedKeys(candidate.derivation, new Set(["formula", "inputObservationIds", "caveat"]), `Derivation for ${observationId}`);
        return {
          formula: text(candidate.derivation.formula, `Derivation formula for ${observationId}`, 2_000),
          inputObservationIds: stringArray(candidate.derivation.inputObservationIds || [], `Derivation inputs for ${observationId}`),
          caveat: text(candidate.derivation.caveat, `Derivation caveat for ${observationId}`, 2_000)
        };
      })();
  if ((observationKind === "TRANSPARENT_DERIVATION") !== Boolean(derivation)) {
    throw new Error(`${observationId} must carry derivation metadata exactly when it is a transparent derivation.`);
  }
  return {
    observationId,
    metricId: definition.metricId,
    indicatorId: definition.indicatorId,
    subjectType,
    signalClass: definition.signalClass,
    observationKind,
    observedAt,
    timePrecision: exactEnum(candidate.timePrecision, TIME_PRECISIONS, `Time precision for ${observationId}`),
    value: missing ? null : candidate.value,
    unit,
    normalizedValue: normalizedMagnitude(candidate.value, definition),
    source: missing ? null : normalizeSource(candidate.source, observationId, asOf),
    independenceKey,
    entityMatch: normalizeEntityMatch(candidate.entityMatch, observationId, missing),
    freshness: freshness(observedAt, asOf, definition.staleAfterDays),
    missing: missingRecord,
    note: optionalText(candidate.note, `Observation note for ${observationId}`),
    derivation
  };
}

function collapseOverlappingObservations(observations) {
  const selected = new Map();
  const groups = new Map();
  const missing = [];
  for (const observation of observations) {
    if (observation.value == null) {
      missing.push(observation);
      continue;
    }
    const key = [
      observation.metricId,
      observation.source.independenceFamily,
      observation.independenceKey
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(observation);
    const prior = selected.get(key);
    const priorConfidence = prior?.entityMatch.confidence ?? -1;
    const currentConfidence = observation.entityMatch.confidence ?? -1;
    const currentCapturedAt = Date.parse(observation.source.capturedAt);
    const priorCapturedAt = prior ? Date.parse(prior.source.capturedAt) : -1;
    if (
      !prior ||
      currentConfidence > priorConfidence ||
      (currentConfidence === priorConfidence && currentCapturedAt > priorCapturedAt) ||
      (currentConfidence === priorConfidence && currentCapturedAt === priorCapturedAt && observation.observationId < prior.observationId)
    ) {
      selected.set(key, observation);
    }
  }
  return {
    observations: [...selected.values(), ...missing],
    groups: [...groups.entries()].map(([groupKey, members]) => ({
      groupKey,
      metricId: members[0].metricId,
      independenceFamily: members[0].source.independenceFamily,
      independenceKey: members[0].independenceKey,
      selectedObservationId: selected.get(groupKey).observationId,
      observationIds: members.map((item) => item.observationId).sort(),
      datasetIds: [...new Set(members.map((item) => item.source.datasetId))].sort(),
      reportedValues: [...new Set(members.map((item) => item.value))].sort((left, right) => left - right),
      conflictingValues: new Set(members.map((item) => item.value)).size > 1
    }))
  };
}

function directionFor(knownPoints, signalClass) {
  if (knownPoints.length < 2) {
    return {
      direction: "UNKNOWN",
      rawDelta: null,
      normalizedDelta: null,
      fromObservationId: null,
      toObservationId: knownPoints.at(-1)?.observationId || null,
      meaning: "At least two dated known values are required for a direction."
    };
  }
  const previous = knownPoints.at(-2);
  const latest = knownPoints.at(-1);
  const rawDelta = round(latest.value - previous.value, 4);
  const normalizedDelta = round(latest.normalizedValue - previous.normalizedValue, 4);
  const direction = rawDelta > 0 ? "INCREASING" : rawDelta < 0 ? "DECREASING" : "STABLE";
  const noun = signalClass === "RISK" ? "risk proxy" : "growth proxy";
  return {
    direction,
    rawDelta,
    normalizedDelta,
    fromObservationId: previous.observationId,
    toObservationId: latest.observationId,
    meaning: `The retained ${noun} is ${direction.toLowerCase()}; this is not a forecast.`
  };
}

function orderedTimeline(items) {
  return [...items].sort((left, right) => {
    const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.POSITIVE_INFINITY;
    const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.POSITIVE_INFINITY;
    return leftTime - rightTime || left.observationId.localeCompare(right.observationId);
  });
}

function buildIndicator(definition, observations) {
  const relevant = orderedTimeline(observations.filter((item) => item.metricId === definition.metricId));
  const known = relevant.filter((item) => item.value != null);
  const latest = known.at(-1) || null;
  const trend = directionFor(known, definition.signalClass);
  return {
    indicatorId: definition.indicatorId,
    metricId: definition.metricId,
    label: definition.label,
    subjectType: definition.subjectType,
    signalClass: definition.signalClass,
    status: latest ? "OBSERVED" : "UNKNOWN",
    rawValue: latest?.value ?? null,
    unit: definition.unit,
    normalizedValue: latest?.normalizedValue ?? null,
    normalizedScaleMeaning: definition.signalClass === "RISK"
      ? "0–100 magnitude of this named risk proxy within the declared bounds; higher means more of the proxy."
      : "0–100 magnitude of this named growth proxy within the declared bounds; higher means more of the proxy.",
    normalization: frozenClone(definition.normalization),
    referenceRangeCaveat: definition.referenceRangeCaveat,
    latestObservationId: latest?.observationId || null,
    latestObservedAt: latest?.observedAt || null,
    freshness: latest ? frozenClone(latest.freshness) : frozenClone(freshness(null, new Date(0).toISOString(), definition.staleAfterDays)),
    entityMatchConfidence: latest?.entityMatch.confidence ?? null,
    trend,
    knownPointCount: known.length,
    unknownPointCount: relevant.length - known.length,
    observationIds: relevant.map((item) => item.observationId),
    missingReasonCodes: relevant.flatMap((item) => item.missing ? [item.missing.reasonCode] : []),
    canAffectOpportunityScore: false
  };
}

export function buildOpenDataSignalSnapshot(candidate) {
  assertAllowedKeys(candidate, new Set(["snapshotId", "asOf", "entity", "observations"]), "Open-data signal snapshot input");
  const snapshotId = text(candidate.snapshotId, "Snapshot ID", 300);
  const asOf = timestamp(candidate.asOf, "Snapshot asOf");
  const entity = normalizeEntity(candidate.entity);
  if (!Array.isArray(candidate.observations)) throw new Error("Open-data observations must be an array.");
  const observations = candidate.observations.map((item) => normalizeObservation(item, asOf));
  const ids = observations.map((item) => item.observationId);
  if (new Set(ids).size !== ids.length) throw new Error("Open-data observation IDs must be unique.");
  const collapsed = collapseOverlappingObservations(observations);
  const signalObservations = collapsed.observations;
  const indicators = Object.values(OPEN_DATA_INDICATOR_DEFINITIONS)
    .map((definition) => buildIndicator(definition, signalObservations));
  const knownObservations = observations.filter((item) => item.value != null);
  const sourceIds = new Set(knownObservations.map((item) => item.source.sourceId));
  const knownIndicators = indicators.filter((item) => item.status === "OBSERVED");
  return deepFreeze({
    schemaVersion: OPEN_DATA_SIGNAL_SCHEMA_VERSION,
    snapshotId,
    asOf,
    entity,
    observations,
    timeSeries: indicators.map((indicator) => ({
      seriesId: `SERIES-${indicator.metricId}`,
      metricId: indicator.metricId,
      signalClass: indicator.signalClass,
      unit: indicator.unit,
      direction: frozenClone(indicator.trend),
      points: orderedTimeline(signalObservations.filter((item) => item.metricId === indicator.metricId))
        .map((item) => ({
          observationId: item.observationId,
          observedAt: item.observedAt,
          value: item.value,
          normalizedValue: item.normalizedValue,
          freshnessScore: item.freshness.score,
          entityMatchConfidence: item.entityMatch.confidence,
          sourceId: item.source?.sourceId || null,
          missingReasonCode: item.missing?.reasonCode || null
        }))
    })),
    indicators,
    deduplication: {
      method: "METRIC_PLUS_INDEPENDENCE_FAMILY_PLUS_INDEPENDENCE_KEY",
      rawKnownObservationCount: knownObservations.length,
      independentKnownObservationCount: signalObservations.filter((item) => item.value != null).length,
      overlappingObservationsCollapsed: knownObservations.length - signalObservations.filter((item) => item.value != null).length,
      groups: collapsed.groups
    },
    coverage: {
      observationCount: observations.length,
      knownObservationCount: knownObservations.length,
      unknownObservationCount: observations.length - knownObservations.length,
      indicatorCount: indicators.length,
      knownIndicatorCount: knownIndicators.length,
      unknownIndicatorCount: indicators.length - knownIndicators.length,
      distinctSourceCount: sourceIds.size,
      distinctIndependenceFamilyCount: new Set(knownObservations.map((item) => item.source.independenceFamily)).size,
      openDatasetObservationCount: knownObservations.filter((item) => item.source.accessModel === "OPEN_DATASET").length,
      publicRegisterObservationCount: knownObservations.filter((item) => item.source.accessModel === "PUBLIC_REGISTER").length,
      publicRecordObservationCount: knownObservations.filter((item) => item.source.accessModel === "PUBLIC_RECORD").length
    },
    boundaries: {
      missingMeansUnknown: true,
      canAffectOpportunityScore: false,
      canAffectCheckSizing: false,
      producesSuccessProbability: false,
      founderTraitInferenceAllowed: false,
      policyReviewRequiredForAnyDecisionImpact: true
    },
    integration: {
      state: "ISOLATED_OBSERVATIONAL_LAYER",
      opportunityScoreInput: null,
      policyReview: null,
      guidanceVersion: OPEN_DATA_SIGNAL_SCHEMA_VERSION
    },
    interpretation: "Growth and risk indicators summarize named public-record observations within declared bounds. They are not an Opportunity score, investment recommendation, success forecast, or founder judgment."
  });
}

export function createOpenDataSignalPolicyReview(snapshot, candidate) {
  if (snapshot?.schemaVersion !== OPEN_DATA_SIGNAL_SCHEMA_VERSION) throw new Error("A valid open-data signal snapshot is required.");
  assertAllowedKeys(candidate, new Set([
    "reviewId", "reviewer", "reviewedAt", "policyVersion", "rationale", "targetUse",
    "authorizedIndicatorIds", "acknowledgements"
  ]), "Open-data signal policy review");
  const authorizedIndicatorIds = stringArray(candidate.authorizedIndicatorIds, "Authorized indicator IDs");
  if (!authorizedIndicatorIds.length) throw new Error("At least one indicator must be authorized for policy review.");
  const knownIds = new Set(snapshot.indicators.map((item) => item.indicatorId));
  const unknownIds = authorizedIndicatorIds.filter((id) => !knownIds.has(id));
  if (unknownIds.length) throw new Error(`Policy review references unknown indicators: ${unknownIds.join(", ")}.`);
  const acknowledgements = stringArray(candidate.acknowledgements, "Policy-review acknowledgements");
  const acknowledgementSet = new Set(acknowledgements);
  const missing = OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS.filter((code) => !acknowledgementSet.has(code));
  if (missing.length) throw new Error(`Policy review is missing acknowledgements: ${missing.join(", ")}.`);
  const reviewedAt = timestamp(candidate.reviewedAt, "Policy review time");
  if (Date.parse(reviewedAt) < Date.parse(snapshot.asOf)) throw new Error("Policy review cannot predate the signal snapshot.");
  const targetUse = exactEnum(candidate.targetUse, REVIEW_TARGETS, "Policy-review target use");
  return deepFreeze({
    schemaVersion: OPEN_DATA_POLICY_REVIEW_SCHEMA_VERSION,
    reviewId: text(candidate.reviewId, "Policy review ID", 300),
    snapshotId: snapshot.snapshotId,
    reviewer: text(candidate.reviewer, "Policy reviewer", 300),
    reviewedAt,
    policyVersion: text(candidate.policyVersion, "Policy version", 300),
    rationale: text(candidate.rationale, "Policy-review rationale", 4_000),
    targetUse,
    authorizedIndicatorIds,
    acknowledgements: [...OPEN_DATA_POLICY_REVIEW_ACKNOWLEDGEMENTS],
    status: targetUse === "VERSIONED_SCORE_POLICY_CANDIDATE"
      ? "POLICY_REVIEWED_CANDIDATE_NOT_APPLIED"
      : "POLICY_REVIEWED_FOR_DILIGENCE",
    integrationBoundary: {
      eligibleForExternalPolicyIntegration: targetUse === "VERSIONED_SCORE_POLICY_CANDIDATE",
      coreOpportunityScoreModified: false,
      canAffectOpportunityScoreWithinThisModule: false,
      requiresSeparateVersionedScoringImplementation: targetUse === "VERSIONED_SCORE_POLICY_CANDIDATE"
    }
  });
}

const VENTURELAB_SOURCE = {
  sourceId: "SOURCE-EMOVO-VENTURELAB-PROFILE",
  publisher: "Venturelab",
  datasetId: "PUBLIC_RECORD_VENTURELAB_PROFILE",
  datasetName: "Public company profile and milestone ledger",
  datasetRecordId: "profil_id=24256",
  independenceFamily: "VENTURELAB_PUBLIC_RECORD",
  recordTitle: "Venturelab profile and dated commercial milestone ledger",
  recordUrl: "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256",
  accessModel: "PUBLIC_RECORD",
  sourceType: "ECOSYSTEM_PROGRAMME_RECORD",
  officiality: "PUBLIC_ECOSYSTEM_PROGRAMME",
  license: "NOT_STATED",
  publishedAt: null,
  capturedAt: OPEN_DATA_SIGNAL_DEMO_CAPTURED_AT,
  repositoryEvidenceId: "DEMO-EMOVO-VENTURELAB",
  verificationStatus: "REVIEWED_IN_FROZEN_DEMO"
};

const VENTUREKICK_SOURCE = {
  sourceId: "SOURCE-EMOVO-VENTUREKICK-AWARD",
  publisher: "Venture Kick",
  datasetId: "PUBLIC_RECORD_VENTURE_KICK_AWARDS",
  datasetName: "Public award announcements",
  datasetRecordId: "EMOVO-CHF-150000-2020-05-14",
  independenceFamily: "VENTURE_KICK_PUBLIC_RECORD",
  recordTitle: "Venture Kick award and product-development evidence",
  recordUrl: "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000",
  accessModel: "PUBLIC_RECORD",
  sourceType: "PUBLIC_AWARD_PROGRAMME_RECORD",
  officiality: "PROGRAMME_PRIMARY_RECORD",
  license: "NOT_STATED",
  publishedAt: "2020-05-14T00:00:00.000Z",
  capturedAt: OPEN_DATA_SIGNAL_DEMO_CAPTURED_AT,
  repositoryEvidenceId: "DEMO-EMOVO-VENTUREKICK",
  verificationStatus: "REVIEWED_IN_FROZEN_DEMO"
};

const HIGH_MATCH = {
  confidence: 0.98,
  method: "EXACT_COMPANY_NAME_AND_PRODUCT_MILESTONE_CONTEXT",
  matchedFields: ["company_name", "product_context"],
  conflictingFields: [],
  humanReviewed: true
};

function reportedObservation(observationId, metricId, value, observedAt, timePrecision, source, note) {
  const definition = DEFINITION_BY_METRIC.get(metricId);
  return {
    observationId,
    metricId,
    subjectType: definition.subjectType,
    observationKind: "SOURCE_REPORTED",
    observedAt,
    timePrecision,
    value,
    unit: definition.unit,
    source,
    independenceKey: observationId,
    entityMatch: HIGH_MATCH,
    missing: null,
    note,
    derivation: null
  };
}

function derivedObservation(observationId, metricId, value, observedAt, inputObservationId) {
  const definition = DEFINITION_BY_METRIC.get(metricId);
  return {
    observationId,
    metricId,
    subjectType: definition.subjectType,
    observationKind: "TRANSPARENT_DERIVATION",
    observedAt,
    timePrecision: "MONTH",
    value,
    unit: definition.unit,
    source: VENTURELAB_SOURCE,
    independenceKey: observationId,
    entityMatch: HIGH_MATCH,
    missing: null,
    note: "Derived only from the two explicitly retained public milestones: ISO 13485 certification and CE marking.",
    derivation: {
      formula: "2 declared target milestones − cumulative retained completed milestones",
      inputObservationIds: [inputObservationId],
      caveat: "This narrow proxy does not measure total regulatory, clinical, legal, or reimbursement risk."
    }
  };
}

function missingObservation(observationId, metricId, reasonCode, note) {
  const definition = DEFINITION_BY_METRIC.get(metricId);
  return {
    observationId,
    metricId,
    subjectType: definition.subjectType,
    observationKind: "MISSING",
    observedAt: null,
    timePrecision: "UNKNOWN",
    value: null,
    unit: definition.unit,
    source: null,
    independenceKey: null,
    entityMatch: {
      confidence: null,
      method: "NOT_ATTEMPTED_OR_NO_MATCH_RETAINED",
      matchedFields: [],
      conflictingFields: [],
      humanReviewed: false
    },
    missing: { reasonCode, note, datasetsAttempted: [] },
    note: null,
    derivation: null
  };
}

const EMOVO_DEMO_OBSERVATIONS = [
  reportedObservation("OBS-EMOVO-COMMERCIAL-2021", "COMMERCIAL_MILESTONE_COUNT", 1, "2021-12-31T00:00:00.000Z", "YEAR", VENTURELAB_SOURCE, "Venturelab lists a five-figure sale in 2021."),
  reportedObservation("OBS-EMOVO-COMMERCIAL-2025-12", "COMMERCIAL_MILESTONE_COUNT", 2, "2025-12-01T00:00:00.000Z", "MONTH", VENTURELAB_SOURCE, "Venturelab lists first batch sales in December 2025."),
  reportedObservation("OBS-EMOVO-COMMERCIAL-2026-05", "COMMERCIAL_MILESTONE_COUNT", 3, "2026-05-01T00:00:00.000Z", "MONTH", VENTURELAB_SOURCE, "Venturelab lists second batch sales in May 2026."),
  reportedObservation("OBS-EMOVO-REGULATORY-2021", "REGULATORY_MILESTONE_COUNT", 1, "2021-12-31T00:00:00.000Z", "YEAR", VENTURELAB_SOURCE, "Venturelab lists ISO 13485 certification in 2021."),
  reportedObservation("OBS-EMOVO-REGULATORY-2025-10", "REGULATORY_MILESTONE_COUNT", 2, "2025-10-01T00:00:00.000Z", "MONTH", VENTURELAB_SOURCE, "Venturelab lists CE marking in October 2025."),
  derivedObservation("OBS-EMOVO-REGULATORY-GAP-2021", "REGULATORY_MILESTONE_GAP_COUNT", 1, "2021-12-31T00:00:00.000Z", "OBS-EMOVO-REGULATORY-2021"),
  derivedObservation("OBS-EMOVO-REGULATORY-GAP-2025", "REGULATORY_MILESTONE_GAP_COUNT", 0, "2025-10-01T00:00:00.000Z", "OBS-EMOVO-REGULATORY-2025-10"),
  reportedObservation("OBS-EMOVO-AWARD-2020", "PUBLIC_AWARD_AMOUNT_CHF", 150_000, "2020-05-14T00:00:00.000Z", "DAY", VENTUREKICK_SOURCE, "Venture Kick publicly reported a CHF 150,000 award in May 2020."),
  missingObservation("OBS-EMOVO-REVENUE-UNKNOWN", "ANNUAL_REVENUE_CHF", "NO_OFFICIAL_FINANCIAL_RECORD_RETAINED", "The cited record says revenue is being generated but gives no annual amount; it must not be encoded as CHF 0."),
  missingObservation("OBS-EMOVO-FOUNDER-ROLE-CHANGES-UNKNOWN", "FOUNDER_ROLE_CHANGE_EVENT_COUNT", "NO_DATED_OFFICIAL_ROLE_HISTORY_RETAINED", "The current team page identifies founders, but no dated official role-change series is retained."),
  missingObservation("OBS-EMOVO-ADVERSE-EVENTS-UNKNOWN", "REGULATORY_ADVERSE_EVENT_COUNT", "REGULATORY_REGISTER_NOT_QUERIED", "No matched official adverse-event register was queried for this frozen demo; the count is unknown, not zero."),
  missingObservation("OBS-EMOVO-GLEIF-STATUS-UNKNOWN", "LEGAL_ENTITY_INACTIVE_FLAG", "GLEIF_LEI_NOT_QUERIED", "No GLEIF LEI record was retained for this frozen demo; legal-entity status is unknown."),
  missingObservation("OBS-EMOVO-CLINICAL-TRIALS-UNKNOWN", "REGISTERED_CLINICAL_TRIAL_COUNT", "CLINICALTRIALS_GOV_V2_NOT_QUERIED", "No sponsor-matched ClinicalTrials.gov v2 result was retained; registered trial execution is unknown."),
  missingObservation("OBS-EMOVO-FEDERAL-AWARDS-UNKNOWN", "FEDERAL_AWARD_AMOUNT_USD", "US_FEDERAL_AWARD_DATASETS_NOT_QUERIED", "Neither NIH RePORTER v2 nor USAspending was queried for a matched U.S. federal award in this frozen demo; the amount is unknown, not USD 0.")
];

export const EMOVO_OPEN_DATA_SIGNAL_DEMO_V1 = buildOpenDataSignalSnapshot({
  snapshotId: "OPEN-DATA-EMOVO-2026-07-19",
  asOf: OPEN_DATA_SIGNAL_DEMO_CAPTURED_AT,
  entity: {
    entityId: "STARTUP-EMOVO-CARE",
    entityType: "STARTUP",
    canonicalName: "Emovo Care",
    aliases: ["Emovo"],
    founderNames: ["Luca Randazzo", "Iselin Frøybu"]
  },
  observations: EMOVO_DEMO_OBSERVATIONS
});
