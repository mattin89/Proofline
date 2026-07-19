import assert from "node:assert/strict";
import test from "node:test";

import {
  SAVED_TRENDS_BOUNDARIES,
  SAVED_TRENDS_LIMITS,
  SAVED_TRENDS_VERSION,
  SAVED_TREND_METRIC_DEFINITIONS,
  appendSavedTrendObservation,
  buildSavedTrendSearchReuse,
  compareSavedTrend,
  createSavedTrendObservationSnapshot,
  createSavedTrendsProfile,
  deserializeSavedTrendsProfile,
  projectSavedTrendWatchlist,
  removeTrendFromProfile,
  saveTrendToProfile,
  serializeSavedTrendsProfile
} from "../src/saved-trends-v1.mjs";
import { TREND_COMPANY_DISCOVERY_CATALOG } from "../src/trend-company-discovery-v1.mjs";
import { TRENDS_SNAPSHOT_V1 } from "../src/trends-snapshot-v1.mjs";

const ROBOTICS_ID = "TREND-ROBOTICS-AUTONOMY-2026";
const DATACENTER_ID = "TREND-DATACENTER-BOTTLENECKS-2026";

function emptyProfile() {
  return createSavedTrendsProfile({
    profileId: "Mario",
    createdAt: "2026-07-19T10:00:00.000Z"
  });
}

function save(profile, trendId = ROBOTICS_ID, occurredAt = "2026-07-19T10:05:00.000Z") {
  return saveTrendToProfile(profile, { trendId, actor: "Mario", occurredAt });
}

function catalogTrend(trendId = ROBOTICS_ID) {
  return TREND_COMPANY_DISCOVERY_CATALOG.find((trend) => trend.id === trendId);
}

function observation({
  trendId = ROBOTICS_ID,
  snapshotId = "TREND-SNAPSHOT-2026-08-01",
  capturedAt = "2026-08-01T08:00:00.000Z",
  provider = "Tavily",
  metrics,
  mutate = () => {}
} = {}) {
  const trend = structuredClone(catalogTrend(trendId));
  mutate(trend);
  return createSavedTrendObservationSnapshot({ snapshotId, capturedAt, provider, trend, metrics });
}

test("saving a known trend appends one immutable timestamped baseline and is idempotent while active", () => {
  const created = emptyProfile();
  const saved = save(created);
  const duplicate = saveTrendToProfile(saved, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-07-19T10:06:00.000Z"
  });
  const watchlist = projectSavedTrendWatchlist(saved);
  const [watch] = watchlist.active;

  assert.equal(created.schemaVersion, SAVED_TRENDS_VERSION);
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.events), true);
  assert.equal(duplicate, saved);
  assert.equal(saved.events.length, 1);
  assert.equal(saved.events[0].type, "SAVED_TREND_ADDED");
  assert.equal(saved.events[0].occurredAt, "2026-07-19T10:05:00.000Z");
  assert.equal(watch.trendId, ROBOTICS_ID);
  assert.equal(watch.savedBy, "Mario");
  assert.equal(watch.baselineSnapshot.snapshotId, TRENDS_SNAPSHOT_V1.snapshotId);
  assert.equal(watch.baselineSnapshot.capturedAt, TRENDS_SNAPSHOT_V1.generatedAt);
  assert.equal(watch.baselineSnapshot.trend.title, catalogTrend().title);
  assert.equal(watch.baselineSnapshot.sourceContext.url, catalogTrend().sourceUrl);
  assert.equal(watch.baselineSnapshot.sourceContext.treatment, "SAVED_IMMUTABLE_BASELINE_CONTEXT");
  assert.equal(watch.baselineSnapshot.metrics.sourceFreshness, catalogTrend().signalScore.components.freshness);
  assert.equal(watch.baselineSnapshot.metrics.githubRepositoryCount, null);
  assert.equal(watch.baselineSnapshot.metrics.githubStars, null);
  assert.equal(watch.baselineSnapshot.metrics.githubForks, null);
  assert.equal(watch.baselineSnapshot.metrics.companySignalCount, null);
  assert.equal(SAVED_TREND_METRIC_DEFINITIONS.githubStars.nullMeaning, "NOT_SAMPLED_OR_NOT_REPORTED");
  assert.equal(SAVED_TREND_METRIC_DEFINITIONS.githubStars.zeroMeaning, "EXPLICITLY_SAMPLED_ZERO");
  assert.equal(watch.observationCount, 0);
  assert.equal(watch.latestComparison, null);
  assert.deepEqual(saved.boundaries, SAVED_TRENDS_BOUNDARIES);
  assert.equal(Object.isFrozen(watch.baselineSnapshot.trend.signalScore), true);

  assert.throws(
    () => saveTrendToProfile(created, {
      trendId: "TREND-CALLER-INVENTED",
      actor: "Mario",
      occurredAt: "2026-07-19T10:05:00.000Z"
    }),
    (error) => error.code === "UNKNOWN_TREND_ID"
  );
  assert.throws(
    () => saveTrendToProfile(created, {
      trendId: ROBOTICS_ID,
      actor: "Mario",
      occurredAt: "2026-07-19T08:00:00.000Z",
      history: "invented"
    }),
    (error) => error.code === "UNKNOWN_FIELD"
  );
  assert.throws(
    () => saveTrendToProfile(
      createSavedTrendsProfile({ profileId: "Mario", createdAt: "2026-01-01T00:00:00.000Z" }),
      { trendId: ROBOTICS_ID, actor: "Mario", occurredAt: "2026-01-02T00:00:00.000Z" }
    ),
    (error) => error.code === "INVALID_BASELINE_TIME"
  );
});

