import {
  TREND_COMPANY_DISCOVERY_CATALOG,
  TREND_COMPANY_DISCOVERY_LIMITS,
  buildTrendCompanyDiscoveryPlan,
  validateTrendCompanyDiscoveryInput
} from "./trend-company-discovery-v1.mjs";
import { TRENDS_SNAPSHOT_V1 } from "./trends-snapshot-v1.mjs";

export const SAVED_TRENDS_VERSION = "proofline.saved-trends.v1";

export const SAVED_TRENDS_LIMITS = Object.freeze({
  maxActiveTrends: 24,
  maxEvents: 500,
  maxObservationsPerWatch: 24,
  maxSerializedBytes: 512 * 1024,
  maxProfileIdCharacters: 160,
  maxActorCharacters: 160,
  maxSnapshotIdCharacters: 200,
  maxTextCharacters: 4_000,
  maxArrayItems: 20
});

export const SAVED_TRENDS_BOUNDARIES = Object.freeze({
  canAffectStartupScore: false,
  producesInvestmentDecision: false,
  producesProbabilityForecast: false,
  infersTrendDirection: false,
  inventsHistoricalObservations: false,
  persistenceScope: "USER_PROFILE_LOCAL_OR_SESSION",
  humanReviewRequired: true
});

export const SAVED_TREND_METRIC_DEFINITIONS = Object.freeze({
  sourceFreshness: Object.freeze({
    unit: "0_TO_100_SOURCE_FRESHNESS_COMPONENT",
    nullMeaning: "NOT_SAMPLED_OR_NOT_REPORTED"
  }),
  githubRepositoryCount: Object.freeze({
    unit: "PUBLIC_REPOSITORY_COUNT",
    nullMeaning: "NOT_SAMPLED_OR_NOT_REPORTED",
    zeroMeaning: "EXPLICITLY_SAMPLED_ZERO"
  }),
  githubStars: Object.freeze({
    unit: "SUM_OF_REPORTED_PUBLIC_REPOSITORY_STARS",
    nullMeaning: "NOT_SAMPLED_OR_NOT_REPORTED",
    zeroMeaning: "EXPLICITLY_SAMPLED_ZERO"
  }),
  githubForks: Object.freeze({
    unit: "SUM_OF_REPORTED_PUBLIC_REPOSITORY_FORKS",
    nullMeaning: "NOT_SAMPLED_OR_NOT_REPORTED",
    zeroMeaning: "EXPLICITLY_SAMPLED_ZERO"
  }),
  companySignalCount: Object.freeze({
    unit: "RETAINED_COMPANY_SIGNAL_COUNT",
    nullMeaning: "NOT_SAMPLED_OR_NOT_REPORTED",
    zeroMeaning: "EXPLICITLY_SAMPLED_ZERO"
  })
});

const CATALOG_BY_ID = new Map(TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => [trend.id, trend]));
const PROFILE_KEYS = new Set(["schemaVersion", "profileId", "createdAt", "updatedAt", "events", "boundaries"]);
const CREATE_KEYS = new Set(["profileId", "createdAt"]);
const SAVE_KEYS = new Set(["trendId", "actor", "occurredAt"]);
const REMOVE_KEYS = new Set(["trendId", "actor", "occurredAt"]);
const OBSERVATION_KEYS = new Set(["trendId", "actor", "occurredAt", "currentSnapshot"]);
const COMPARE_KEYS = new Set(["trendId", "currentSnapshot"]);
const SEARCH_KEYS = new Set(["trendIds", "region", "sector"]);
const OBSERVATION_SNAPSHOT_INPUT_KEYS = new Set(["snapshotId", "capturedAt", "provider", "trend", "metrics"]);
const SNAPSHOT_KEYS = new Set(["snapshotId", "capturedAt", "provider", "trend", "sourceContext", "metrics"]);
const METRIC_KEYS = new Set([
  "sourceFreshness",
  "githubRepositoryCount",
  "githubStars",
  "githubForks",
  "companySignalCount"
]);
const SOURCE_CONTEXT_KEYS = new Set(["title", "searchLabel", "url", "host", "keyFeatures", "treatment"]);
const TREND_KEYS = new Set([
  "id",
  "evidenceId",
  "title",
  "searchLabel",
  "summary",
  "sourceUrl",
  "sourceHost",
  "sourceRole",
  "publishedDate",
  "queryKind",
  "keyFeatures",
  "sectors",
  "regions",
  "githubTerms",
  "signalScore",
  "verificationStatus"
]);
const SCORE_KEYS = new Set(["value", "label", "components", "formula", "purpose", "canAffectInvestmentScore"]);
const SCORE_COMPONENT_KEYS = new Set(["sourceAuthority", "freshness", "commercializationRelevance"]);
const SAVE_EVENT_KEYS = new Set([
  "eventId", "type", "trendId", "watchId", "actor", "occurredAt", "baselineSnapshot", "boundaries"
]);
const REMOVE_EVENT_KEYS = new Set([
  "eventId", "type", "trendId", "watchId", "actor", "occurredAt", "boundaries"
]);
const OBSERVATION_EVENT_KEYS = new Set([
  "eventId", "type", "trendId", "watchId", "actor", "occurredAt", "observationSnapshot", "boundaries"
]);
const VERIFICATION_STATES = new Set(["UNREVIEWED", "REVIEWED", "VERIFIED"]);

