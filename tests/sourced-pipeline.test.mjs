import test from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_INVESTOR_ACTIVITY,
  SOURCED_PIPELINE_LEADS
} from "../src/sourced-pipeline-v1.mjs";
import {
  SCORED_PIPELINE_LEADS,
  SCORED_PIPELINE_TOTAL_REPORTED_CREDITS
} from "../src/sourced-pipeline-v2.mjs";

const EXPECTED_REAL_FOUNDERS = Object.freeze({
  MDsim: ["Roger Assaker", "Richard Assaker", "Dany Assaker"],
  "SWARM Biotactics": ["Jörg Lamprecht", "Moritz Strube", "Stefan Wilhelm", "Jan P. Schween", "Marc Schöne"],
  Yutori: ["Devi Parikh", "Dhruv Batra", "Abhishek Das"],
  "Nascent Materials": ["Chaitanya Sharma"],
  "Space DOTS": ["Bianca Cefalo"]
});

function assertFiniteNumberInRange(value, minimum, maximum, label) {
  assert.equal(Number.isFinite(value), true, `${label} must be a finite number`);
  assert.ok(value >= minimum && value <= maximum, `${label} must be between ${minimum} and ${maximum}`);
}

function assertNoCredentialMaterial(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /(?:TAVILY|EXA|OPENAI)_API_KEY/i);
  assert.doesNotMatch(serialized, /\bBearer\s+[A-Za-z0-9._~-]{8,}/i);
  assert.doesNotMatch(serialized, /\b(?:tvly-|sk-|exa_)[A-Za-z0-9_-]{8,}\b/i);

  const forbiddenPropertyNames = new Set([
    "apikey",
    "authorization",
    "clientsecret",
    "secret",
    "accesstoken",
    "refreshtoken"
  ]);
  const visit = (item) => {
    if (!item || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      assert.equal(forbiddenPropertyNames.has(key.toLowerCase()), false, `credential-like field must not be stored: ${key}`);
      visit(nested);
    }
  };
  visit(value);
}

test("the frozen pipeline contains five unique real seed-stage companies", () => {
  assert.equal(SOURCED_PIPELINE_LEADS.length, 5);
  assert.equal(new Set(SOURCED_PIPELINE_LEADS.map((item) => item.companyName)).size, 5);
  for (const lead of SOURCED_PIPELINE_LEADS) {
    assert.equal(lead.recordType, "SOURCED_PUBLIC_LEAD");
    assert.ok(["PRE_SEED", "SEED"].includes(lead.stage));
    assert.ok(lead.founderNames.length > 0);
    assert.match(lead.engineSnapshot.researchId, /^RES-[a-f0-9]+$/);
    assert.equal(lead.engineSnapshot.provider, "Tavily");
    assert.ok(lead.engineSnapshot.sourceCount > 0);
    assert.equal("score" in lead, false);
    assert.equal("opportunityScore" in lead.engineSnapshot, false);
  }
});

test("every founder, stage and public action is traceable to retained HTTPS evidence", () => {
  for (const lead of SOURCED_PIPELINE_LEADS) {
    const evidenceIds = new Set(lead.evidence.map((item) => item.id));
    assert.ok(lead.founderEvidenceIds.every((id) => evidenceIds.has(id)));
    assert.ok(lead.stageEvidenceIds.every((id) => evidenceIds.has(id)));
    assert.ok(lead.publicActivity.evidenceIds.every((id) => evidenceIds.has(id)));
    for (const evidence of lead.evidence) {
      const url = new URL(evidence.url);
      assert.equal(url.protocol, "https:");
      assert.doesNotMatch(url.hostname, /(?:example|invalid|localhost)/i);
      assert.equal(evidence.provider, "Tavily");
      assert.equal(evidence.captureMethod, "TAVILY_EXTRACT");
    }
  }
});

test("public activity contains no fictional colleague, allocation or private-action fields", () => {
  assert.equal(PUBLIC_INVESTOR_ACTIVITY.length, 5);
  const serialized = JSON.stringify(PUBLIC_INVESTOR_ACTIVITY);
  assert.doesNotMatch(serialized, /demoAllocation|colleague|investmentAction|synthetic|fictional/i);
  for (const item of PUBLIC_INVESTOR_ACTIVITY) {
    assert.ok(item.actor);
    assert.ok(item.label);
    assert.ok(item.evidence.length > 0);
  }
});