test("remove and re-save are append-only and retain the prior watch only as explicit history", () => {
  const first = save(emptyProfile());
  const removed = removeTrendFromProfile(first, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-07-20T10:00:00.000Z"
  });
  const duplicateRemoval = removeTrendFromProfile(removed, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-07-20T10:05:00.000Z"
  });
  const reSaved = saveTrendToProfile(removed, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-07-21T10:00:00.000Z"
  });
  const projection = projectSavedTrendWatchlist(reSaved, { includeRemoved: true });

  assert.equal(duplicateRemoval, removed);
  assert.deepEqual(reSaved.events.map((event) => event.type), [
    "SAVED_TREND_ADDED",
    "SAVED_TREND_REMOVED",
    "SAVED_TREND_ADDED"
  ]);
  assert.equal(projection.active.length, 1);
  assert.equal(projection.removed.length, 1);
  assert.notEqual(projection.active[0].watchId, projection.removed[0].watchId);
  assert.equal(projection.removed[0].removedAt, "2026-07-20T10:00:00.000Z");
  assert.equal(projectSavedTrendWatchlist(reSaved).removed.length, 0);
});

test("later observations are explicit, immutable, chronological, idempotent, and compared only with the saved baseline", () => {
  const saved = save(emptyProfile());
  const current = observation({
    metrics: {
      sourceFreshness: 100,
      githubRepositoryCount: 3,
      githubStars: 1_240,
      githubForks: 87,
      companySignalCount: 2
    },
    mutate(trend) {
      trend.evidenceId = "WEB-ROBOTICS-REFRESH-2026-08";
      trend.summary = "A later sourced public observation about robotics reliability and deployment.";
      trend.signalScore.value = 95;
      trend.signalScore.label = "High-priority signal";
      trend.signalScore.components.freshness = 100;
    }
  });
  const observed = appendSavedTrendObservation(saved, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-08-01T09:00:00.000Z",
    currentSnapshot: current
  });
  const duplicate = appendSavedTrendObservation(observed, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-08-01T09:05:00.000Z",
    currentSnapshot: current
  });
  const comparison = compareSavedTrend(observed, { trendId: ROBOTICS_ID });
  const explicitCurrent = observation({
    snapshotId: "TREND-SNAPSHOT-2026-08-15",
    capturedAt: "2026-08-15T08:00:00.000Z",
    metrics: {
      sourceFreshness: 100,
      githubRepositoryCount: 4,
      githubStars: 1_500,
      githubForks: 95,
      companySignalCount: 3
    },
    mutate(trend) { trend.summary = "A newer explicit current snapshot not yet appended to history."; }
  });
  const baselineLatestCurrent = compareSavedTrend(observed, {
    trendId: ROBOTICS_ID,
    currentSnapshot: explicitCurrent
  });
  const projection = projectSavedTrendWatchlist(observed);

  assert.equal(duplicate, observed);
  assert.equal(observed.events.length, 2);
  assert.equal(observed.events[1].type, "SAVED_TREND_OBSERVED");
  assert.equal(Object.isFrozen(observed.events[1].observationSnapshot), true);
  assert.equal(projection.active[0].observationCount, 1);
  assert.equal(comparison.status, "CHANGED");
  assert.equal(comparison.currentSnapshotId, current.snapshotId);
  assert.equal(comparison.signalScoreDelta, 95 - catalogTrend().signalScore.value);
  assert.equal(comparison.inferredTrendDirection, null);
  assert.match(comparison.interpretation, /no historical points, trend direction, forecast, or investment implication/i);
  assert.ok(comparison.changes.some((change) => change.field === "evidenceId"));
  assert.ok(comparison.changes.some((change) => change.field === "summary"));
  assert.ok(comparison.changes.some((change) => change.field === "signalScore.value"));
  assert.ok(comparison.changes.some((change) => change.field === "metrics.githubStars"));
  assert.equal(comparison.baselineMetrics.githubStars, null);
  assert.equal(comparison.currentMetrics.githubRepositoryCount, 3);
  assert.equal(comparison.currentMetrics.githubStars, 1_240);
  assert.equal(comparison.currentMetrics.githubForks, 87);
  assert.equal(comparison.currentMetrics.companySignalCount, 2);
  assert.equal(comparison.metricDeltas.githubStars, null);
  assert.equal(
    comparison.metricDeltas.sourceFreshness,
    100 - catalogTrend().signalScore.components.freshness
  );
  assert.deepEqual(projection.active[0].latestComparison, comparison);
  assert.equal(comparison.comparisonTarget, "LATEST_SAVED_OBSERVATION");
  assert.equal(baselineLatestCurrent.comparisonTarget, "EXPLICIT_CURRENT_SNAPSHOT");
  assert.equal(baselineLatestCurrent.currentSnapshotId, explicitCurrent.snapshotId);
  assert.equal(baselineLatestCurrent.latestSavedSnapshotId, current.snapshotId);
  assert.equal(baselineLatestCurrent.latestSavedComparison.currentSnapshotId, current.snapshotId);
  assert.equal(baselineLatestCurrent.latestSavedComparison.comparisonTarget, "LATEST_SAVED_OBSERVATION");

  assert.throws(
    () => appendSavedTrendObservation(observed, {
      trendId: ROBOTICS_ID,
      actor: "Mario",
      occurredAt: "2026-08-02T09:00:00.000Z",
      currentSnapshot: observation({
        snapshotId: "TREND-SNAPSHOT-OLDER",
        capturedAt: "2026-07-30T08:00:00.000Z"
      })
    }),
    (error) => error.code === "INVALID_OBSERVATION_TIME"
  );
  assert.throws(
    () => appendSavedTrendObservation(observed, {
      trendId: ROBOTICS_ID,
      actor: "Mario",
      occurredAt: "2026-08-02T09:00:00.000Z",
      currentSnapshot: observation({
        snapshotId: current.snapshotId,
        capturedAt: current.capturedAt,
        mutate(trend) { trend.summary = "Conflicting content under the same snapshot ID."; }
      })
    }),
    (error) => error.code === "OBSERVATION_ID_CONFLICT"
  );
});