export class SavedTrendsInputError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "SavedTrendsInputError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(message, code, details) {
  throw new SavedTrendsInputError(message, code, details);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertObject(value, allowedKeys, label) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object.`, "INVALID_SHAPE");
  const unknownFields = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownFields.length) {
    fail(
      `${label} contains unsupported fields: ${unknownFields.join(", ")}.`,
      "UNKNOWN_FIELD",
      { unknownFields: Object.freeze([...unknownFields]) }
    );
  }
}

function requiredLine(value, label, maximum) {
  if (typeof value !== "string") fail(`${label} must be text.`, "INVALID_TEXT");
  const text = value.trim();
  if (!text) fail(`${label} is required.`, "INVALID_TEXT");
  if (text.length > maximum) fail(`${label} must be ${maximum} characters or fewer.`, "INPUT_LIMIT_EXCEEDED");
  if (/[\u0000-\u001f\u007f]/.test(text)) fail(`${label} must be a single line of text.`, "INVALID_TEXT");
  return text;
}

function optionalLine(value, label, maximum) {
  if (value == null) return null;
  return requiredLine(value, label, maximum);
}

function isoTimestamp(value, label) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be a valid timestamp.`, "INVALID_TIMESTAMP");
  }
  return new Date(value).toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function exactBoundaries(value) {
  if (!isPlainObject(value)) fail("Saved-trend safety boundaries are invalid.", "INVALID_PROFILE_INTEGRITY");
  const expectedKeys = Object.keys(SAVED_TRENDS_BOUNDARIES);
  if (
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => value[key] !== SAVED_TRENDS_BOUNDARIES[key])
  ) {
    fail("Saved-trend safety boundaries are invalid.", "INVALID_PROFILE_INTEGRITY");
  }
  return SAVED_TRENDS_BOUNDARIES;
}

function publicUrl(value, label) {
  const text = requiredLine(value, label, 2_048);
  try {
    const url = new URL(text);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("unsafe URL");
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(?:0|10|127)\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^192\.168\./.test(host) ||
      (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) ||
      /^(?:::|::1|fc|fd|fe8|fe9|fea|feb)/i.test(host)
    ) throw new Error("non-global URL");
    url.hash = "";
    return url.href;
  } catch {
    fail(`${label} must be a public HTTP or HTTPS URL.`, "INVALID_PUBLIC_URL");
  }
}

function boundedStringArray(value, label, maximumItems = SAVED_TRENDS_LIMITS.maxArrayItems) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    fail(`${label} must contain at most ${maximumItems} items.`, "INPUT_LIMIT_EXCEEDED");
  }
  const items = value.map((item, index) =>
    requiredLine(item, `${label}[${index}]`, SAVED_TRENDS_LIMITS.maxTextCharacters)
  );
  if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) {
    fail(`${label} cannot contain duplicates.`, "DUPLICATE_VALUE");
  }
  return Object.freeze(items);
}

function wholeScore(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    fail(`${label} must be an integer from 0 to 100.`, "INVALID_TREND_SNAPSHOT");
  }
  return value;
}

function nullableWholeNumber(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail(`${label} must be null or a non-negative whole number.`, "INVALID_TREND_METRICS");
  }
  return value;
}

function validatedMetrics(value) {
  assertObject(value, METRIC_KEYS, "Trend observation metrics");
  const metrics = deepFreeze({
    sourceFreshness: nullableWholeNumber(value.sourceFreshness, "Source freshness", 100),
    githubRepositoryCount: nullableWholeNumber(value.githubRepositoryCount, "GitHub repository count"),
    githubStars: nullableWholeNumber(value.githubStars, "GitHub stars"),
    githubForks: nullableWholeNumber(value.githubForks, "GitHub forks"),
    companySignalCount: nullableWholeNumber(value.companySignalCount, "Company signal count")
  });
  if (
    metrics.githubRepositoryCount === null &&
    (metrics.githubStars !== null || metrics.githubForks !== null)
  ) {
    fail("GitHub stars or forks require an observed repository count.", "INVALID_TREND_METRICS");
  }
  if (
    metrics.githubRepositoryCount === 0 &&
    ((metrics.githubStars !== null && metrics.githubStars !== 0) ||
      (metrics.githubForks !== null && metrics.githubForks !== 0))
  ) {
    fail("Zero observed repositories cannot have non-zero stars or forks.", "INVALID_TREND_METRICS");
  }
  return metrics;
}

function metricsFromInput(value, trend) {
  if (value != null) assertObject(value, METRIC_KEYS, "Trend observation metrics");
  return validatedMetrics({
    sourceFreshness: value?.sourceFreshness === undefined
      ? trend.signalScore.components.freshness
      : value.sourceFreshness,
    githubRepositoryCount: value?.githubRepositoryCount ?? null,
    githubStars: value?.githubStars ?? null,
    githubForks: value?.githubForks ?? null,
    companySignalCount: value?.companySignalCount ?? null
  });
}