test("v2 freezes five unique, real, seed-stage founder records", () => {
  assert.equal(SCORED_PIPELINE_LEADS.length, 5);
  assert.deepEqual(
    [...new Set(SCORED_PIPELINE_LEADS.map((lead) => lead.companyName))].sort(),
    Object.keys(EXPECTED_REAL_FOUNDERS).sort()
  );
  assert.equal(new Set(SCORED_PIPELINE_LEADS.map((lead) => lead.id)).size, 5);

  for (const lead of SCORED_PIPELINE_LEADS) {
    assert.equal(lead.recordType, "SCORED_PUBLIC_LEAD");
    assert.equal(lead.stage, "SEED");
    assert.deepEqual([...lead.founderNames], EXPECTED_REAL_FOUNDERS[lead.companyName]);
    assert.equal(lead.currentVerification.latestPublicEquityStageFound, "SEED");
    assert.match(lead.currentVerification.caveat, /public|unannounced/i);
  }
});

test("v2 retains only real HTTPS source links and evidence URLs", () => {
  for (const lead of SCORED_PIPELINE_LEADS) {
    assert.ok(lead.links.length > 0);
    assert.ok(lead.evidence.length > 0);
    const evidenceIds = new Set(lead.evidence.map((item) => item.id));
    assert.ok(lead.founderEvidenceIds.every((id) => evidenceIds.has(id)));
    assert.ok(lead.stageEvidenceIds.every((id) => evidenceIds.has(id)));
    for (const candidate of [...lead.links, ...lead.evidence.map((item) => item.url)]) {
      const url = new URL(candidate);
      assert.equal(url.protocol, "https:");
      assert.doesNotMatch(url.hostname, /(?:example|invalid|localhost)/i);
      assert.match(url.hostname, /\./, `expected a public hostname, received ${url.hostname}`);
    }
  }
});

test("v2 stores provisional numeric scores, coverage, uncertainty and dimension coverage", () => {
  for (const lead of SCORED_PIPELINE_LEADS) {
    const snapshot = lead.engineSnapshot;
    assert.equal(snapshot.scoreMode, "PROVISIONAL");
    assert.equal(snapshot.reviewState, "UNREVIEWED");
    assert.match(snapshot.scoreMeaning, /not a probability of success|not.+investment decision/i);
    assert.match(snapshot.researchId, /^RES-[a-f0-9]+$/);
    assert.equal(snapshot.provider, "Tavily");
    assertFiniteNumberInRange(snapshot.opportunityScore, 0, 100, `${lead.companyName} opportunityScore`);
    assertFiniteNumberInRange(snapshot.coveragePercentage, 0, 100, `${lead.companyName} coveragePercentage`);
    assertFiniteNumberInRange(snapshot.uncertaintyPoints, 0, 100, `${lead.companyName} uncertaintyPoints`);
    assertFiniteNumberInRange(snapshot.uncertaintyBand.low, 0, 100, `${lead.companyName} uncertaintyBand.low`);
    assertFiniteNumberInRange(snapshot.uncertaintyBand.high, 0, 100, `${lead.companyName} uncertaintyBand.high`);
    assert.ok(snapshot.uncertaintyBand.low <= snapshot.opportunityScore);
    assert.ok(snapshot.opportunityScore <= snapshot.uncertaintyBand.high);

    assert.equal(snapshot.dimensions.length, 5);
    assert.equal(new Set(snapshot.dimensions.map((dimension) => dimension.key)).size, 5);
    for (const dimension of snapshot.dimensions) {
      assertFiniteNumberInRange(dimension.coverage, 0, 1, `${lead.companyName} ${dimension.key} coverage`);
      assertFiniteNumberInRange(dimension.confidence, 0, 1, `${lead.companyName} ${dimension.key} confidence`);
      if (dimension.score === null) {
        assert.equal(dimension.coverage, 0);
        assert.equal(dimension.confidence, 0);
      } else {
        assertFiniteNumberInRange(dimension.score, 0, 100, `${lead.companyName} ${dimension.key} score`);
      }
    }
  }
});

test("v2 reports exactly 16 Tavily credits and stores no credential material", () => {
  assert.equal(SCORED_PIPELINE_TOTAL_REPORTED_CREDITS, 16);
  assert.equal(
    SCORED_PIPELINE_LEADS.reduce((sum, lead) => sum + lead.engineSnapshot.reportedCredits, 0),
    16
  );
  assertNoCredentialMaterial(SCORED_PIPELINE_LEADS);
});
