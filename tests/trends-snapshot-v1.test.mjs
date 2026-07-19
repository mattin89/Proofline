import test from "node:test";
import assert from "node:assert/strict";

import { TRENDS_SNAPSHOT_V1 } from "../src/trends-snapshot-v1.mjs";

test("frozen trend radar retains nine unique real Tavily anchor records across all pillars", () => {
  const snapshot = TRENDS_SNAPSHOT_V1;
  assert.equal(snapshot.provider, "Tavily");
  assert.equal(snapshot.mode, "TREND_RADAR");
  assert.equal(snapshot.sourceCount, 9);
  assert.equal(snapshot.evidence.length, 9);
  assert.equal(snapshot.queries.length, 3);
  assert.deepEqual(snapshot.queries.map((query) => query.anchorCount), [2, 3, 4]);
  assert.ok(snapshot.queries.every((query) => query.method === "TAVILY_EXTRACT"));
  assert.ok(snapshot.queries.every((query) => /^[0-9a-f-]{36}$/i.test(query.requestId)));
  assert.equal(snapshot.usage.reportedCredits, 2);
  assert.equal(snapshot.usage.estimatedCreditsUpperBound, 3);
  assert.equal(snapshot.linkInspection.requested, 9);
  assert.equal(snapshot.linkInspection.extracted, 9);
  assert.deepEqual(snapshot.linkInspection.failures, []);

  const ids = new Set(snapshot.evidence.map((item) => item.id));
  const urls = new Set(snapshot.evidence.map((item) => item.url));
  assert.equal(ids.size, 9);
  assert.equal(urls.size, 9);
  for (const item of snapshot.evidence) {
    assert.match(item.url, /^https:\/\//);
    assert.equal(item.provider, "Tavily");
    assert.equal(item.captureMethod, "TAVILY_EXTRACT");
    assert.equal(item.verificationStatus, "UNREVIEWED");
    assert.equal(item.syntheticFixture, false);
    assert.ok(item.sourceRole);
  }

  for (const section of snapshot.sections) {
    const grouped = snapshot.evidence.filter((item) => item.queryKind === section.queryKind);
    assert.equal(grouped.length, section.sourceCount);
    assert.deepEqual(grouped.map((item) => item.id), section.evidenceIds);
  }
});

test("trend snapshot is explicitly editorial, non-scoring, and credential-free", () => {
  assert.equal(TRENDS_SNAPSHOT_V1.contentTreatment, "EDITORIAL_SUMMARY_OF_TAVILY_EXTRACT");
  assert.deepEqual(TRENDS_SNAPSHOT_V1.boundaries, {
    canAffectStartupScore: false,
    producesProbabilityForecast: false,
    infersTrendDirection: false,
    humanReviewRequired: true
  });
  const serialized = JSON.stringify(TRENDS_SNAPSHOT_V1);
  assert.doesNotMatch(serialized, /(?:TAVILY|EXA)_(?:API|KEY)|tvly-|sk-/i);
  assert.doesNotMatch(serialized, /"(?:decision|successProbability|success_probability)"\s*:/i);
});