function validatedSignalScore(value) {
  assertObject(value, SCORE_KEYS, "Trend signal score");
  assertObject(value.components, SCORE_COMPONENT_KEYS, "Trend signal-score components");
  if (value.canAffectInvestmentScore !== false) {
    fail("Trend signal scores cannot affect investment scores.", "INVALID_TREND_SNAPSHOT");
  }
  return deepFreeze({
    value: wholeScore(value.value, "Trend signal score"),
    label: requiredLine(value.label, "Trend signal label", 200),
    components: deepFreeze({
      sourceAuthority: wholeScore(value.components.sourceAuthority, "Source-authority component"),
      freshness: wholeScore(value.components.freshness, "Freshness component"),
      commercializationRelevance: wholeScore(
        value.components.commercializationRelevance,
        "Commercialization-relevance component"
      )
    }),
    formula: requiredLine(value.formula, "Trend signal formula", 500),
    purpose: requiredLine(value.purpose, "Trend signal purpose", 300),
    canAffectInvestmentScore: false
  });
}

function validatedTrend(value, expectedTrendId) {
  assertObject(value, TREND_KEYS, "Trend snapshot");
  const id = requiredLine(value.id, "Trend ID", 100);
  if (id !== expectedTrendId || !CATALOG_BY_ID.has(id)) {
    fail("Trend snapshot ID must match a known saved trend ID.", "TREND_ID_MISMATCH");
  }
  const sourceUrl = publicUrl(value.sourceUrl, "Trend source URL");
  const sourceHost = requiredLine(value.sourceHost, "Trend source host", 255).toLowerCase().replace(/^www\./, "");
  if (new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "") !== sourceHost.replace(/^www\./, "")) {
    fail("Trend source host must match its public source URL.", "INVALID_TREND_SNAPSHOT");
  }
  const verificationStatus = requiredLine(value.verificationStatus, "Trend verification status", 30).toUpperCase();
  if (!VERIFICATION_STATES.has(verificationStatus)) {
    fail("Trend verification status is unsupported.", "INVALID_TREND_SNAPSHOT");
  }
  let publishedDate = null;
  if (value.publishedDate != null) {
    if (typeof value.publishedDate !== "string" || Number.isNaN(Date.parse(value.publishedDate))) {
      fail("Trend publication date must be null or a valid date.", "INVALID_TREND_SNAPSHOT");
    }
    publishedDate = value.publishedDate;
  }
  return deepFreeze({
    id,
    evidenceId: requiredLine(value.evidenceId, "Trend evidence ID", 200),
    title: requiredLine(value.title, "Trend title", 500),
    searchLabel: requiredLine(value.searchLabel, "Trend search label", 500),
    summary: requiredLine(value.summary, "Trend summary", SAVED_TRENDS_LIMITS.maxTextCharacters),
    sourceUrl,
    sourceHost,
    sourceRole: requiredLine(value.sourceRole, "Trend source role", 100),
    publishedDate,
    queryKind: requiredLine(value.queryKind, "Trend query kind", 100),
    keyFeatures: boundedStringArray(value.keyFeatures, "Trend key features", 12),
    sectors: boundedStringArray(value.sectors, "Trend sectors", 12),
    regions: boundedStringArray(value.regions, "Trend regions", 12),
    githubTerms: boundedStringArray(value.githubTerms, "Trend GitHub terms", 12),
    signalScore: validatedSignalScore(value.signalScore),
    verificationStatus
  });
}

function sourceContextFromTrend(trend, treatment) {
  return deepFreeze({
    title: trend.title,
    searchLabel: trend.searchLabel,
    url: trend.sourceUrl,
    host: trend.sourceHost,
    keyFeatures: immutableClone(trend.keyFeatures),
    treatment
  });
}

function validatedSourceContext(value, trend) {
  assertObject(value, SOURCE_CONTEXT_KEYS, "Saved source context");
  const normalized = sourceContextFromTrend(trend, requiredLine(value.treatment, "Source-context treatment", 100));
  if (
    value.title !== normalized.title ||
    value.searchLabel !== normalized.searchLabel ||
    value.url !== normalized.url ||
    value.host !== normalized.host ||
    JSON.stringify(value.keyFeatures) !== JSON.stringify(normalized.keyFeatures)
  ) {
    fail("Saved source context must be derived exactly from its trend snapshot.", "INVALID_TREND_SNAPSHOT");
  }
  return normalized;
}

function validatedSnapshot(
  value,
  expectedTrendId,
  label = "Trend observation snapshot",
  expectedTreatment = "EXPLICIT_CURRENT_OBSERVATION_CONTEXT"
) {
  assertObject(value, SNAPSHOT_KEYS, label);
  const capturedAt = isoTimestamp(value.capturedAt, `${label} capture time`);
  const trend = validatedTrend(value.trend, expectedTrendId);
  const sourceContext = validatedSourceContext(value.sourceContext, trend);
  if (sourceContext.treatment !== expectedTreatment) {
    fail(`${label} source-context treatment is invalid.`, "INVALID_TREND_SNAPSHOT");
  }
  if (trend.publishedDate && Date.parse(trend.publishedDate) > Date.parse(capturedAt)) {
    fail("Trend publication date cannot be after its snapshot capture time.", "INVALID_TREND_SNAPSHOT");
  }
  return deepFreeze({
    snapshotId: requiredLine(value.snapshotId, `${label} ID`, SAVED_TRENDS_LIMITS.maxSnapshotIdCharacters),
    capturedAt,
    provider: requiredLine(value.provider, `${label} provider`, 100),
    trend,
    sourceContext,
    metrics: validatedMetrics(value.metrics)
  });
}