test("unsampled observation metrics stay null and sampled zero is accepted only as an explicit value", () => {
  const unsampled = observation({
    metrics: {
      sourceFreshness: null,
      githubRepositoryCount: null,
      githubStars: null,
      githubForks: null,
      companySignalCount: null
    }
  });
  const sampledZero = observation({
    snapshotId: "TREND-SNAPSHOT-SAMPLED-ZERO",
    metrics: {
      sourceFreshness: 100,
      githubRepositoryCount: 0,
      githubStars: 0,
      githubForks: 0,
      companySignalCount: 0
    }
  });

  assert.deepEqual(unsampled.metrics, {
    sourceFreshness: null,
    githubRepositoryCount: null,
    githubStars: null,
    githubForks: null,
    companySignalCount: null
  });
  assert.equal(sampledZero.metrics.githubRepositoryCount, 0);
  assert.equal(sampledZero.metrics.companySignalCount, 0);
  assert.throws(
    () => observation({
      snapshotId: "TREND-SNAPSHOT-INVALID-METRICS",
      metrics: { githubRepositoryCount: null, githubStars: 10 }
    }),
    (error) => error.code === "INVALID_TREND_METRICS"
  );
});

test("absence of a later snapshot stays unknown and an explicitly unchanged later snapshot stays unchanged", () => {
  const saved = save(emptyProfile());
  const noObservation = compareSavedTrend(saved, { trendId: ROBOTICS_ID });
  const unchanged = compareSavedTrend(saved, {
    trendId: ROBOTICS_ID,
    currentSnapshot: observation()
  });

  assert.deepEqual(noObservation.changes, []);
  assert.equal(noObservation.status, "NO_LATER_OBSERVATION");
  assert.equal(noObservation.signalScoreDelta, null);
  assert.equal(noObservation.currentSnapshotId, null);
  assert.match(noObservation.interpretation, /change is unknown/i);
  assert.equal(unchanged.status, "UNCHANGED");
  assert.deepEqual(unchanged.changes, []);
  assert.equal(unchanged.signalScoreDelta, 0);
  assert.equal(unchanged.inferredTrendDirection, null);
});