function baselineSnapshot(trend) {
  const normalizedTrend = validatedTrend(trend, trend.id);
  return deepFreeze({
    snapshotId: TRENDS_SNAPSHOT_V1.snapshotId,
    capturedAt: isoTimestamp(TRENDS_SNAPSHOT_V1.generatedAt, "Frozen trend snapshot capture time"),
    provider: requiredLine(TRENDS_SNAPSHOT_V1.provider, "Frozen trend snapshot provider", 100),
    trend: normalizedTrend,
    sourceContext: sourceContextFromTrend(normalizedTrend, "SAVED_IMMUTABLE_BASELINE_CONTEXT"),
    metrics: metricsFromInput(null, normalizedTrend)
  });
}

export function createSavedTrendObservationSnapshot(options = {}) {
  assertObject(options, OBSERVATION_SNAPSHOT_INPUT_KEYS, "Trend observation snapshot options");
  const trendId = requiredLine(options.trend?.id, "Trend ID", 100);
  const trend = validatedTrend(options.trend, trendId);
  return validatedSnapshot({
    snapshotId: options.snapshotId,
    capturedAt: options.capturedAt,
    provider: options.provider,
    trend,
    sourceContext: sourceContextFromTrend(trend, "EXPLICIT_CURRENT_OBSERVATION_CONTEXT"),
    metrics: metricsFromInput(options.metrics, trend)
  }, trendId);
}

function eventId(index) {
  return `SAVED-TREND-EVENT-${String(index + 1).padStart(4, "0")}`;
}

function watchId(trendId, index) {
  return `SAVED-TREND-WATCH-${trendId}-${String(index + 1).padStart(4, "0")}`;
}

function eventBoundaries() {
  return SAVED_TRENDS_BOUNDARIES;
}

function replayProfile(profile, validateEvents = true) {
  const active = new Map();
  const removed = [];
  const eventIds = new Set();
  let previousTime = Date.parse(profile.createdAt);
  for (let index = 0; index < profile.events.length; index += 1) {
    const event = profile.events[index];
    if (!isPlainObject(event)) fail("Saved-trend events must be objects.", "INVALID_PROFILE_INTEGRITY");
    const occurredAt = isoTimestamp(event.occurredAt, "Saved-trend event time");
    if (Date.parse(occurredAt) < previousTime) {
      fail("Saved-trend event times must be append-only and chronological.", "INVALID_PROFILE_INTEGRITY");
    }
    previousTime = Date.parse(occurredAt);
    if (event.eventId !== eventId(index) || eventIds.has(event.eventId)) {
      fail("Saved-trend event IDs must be unique and sequential.", "INVALID_PROFILE_INTEGRITY");
    }
    eventIds.add(event.eventId);
    exactBoundaries(event.boundaries);

    if (event.type === "SAVED_TREND_ADDED") {
      assertObject(event, SAVE_EVENT_KEYS, "Saved-trend add event");
      if (active.has(event.trendId)) fail("A trend cannot be saved twice while active.", "INVALID_PROFILE_INTEGRITY");
      if (event.watchId !== watchId(event.trendId, index)) fail("Saved-trend watch ID is invalid.", "INVALID_PROFILE_INTEGRITY");
      const baseline = validateEvents
        ? validatedSnapshot(
          event.baselineSnapshot,
          event.trendId,
          "Saved baseline snapshot",
          "SAVED_IMMUTABLE_BASELINE_CONTEXT"
        )
        : event.baselineSnapshot;
      const catalogTrend = CATALOG_BY_ID.get(event.trendId);
      if (!catalogTrend || JSON.stringify(baseline) !== JSON.stringify(baselineSnapshot(catalogTrend))) {
        fail("Saved baseline must exactly match the known frozen trend snapshot.", "INVALID_BASELINE_SNAPSHOT");
      }
      active.set(event.trendId, {
        watchId: event.watchId,
        trendId: event.trendId,
        savedAt: occurredAt,
        savedBy: requiredLine(event.actor, "Saved-trend actor", SAVED_TRENDS_LIMITS.maxActorCharacters),
        baselineSnapshot: baseline,
        observations: []
      });
      continue;
    }
    if (event.type === "SAVED_TREND_REMOVED") {
      assertObject(event, REMOVE_EVENT_KEYS, "Saved-trend remove event");
      const current = active.get(event.trendId);
      if (!current || current.watchId !== event.watchId) fail("Remove event has no matching active watch.", "INVALID_PROFILE_INTEGRITY");
      requiredLine(event.actor, "Saved-trend actor", SAVED_TRENDS_LIMITS.maxActorCharacters);
      active.delete(event.trendId);
      removed.push({ ...current, removedAt: occurredAt, removedBy: event.actor });
      continue;
    }
    if (event.type === "SAVED_TREND_OBSERVED") {
      assertObject(event, OBSERVATION_EVENT_KEYS, "Saved-trend observation event");
      const current = active.get(event.trendId);
      if (!current || current.watchId !== event.watchId) fail("Observation has no matching active watch.", "INVALID_PROFILE_INTEGRITY");
      if (current.observations.length >= SAVED_TRENDS_LIMITS.maxObservationsPerWatch) {
        fail("Saved trend has too many observations.", "INPUT_LIMIT_EXCEEDED");
      }
      requiredLine(event.actor, "Saved-trend actor", SAVED_TRENDS_LIMITS.maxActorCharacters);
      const observation = validateEvents
        ? validatedSnapshot(event.observationSnapshot, event.trendId)
        : event.observationSnapshot;
      if (
        Date.parse(observation.capturedAt) <= Date.parse(current.baselineSnapshot.capturedAt) ||
        Date.parse(observation.capturedAt) <= Date.parse(current.savedAt) ||
        Date.parse(observation.capturedAt) > Date.parse(occurredAt)
      ) {
        fail("Observation capture time must follow the baseline and not exceed its event time.", "INVALID_OBSERVATION_TIME");
      }
      if (current.observations.some((item) => item.snapshotId === observation.snapshotId)) {
        fail("Observation snapshot IDs must be unique within a saved watch.", "DUPLICATE_OBSERVATION");
      }
      const priorObservation = current.observations.at(-1);
      if (priorObservation && Date.parse(observation.capturedAt) <= Date.parse(priorObservation.capturedAt)) {
        fail("Observation snapshots must be appended in capture-time order.", "INVALID_OBSERVATION_TIME");
      }
      current.observations.push(observation);
      continue;
    }
    fail("Saved-trend event type is unsupported.", "INVALID_PROFILE_INTEGRITY");
  }
  return { active, removed, lastEventTime: new Date(previousTime).toISOString() };
}

function validatedProfile(profile, requireFrozen = true) {
  assertObject(profile, PROFILE_KEYS, "Saved-trends profile");
  if (profile.schemaVersion !== SAVED_TRENDS_VERSION) fail("Saved-trends profile version is unsupported.", "UNSUPPORTED_VERSION");
  requiredLine(profile.profileId, "Profile ID", SAVED_TRENDS_LIMITS.maxProfileIdCharacters);
  const createdAt = isoTimestamp(profile.createdAt, "Profile creation time");
  const updatedAt = isoTimestamp(profile.updatedAt, "Profile update time");
  if (!Array.isArray(profile.events) || profile.events.length > SAVED_TRENDS_LIMITS.maxEvents) {
    fail(`Saved-trends profile can contain at most ${SAVED_TRENDS_LIMITS.maxEvents} events.`, "INPUT_LIMIT_EXCEEDED");
  }
  exactBoundaries(profile.boundaries);
  const replay = replayProfile(profile);
  const expectedUpdatedAt = profile.events.length ? replay.lastEventTime : createdAt;
  if (updatedAt !== expectedUpdatedAt) fail("Profile update time must equal its latest event time.", "INVALID_PROFILE_INTEGRITY");
  if (replay.active.size > SAVED_TRENDS_LIMITS.maxActiveTrends) {
    fail("Saved-trends profile exceeds its active-watch limit.", "INPUT_LIMIT_EXCEEDED");
  }
  if (requireFrozen && !isDeepFrozen(profile)) {
    fail("Saved-trends profiles must be deeply immutable; deserialize persisted JSON before use.", "MUTABLE_PROFILE_REJECTED");
  }
  return { profile, replay };
}

function nextProfile(profile, event) {
  if (profile.events.length >= SAVED_TRENDS_LIMITS.maxEvents) {
    fail("Saved-trends profile event limit reached.", "INPUT_LIMIT_EXCEEDED");
  }
  const next = deepFreeze({
    schemaVersion: SAVED_TRENDS_VERSION,
    profileId: profile.profileId,
    createdAt: profile.createdAt,
    updatedAt: event.occurredAt,
    events: Object.freeze([...profile.events, deepFreeze(event)]),
    boundaries: SAVED_TRENDS_BOUNDARIES
  });
  validatedProfile(next);
  if (serializedByteLength(JSON.stringify(next)) > SAVED_TRENDS_LIMITS.maxSerializedBytes) {
    fail("Saved-trends profile exceeds the persistence size limit.", "SERIALIZED_PROFILE_TOO_LARGE");
  }
  return next;
}

function actionTime(profile, value, label) {
  const occurredAt = isoTimestamp(value || new Date().toISOString(), label);
  if (Date.parse(occurredAt) < Date.parse(profile.updatedAt)) {
    fail(`${label} cannot precede the latest saved-trend event.`, "NON_CHRONOLOGICAL_EVENT");
  }
  return occurredAt;
}

export function createSavedTrendsProfile(options = {}) {
  assertObject(options, CREATE_KEYS, "Saved-trends profile options");
  const createdAt = isoTimestamp(options.createdAt || new Date().toISOString(), "Profile creation time");
  return deepFreeze({
    schemaVersion: SAVED_TRENDS_VERSION,
    profileId: requiredLine(options.profileId, "Profile ID", SAVED_TRENDS_LIMITS.maxProfileIdCharacters),
    createdAt,
    updatedAt: createdAt,
    events: Object.freeze([]),
    boundaries: SAVED_TRENDS_BOUNDARIES
  });
}