test("future company searches reuse active stable IDs and saved source context while the server remains authoritative", () => {
  let profile = save(emptyProfile());
  profile = save(profile, DATACENTER_ID, "2026-07-19T10:06:00.000Z");
  const reuse = buildSavedTrendSearchReuse(profile, {
    trendIds: [ROBOTICS_ID, DATACENTER_ID],
    region: "EUROPE",
    sector: "AI_INFRASTRUCTURE"
  }, Date.parse("2026-08-01T00:00:00.000Z"));

  assert.deepEqual(reuse.request, {
    selectedTrendIds: [ROBOTICS_ID, DATACENTER_ID],
    region: "EUROPE",
    sector: "AI_INFRASTRUCTURE"
  });
  assert.deepEqual(reuse.savedSourceContexts.map((item) => item.trendId), [ROBOTICS_ID, DATACENTER_ID]);
  assert.equal(reuse.savedSourceContexts[0].sourceContext.url, catalogTrend(ROBOTICS_ID).sourceUrl);
  assert.equal(reuse.savedSourceContexts[0].sourceContext.treatment, "SAVED_IMMUTABLE_BASELINE_CONTEXT");
  assert.deepEqual(reuse.localValidatedPlan.selectedTrends.map((item) => item.id), [ROBOTICS_ID, DATACENTER_ID]);
  assert.equal(reuse.localValidatedPlan.filters.region.id, "EUROPE");
  assert.equal(reuse.localValidatedPlan.filters.sector.id, "AI_INFRASTRUCTURE");
  assert.equal(reuse.localValidatedPlan.tavilyQueries.length, 2);
  assert.equal(reuse.clientSourceContextIsAuthoritative, false);
  assert.match(reuse.use, /server must revalidate/i);

  const removed = removeTrendFromProfile(profile, {
    trendId: DATACENTER_ID,
    actor: "Mario",
    occurredAt: "2026-07-20T10:00:00.000Z"
  });
  assert.throws(
    () => buildSavedTrendSearchReuse(removed, { trendIds: [DATACENTER_ID] }),
    (error) => error.code === "SAVED_TREND_REQUIRED"
  );
  assert.throws(
    () => buildSavedTrendSearchReuse(profile, {
      trendIds: [ROBOTICS_ID],
      region: "INVENTED_REGION"
    }),
    (error) => error.code === "INVALID_REGION_FILTER"
  );
});

test("JSON round trips preserve exact event history and deep immutability while tampering and mutable state fail closed", () => {
  let profile = save(emptyProfile());
  profile = appendSavedTrendObservation(profile, {
    trendId: ROBOTICS_ID,
    actor: "Mario",
    occurredAt: "2026-08-01T09:00:00.000Z",
    currentSnapshot: observation()
  });
  const serialized = serializeSavedTrendsProfile(profile);
  const restored = deserializeSavedTrendsProfile(serialized);

  assert.equal(serializeSavedTrendsProfile(restored), serialized);
  assert.deepEqual(restored, profile);
  assert.equal(Object.isFrozen(restored), true);
  assert.equal(Object.isFrozen(restored.events), true);
  assert.equal(Object.isFrozen(restored.events[1].observationSnapshot.trend), true);
  assert.ok(new TextEncoder().encode(serialized).length < SAVED_TRENDS_LIMITS.maxSerializedBytes);

  const mutable = structuredClone(profile);
  assert.throws(
    () => projectSavedTrendWatchlist(mutable),
    (error) => error.code === "MUTABLE_PROFILE_REJECTED"
  );

  const tampered = JSON.parse(serialized);
  tampered.events[0].baselineSnapshot.trend.summary = "Caller-invented baseline history";
  assert.throws(
    () => deserializeSavedTrendsProfile(JSON.stringify(tampered)),
    (error) => error.code === "INVALID_BASELINE_SNAPSHOT"
  );

  const unknown = JSON.parse(serialized);
  unknown.privateServerState = true;
  assert.throws(
    () => deserializeSavedTrendsProfile(JSON.stringify(unknown)),
    (error) => error.code === "UNKNOWN_FIELD"
  );

  assert.throws(
    () => deserializeSavedTrendsProfile("not-json"),
    (error) => error.code === "INVALID_SERIALIZED_PROFILE"
  );
  assert.throws(
    () => deserializeSavedTrendsProfile(`{"padding":"${"x".repeat(SAVED_TRENDS_LIMITS.maxSerializedBytes)}"}`),
    (error) => error.code === "SERIALIZED_PROFILE_TOO_LARGE"
  );
});