export function saveTrendToProfile(profile, options = {}) {
  assertObject(options, SAVE_KEYS, "Save-trend options");
  const { replay } = validatedProfile(profile);
  const trendId = requiredLine(options.trendId, "Trend ID", 100);
  const trend = CATALOG_BY_ID.get(trendId);
  if (!trend) fail("Only a known frozen trend can be saved.", "UNKNOWN_TREND_ID");
  const actor = requiredLine(options.actor, "Saved-trend actor", SAVED_TRENDS_LIMITS.maxActorCharacters);
  const occurredAt = actionTime(profile, options.occurredAt, "Trend save time");
  if (replay.active.has(trendId)) return profile;
  if (replay.active.size >= SAVED_TRENDS_LIMITS.maxActiveTrends) {
    fail("Saved-trends active-watch limit reached.", "INPUT_LIMIT_EXCEEDED");
  }
  const index = profile.events.length;
  const baseline = baselineSnapshot(trend);
  if (Date.parse(occurredAt) < Date.parse(baseline.capturedAt)) {
    fail("Trend save time cannot predate the frozen baseline snapshot.", "INVALID_BASELINE_TIME");
  }
  return nextProfile(profile, {
    eventId: eventId(index),
    type: "SAVED_TREND_ADDED",
    trendId,
    watchId: watchId(trendId, index),
    actor,
    occurredAt,
    baselineSnapshot: baseline,
    boundaries: eventBoundaries()
  });
}

export function removeTrendFromProfile(profile, options = {}) {
  assertObject(options, REMOVE_KEYS, "Remove-trend options");
  const { replay } = validatedProfile(profile);
  const trendId = requiredLine(options.trendId, "Trend ID", 100);
  if (!CATALOG_BY_ID.has(trendId)) fail("Only a known frozen trend can be removed.", "UNKNOWN_TREND_ID");
  const actor = requiredLine(options.actor, "Saved-trend actor", SAVED_TRENDS_LIMITS.maxActorCharacters);
  const occurredAt = actionTime(profile, options.occurredAt, "Trend removal time");
  const current = replay.active.get(trendId);
  if (!current) return profile;
  const index = profile.events.length;
  return nextProfile(profile, {
    eventId: eventId(index),
    type: "SAVED_TREND_REMOVED",
    trendId,
    watchId: current.watchId,
    actor,
    occurredAt,
    boundaries: eventBoundaries()
  });
}

export function appendSavedTrendObservation(profile, options = {}) {
  assertObject(options, OBSERVATION_KEYS, "Saved-trend observation options");
  const { replay } = validatedProfile(profile);
  const trendId = requiredLine(options.trendId, "Trend ID", 100);
  const current = replay.active.get(trendId);
  if (!current) fail("A later observation requires an active saved trend.", "SAVED_TREND_REQUIRED");
  const actor = requiredLine(options.actor, "Observation actor", SAVED_TRENDS_LIMITS.maxActorCharacters);
  const occurredAt = actionTime(profile, options.occurredAt, "Observation event time");
  const observationSnapshot = validatedSnapshot(options.currentSnapshot, trendId);
  if (
    Date.parse(observationSnapshot.capturedAt) <= Date.parse(current.baselineSnapshot.capturedAt) ||
    Date.parse(observationSnapshot.capturedAt) <= Date.parse(current.savedAt) ||
    Date.parse(observationSnapshot.capturedAt) > Date.parse(occurredAt)
  ) {
    fail("Observation capture time must follow the saved baseline and not exceed the event time.", "INVALID_OBSERVATION_TIME");
  }
  const duplicate = current.observations.find((item) => item.snapshotId === observationSnapshot.snapshotId);
  if (duplicate) {
    if (JSON.stringify(duplicate) !== JSON.stringify(observationSnapshot)) {
      fail("Observation snapshot ID already exists with different content.", "OBSERVATION_ID_CONFLICT");
    }
    return profile;
  }
  const priorObservation = current.observations.at(-1);
  if (priorObservation && Date.parse(observationSnapshot.capturedAt) <= Date.parse(priorObservation.capturedAt)) {
    fail("Observation snapshots must be appended in capture-time order.", "INVALID_OBSERVATION_TIME");
  }
  if (current.observations.length >= SAVED_TRENDS_LIMITS.maxObservationsPerWatch) {
    fail("Saved trend observation limit reached.", "INPUT_LIMIT_EXCEEDED");
  }
  const index = profile.events.length;
  return nextProfile(profile, {
    eventId: eventId(index),
    type: "SAVED_TREND_OBSERVED",
    trendId,
    watchId: current.watchId,
    actor,
    occurredAt,
    observationSnapshot,
    boundaries: eventBoundaries()
  });
}

function changedField(field, baseline, current) {
  const changed = JSON.stringify(baseline) !== JSON.stringify(current);
  return changed ? deepFreeze({ field, baseline: immutableClone(baseline), current: immutableClone(current) }) : null;
}

function compareSnapshots(baseline, current, comparisonTarget = "CURRENT_SNAPSHOT") {
  const fields = [
    ["provider", baseline.provider, current.provider],
    ["evidenceId", baseline.trend.evidenceId, current.trend.evidenceId],
    ["title", baseline.trend.title, current.trend.title],
    ["searchLabel", baseline.trend.searchLabel, current.trend.searchLabel],
    ["summary", baseline.trend.summary, current.trend.summary],
    ["sourceUrl", baseline.trend.sourceUrl, current.trend.sourceUrl],
    ["sourceHost", baseline.trend.sourceHost, current.trend.sourceHost],
    ["sourceRole", baseline.trend.sourceRole, current.trend.sourceRole],
    ["publishedDate", baseline.trend.publishedDate, current.trend.publishedDate],
    ["queryKind", baseline.trend.queryKind, current.trend.queryKind],
    ["keyFeatures", baseline.trend.keyFeatures, current.trend.keyFeatures],
    ["sectors", baseline.trend.sectors, current.trend.sectors],
    ["regions", baseline.trend.regions, current.trend.regions],
    ["githubTerms", baseline.trend.githubTerms, current.trend.githubTerms],
    ["signalScore.value", baseline.trend.signalScore.value, current.trend.signalScore.value],
    ["signalScore.label", baseline.trend.signalScore.label, current.trend.signalScore.label],
    ["signalScore.components", baseline.trend.signalScore.components, current.trend.signalScore.components],
    ["signalScore.formula", baseline.trend.signalScore.formula, current.trend.signalScore.formula],
    ["signalScore.purpose", baseline.trend.signalScore.purpose, current.trend.signalScore.purpose],
    ["verificationStatus", baseline.trend.verificationStatus, current.trend.verificationStatus],
    ["metrics.sourceFreshness", baseline.metrics.sourceFreshness, current.metrics.sourceFreshness],
    ["metrics.githubRepositoryCount", baseline.metrics.githubRepositoryCount, current.metrics.githubRepositoryCount],
    ["metrics.githubStars", baseline.metrics.githubStars, current.metrics.githubStars],
    ["metrics.githubForks", baseline.metrics.githubForks, current.metrics.githubForks],
    ["metrics.companySignalCount", baseline.metrics.companySignalCount, current.metrics.companySignalCount]
  ];
  const changes = fields.map(([field, left, right]) => changedField(field, left, right)).filter(Boolean);
  return deepFreeze({
    status: changes.length ? "CHANGED" : "UNCHANGED",
    baselineSnapshotId: baseline.snapshotId,
    baselineCapturedAt: baseline.capturedAt,
    currentSnapshotId: current.snapshotId,
    currentCapturedAt: current.capturedAt,
    comparisonTarget,
    changes: Object.freeze(changes),
    signalScoreDelta: current.trend.signalScore.value - baseline.trend.signalScore.value,
    baselineMetrics: baseline.metrics,
    currentMetrics: current.metrics,
    metricDeltas: deepFreeze(Object.fromEntries([...METRIC_KEYS].map((key) => [
      key,
      baseline.metrics[key] === null || current.metrics[key] === null
        ? null
        : current.metrics[key] - baseline.metrics[key]
    ]))),
    inferredTrendDirection: null,
    interpretation: "Exact saved-baseline comparison only; no historical points, trend direction, forecast, or investment implication is inferred.",
    boundaries: SAVED_TRENDS_BOUNDARIES
  });
}

export function compareSavedTrend(profile, options = {}) {
  assertObject(options, COMPARE_KEYS, "Saved-trend comparison options");
  const { replay } = validatedProfile(profile);
  const trendId = requiredLine(options.trendId, "Trend ID", 100);
  const current = replay.active.get(trendId);
  if (!current) fail("Comparison requires an active saved trend.", "SAVED_TREND_REQUIRED");
  const latestSavedSnapshot = current.observations.at(-1) || null;
  const hasExplicitCurrent = options.currentSnapshot != null;
  let currentSnapshot = null;
  if (hasExplicitCurrent) {
    currentSnapshot = validatedSnapshot(options.currentSnapshot, trendId);
    if (
      Date.parse(currentSnapshot.capturedAt) <= Date.parse(current.baselineSnapshot.capturedAt) ||
      Date.parse(currentSnapshot.capturedAt) <= Date.parse(current.savedAt)
    ) {
      fail("Current snapshot cannot predate the saved baseline.", "INVALID_OBSERVATION_TIME");
    }
  } else {
    currentSnapshot = latestSavedSnapshot;
  }
  if (!currentSnapshot) {
    return deepFreeze({
      status: "NO_LATER_OBSERVATION",
      baselineSnapshotId: current.baselineSnapshot.snapshotId,
      baselineCapturedAt: current.baselineSnapshot.capturedAt,
      currentSnapshotId: null,
      currentCapturedAt: null,
      comparisonTarget: "NO_LATER_OBSERVATION",
      latestSavedSnapshotId: null,
      latestSavedCapturedAt: null,
      latestSavedComparison: null,
      changes: Object.freeze([]),
      signalScoreDelta: null,
      baselineMetrics: current.baselineSnapshot.metrics,
      currentMetrics: null,
      metricDeltas: deepFreeze(Object.fromEntries([...METRIC_KEYS].map((key) => [key, null]))),
      inferredTrendDirection: null,
      interpretation: "No later snapshot has been supplied or observed; change is unknown.",
      boundaries: SAVED_TRENDS_BOUNDARIES
    });
  }
  const comparisonTarget = hasExplicitCurrent ? "EXPLICIT_CURRENT_SNAPSHOT" : "LATEST_SAVED_OBSERVATION";
  const comparison = compareSnapshots(current.baselineSnapshot, currentSnapshot, comparisonTarget);
  return deepFreeze({
    ...comparison,
    latestSavedSnapshotId: latestSavedSnapshot?.snapshotId || null,
    latestSavedCapturedAt: latestSavedSnapshot?.capturedAt || null,
    latestSavedComparison: hasExplicitCurrent && latestSavedSnapshot
      ? compareSnapshots(current.baselineSnapshot, latestSavedSnapshot, "LATEST_SAVED_OBSERVATION")
      : null
  });
}

export function projectSavedTrendWatchlist(profile, options = {}) {
  assertObject(options, new Set(["includeRemoved"]), "Saved-trend projection options");
  if (options.includeRemoved != null && typeof options.includeRemoved !== "boolean") {
    fail("includeRemoved must be boolean.", "INVALID_SHAPE");
  }
  const { replay } = validatedProfile(profile);
  const active = [...replay.active.values()].map((item) => deepFreeze({
    watchId: item.watchId,
    trendId: item.trendId,
    savedAt: item.savedAt,
    savedBy: item.savedBy,
    baselineSnapshot: item.baselineSnapshot,
    observationCount: item.observations.length,
    observations: immutableClone(item.observations),
    latestComparison: item.observations.length
      ? deepFreeze({
        ...compareSnapshots(item.baselineSnapshot, item.observations.at(-1), "LATEST_SAVED_OBSERVATION"),
        latestSavedSnapshotId: item.observations.at(-1).snapshotId,
        latestSavedCapturedAt: item.observations.at(-1).capturedAt,
        latestSavedComparison: null
      })
      : null
  }));
  return deepFreeze({
    schemaVersion: SAVED_TRENDS_VERSION,
    profileId: profile.profileId,
    active: Object.freeze(active),
    removed: options.includeRemoved ? immutableClone(replay.removed) : Object.freeze([]),
    eventCount: profile.events.length,
    boundaries: SAVED_TRENDS_BOUNDARIES
  });
}

export function buildSavedTrendSearchReuse(profile, options = {}, now = Date.now) {
  assertObject(options, SEARCH_KEYS, "Saved-trend search options");
  const { replay } = validatedProfile(profile);
  const trendIds = options.trendIds == null
    ? [...replay.active.keys()]
    : boundedStringArray(options.trendIds, "Saved trend IDs", TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends);
  if (trendIds.length < 1 || trendIds.length > TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends) {
    fail(
      `Future company search requires 1 to ${TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends} active saved trends.`,
      "INVALID_TREND_SELECTION"
    );
  }
  const selections = trendIds.map((trendId) => {
    const saved = replay.active.get(trendId);
    if (!saved) fail("Future company searches can use only active saved trends.", "SAVED_TREND_REQUIRED");
    return saved;
  });
  const request = deepFreeze({
    selectedTrendIds: Object.freeze([...trendIds]),
    region: options.region || "GLOBAL",
    sector: options.sector || "ALL"
  });
  let validated;
  let plan;
  try {
    validated = validateTrendCompanyDiscoveryInput(request);
    plan = buildTrendCompanyDiscoveryPlan(validated, now);
  } catch (error) {
    fail(error.message, error.code || "INVALID_TREND_SELECTION");
  }
  return deepFreeze({
    request,
    savedSourceContexts: Object.freeze(selections.map((item) => deepFreeze({
      trendId: item.trendId,
      watchId: item.watchId,
      savedAt: item.savedAt,
      baselineSnapshotId: item.baselineSnapshot.snapshotId,
      sourceContext: item.baselineSnapshot.sourceContext
    }))),
    localValidatedPlan: plan,
    use: "POST request to /api/trends/discover; server must revalidate selectedTrendIds and regenerate its own query plan.",
    clientSourceContextIsAuthoritative: false,
    boundaries: SAVED_TRENDS_BOUNDARIES
  });
}

function serializedByteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function serializeSavedTrendsProfile(profile) {
  validatedProfile(profile);
  const serialized = JSON.stringify(profile);
  if (serializedByteLength(serialized) > SAVED_TRENDS_LIMITS.maxSerializedBytes) {
    fail("Saved-trends profile exceeds the serialization limit.", "SERIALIZED_PROFILE_TOO_LARGE");
  }
  return serialized;
}

export function deserializeSavedTrendsProfile(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) {
    fail("Serialized saved-trends profile must be non-empty JSON text.", "INVALID_SERIALIZED_PROFILE");
  }
  if (serializedByteLength(serialized) > SAVED_TRENDS_LIMITS.maxSerializedBytes) {
    fail("Serialized saved-trends profile exceeds the size limit.", "SERIALIZED_PROFILE_TOO_LARGE");
  }
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail("Serialized saved-trends profile is not valid JSON.", "INVALID_SERIALIZED_PROFILE");
  }
  validatedProfile(parsed, false);
  return deepFreeze(parsed);
}
