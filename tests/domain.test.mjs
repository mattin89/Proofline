import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateEvidenceStrength,
  applyEvent,
  assertPrestigeInvariant,
  computeAxis,
  computeCase,
  computeCaseFromState,
  decideOpportunity,
  deepClone,
  evidenceQuality,
  nextEvent,
  replayEvents
} from "../src/domain.mjs";
import {
  DEMO_TRANSITIONS,
  SEED_EVENTS,
  createPrestigeTwin
} from "../src/seed.mjs";

function seedState() {
  return replayEvents(deepClone(SEED_EVENTS));
}

function append(events, type, payload, actor = { kind: "HUMAN", id: "Test reviewer" }) {
  const event = nextEvent(events, type, payload, actor);
  events.push(event);
  return event;
}

test("seed replay is deterministic and starts the low-footprint case on a proof path", () => {
  const left = seedState();
  const right = seedState();
  assert.deepEqual(left, right);
  const nura = computeCase(left.opportunities[0], left.thesis);
  assert.equal(nura.decision.code, "REQUEST_PROOF");
  assert.notEqual(nura.decision.code, "PASS");
});

test("independent evidence axes are never collapsed into an overall opportunity score", () => {
  const state = seedState();
  const item = computeCase(state.opportunities[0], state.thesis);
  assert.equal(item.axes.length, 3);
  assert.deepEqual(item.axes.map((axis) => axis.axis), ["FOUNDER", "MARKET", "IDEA_MARKET"]);
  assert.equal(Object.hasOwn(item, "overallScore"), false);
});

test("a verified proof updates Founder and Idea-vs-Market without moving Market", () => {
  const events = deepClone(SEED_EVENTS);
  let state = replayEvents(events);
  const before = computeCase(state.opportunities[0], state.thesis);

  append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  append(events, "PROOF_VERIFIED", DEMO_TRANSITIONS["SYN-C001"].verify);
  state = replayEvents(events);
  const after = computeCase(state.opportunities[0], state.thesis);

  const beforeAxis = Object.fromEntries(before.axes.map((axis) => [axis.axis, axis.score]));
  const afterAxis = Object.fromEntries(after.axes.map((axis) => [axis.axis, axis.score]));
  assert.ok(afterAxis.FOUNDER > beforeAxis.FOUNDER);
  assert.ok(afterAxis.IDEA_MARKET > beforeAxis.IDEA_MARKET);
  assert.equal(afterAxis.MARKET, beforeAxis.MARKET);
  assert.equal(after.decision.code, "RECOMMEND");
  assert.equal(after.opportunity.openQuestions.length, 2);
  assert.match(after.opportunity.memoDraft.tractionKpis, /verified active stiffness/i);
  assert.equal(after.opportunity.memoDraft.weaknesses.includes("Architecture conflict"), false);
});

test("copied sources from one independence group do not inflate corroboration", () => {
  const base = {
    kind: "REPUTABLE_SECONDARY",
    sourceUrl: "https://example.invalid/source",
    excerpt: "Synthetic fixture",
    capturedAt: "2026-07-18T00:00:00Z",
    sourceReliability: 0.8,
    directness: 0.8,
    temporalFit: 0.8,
    entityMatchConfidence: 0.8,
    recency: 0.8,
    reviewState: "VERIFIED"
  };
  const one = aggregateEvidenceStrength([{ ...base, id: "a", independenceGroup: "wire-copy" }]);
  const fiveCopies = aggregateEvidenceStrength(
    Array.from({ length: 5 }, (_, index) => ({
      ...base,
      id: `copy-${index}`,
      independenceGroup: "wire-copy"
    }))
  );
  const independent = aggregateEvidenceStrength([
    { ...base, id: "a", independenceGroup: "one" },
    { ...base, id: "b", independenceGroup: "two" }
  ]);
  assert.equal(one.strength, fiveCopies.strength);
  assert.equal(fiveCopies.independentGroups, 1);
  assert.ok(independent.strength > fiveCopies.strength);
});

test("missing public footprint changes coverage metadata, not the decision calculation", () => {
  const state = seedState();
  const base = deepClone(state.opportunities[0]);
  const variant = deepClone(base);
  variant.profileCoverage.publicCode = "not_observed";
  variant.profileCoverage.professionalProfile = "observed";
  variant.profileCoverage.priorFunding = "observed";
  const baseCase = computeCase(base, state.thesis);
  const variantCase = computeCase(variant, state.thesis);
  assert.deepEqual(baseCase.axes, variantCase.axes);
  assert.equal(baseCase.decision.code, variantCase.decision.code);
});

test("prestige-only mutations are invariant", () => {
  const state = seedState();
  const base = state.opportunities[0];
  const result = assertPrestigeInvariant(base, createPrestigeTwin(base), state.thesis);
  assert.deepEqual(result, {
    founderScoreEqual: true,
    axesEqual: true,
    decisionEqual: true,
    claimTrustEqual: true
  });
});

test("a strong Founder axis cannot compensate for a failed Idea-vs-Market axis", () => {
  const state = seedState();
  const myco = computeCase(state.opportunities.find((item) => item.id === "SYN-C003"), state.thesis);
  const axes = Object.fromEntries(myco.axes.map((axis) => [axis.axis, axis]));
  assert.ok(axes.FOUNDER.score > state.thesis.axisRecommendFloors.FOUNDER);
  assert.ok(axes.IDEA_MARKET.score < state.thesis.axisRejectFloors.IDEA_MARKET);
  assert.equal(myco.decision.code, "PASS");
});

test("retraction is compensating: the evidence remains in history but contributes zero quality", () => {
  const events = deepClone(SEED_EVENTS);
  let state = replayEvents(events);
  const route = state.opportunities.find((item) => item.id === "SYN-C004");
  const before = computeCase(route, state.thesis).claims.find((claim) => claim.id === "ROU-C01").trust.score;

  append(events, "EVIDENCE_RETRACTED", {
    opportunityId: "SYN-C004",
    evidenceId: "ROU-E02",
    reason: "Synthetic validator fixture invalidated"
  });
  state = replayEvents(events);
  const retracted = state.opportunities
    .find((item) => item.id === "SYN-C004")
    .evidence.find((item) => item.id === "ROU-E02");
  const afterCase = computeCase(
    state.opportunities.find((item) => item.id === "SYN-C004"),
    state.thesis
  );
  const after = afterCase.claims.find((claim) => claim.id === "ROU-C01").trust.score;
  assert.ok(retracted.retractedAt);
  assert.equal(evidenceQuality(retracted), 0);
  assert.ok(after < before);
  assert.notEqual(afterCase.decision.code, "RECOMMEND");
});

test("only a named human can freeze a non-binding policy record", () => {
  const state = seedState();
  const route = computeCase(state.opportunities.find((item) => item.id === "SYN-C004"), state.thesis);
  assert.equal(route.decision.code, "RECOMMEND");
  const event = {
    eventId: "system-freeze",
    seq: 2,
    type: "DECISION_FROZEN",
    occurredAt: "2026-07-18T12:00:00Z",
    actor: { kind: "SYSTEM", id: "model" },
    schemaVersion: 1,
    payload: {
      opportunityId: "SYN-C004",
      decision: { code: "RECOMMEND", label: "Recommend $100K", rationale: "System attempt" }
    }
  };
  assert.throws(() => applyEvent(state, event), /requires a named human reviewer/i);
});

test("historical replay hides evidence observed after the selected event", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  append(events, "PROOF_VERIFIED", DEMO_TRANSITIONS["SYN-C001"].verify);
  const beforeVerification = replayEvents(events, 2);
  const afterVerification = replayEvents(events, 3);
  assert.equal(beforeVerification.opportunities[0].evidenceContracts[0].status, "SUBMITTED");
  assert.equal(afterVerification.opportunities[0].evidenceContracts[0].status, "VERIFIED");
  assert.equal(beforeVerification.opportunities[0].evidence.some((item) => item.id === "NUR-E07"), false);
  assert.equal(afterVerification.opportunities[0].evidence.some((item) => item.id === "NUR-E07"), true);
});

test("duplicate event IDs are rejected as a malformed history", () => {
  const events = deepClone(SEED_EVENTS);
  const submission = append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  events.push({ ...deepClone(submission), seq: 3 });
  assert.throws(() => replayEvents(events), /duplicate event id/i);
});

test("an unreviewed live lead cannot change claim trust or axes", () => {
  const events = deepClone(SEED_EVENTS);
  const beforeState = replayEvents(events);
  const before = computeCase(beforeState.opportunities[0], beforeState.thesis);
  append(events, "LIVE_LEAD_ATTACHED", {
    opportunityId: "SYN-C001",
    claimId: "NUR-C03",
    evidence: {
      id: "LIVE-TEST",
      kind: "REPUTABLE_SECONDARY",
      title: "Unreviewed web result",
      sourceUrl: "https://example.invalid/live",
      excerpt: "Potential market information.",
      capturedAt: "2026-07-18T12:00:00Z",
      independenceGroup: "live-test",
      entityMatchConfidence: 0.8,
      directness: 0.8,
      temporalFit: 0.8,
      sourceReliability: 0.8,
      recency: 0.8
    }
  });
  const afterState = replayEvents(events);
  const after = computeCase(afterState.opportunities[0], afterState.thesis);
  assert.deepEqual(after.axes, before.axes);
  assert.deepEqual(
    after.claims.map((claim) => claim.trust.score),
    before.claims.map((claim) => claim.trust.score)
  );
  assert.equal(afterState.opportunities[0].researchLeads.length, 1);
});

test("a frozen non-binding policy record retains its thesis, check, and axis snapshot after a thesis update", () => {
  const events = deepClone(SEED_EVENTS);
  const state = replayEvents(events);
  const route = computeCase(state.opportunities.find((item) => item.id === "SYN-C004"), state.thesis);
  append(events, "DECISION_FROZEN", {
    opportunityId: "SYN-C004",
    rationale: "All frozen gates cleared in the synthetic fixture.",
    acknowledgements: ["axes", "claims", "unknowns"]
  });
  append(events, "THESIS_UPDATED", {
    thesis: {
      axisRecommendFloors: { FOUNDER: 95, MARKET: 95, IDEA_MARKET: 95 },
      checkSize: { min: 250000, max: 250000, currency: "EUR" }
    }
  });
  const updated = replayEvents(events);
  const frozen = updated.opportunities.find((item) => item.id === "SYN-C004").finalDecision;
  assert.equal(frozen.thesisVersion, 1);
  assert.equal(frozen.code, "RECOMMEND");
  assert.equal(frozen.recordType, "NON_BINDING_POLICY_SCREEN");
  assert.equal(frozen.binding, false);
  assert.equal(frozen.fundsReserved, false);
  assert.equal(frozen.transferAuthorized, false);
  assert.equal(frozen.checkAmount, 100_000);
  assert.equal(frozen.checkCurrency, "USD");
  assert.ok(Array.isArray(frozen.axisSnapshot));
});

test("prohibited prestige fields in the decision payload trigger a human hold", () => {
  const state = seedState();
  const candidate = deepClone(state.opportunities[0]);
  candidate.axisInputs.FOUNDER.dimensions[0].eliteSchool = "synthetic prestige badge";
  const item = computeCase(candidate, state.thesis);
  assert.equal(item.decision.code, "HUMAN_HOLD");
  assert.ok(item.decision.ruleIds.includes("POLICY_PROTECTED_DATA_ISOLATION"));
});

test("a protected or unknown founder-observation field is rejected at ingress", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  const verification = deepClone(DEMO_TRANSITIONS["SYN-C001"].verify);
  verification.founderObservations[0].gender = "inadmissible synthetic mutation";
  append(events, "PROOF_VERIFIED", verification);
  assert.throws(() => replayEvents(events), /inadmissible field.*gender/i);
});

test("a proof observation must reference verified admissible evidence", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  const verification = deepClone(DEMO_TRANSITIONS["SYN-C001"].verify);
  verification.founderObservations[0].evidenceIds = ["UNKNOWN-EVIDENCE"];
  append(events, "PROOF_VERIFIED", verification);
  assert.throws(() => replayEvents(events), /references unknown evidence/i);
});

test("a blank reviewer cannot freeze a policy record", () => {
  const events = deepClone(SEED_EVENTS);
  append(
    events,
    "DECISION_FROZEN",
    {
      opportunityId: "SYN-C004",
      rationale: "All current evidence gates were reviewed.",
      acknowledgements: ["axes", "claims", "unknowns"]
    },
    { kind: "HUMAN", id: "   " }
  );
  assert.throws(() => replayEvents(events), /actor id.*non-empty|named human/i);
});

test("a human cannot freeze a non-eligible policy screen", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "DECISION_FROZEN", {
    opportunityId: "SYN-C003",
    rationale: "Attempt to override a failed independent axis.",
    acknowledgements: ["axes", "claims", "unknowns"]
  });
  assert.throws(() => replayEvents(events), /current decision is PASS/i);
});

test("the domain constructs the frozen snapshot and rejects caller-supplied snapshots", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "DECISION_FROZEN", {
    opportunityId: "SYN-C004",
    rationale: "All current evidence gates were reviewed.",
    acknowledgements: ["axes", "claims", "unknowns"],
    decision: { code: "RECOMMEND", axisSnapshot: [] }
  });
  assert.throws(() => replayEvents(events), /inadmissible field.*decision/i);
});

test("refuting evidence reverses a positive linked dimension instead of increasing its confidence", () => {
  const axis = computeAxis(
    "MARKET",
    {
      axisInputs: {
        MARKET: {
          label: "Market",
          trend: "DOWN",
          dimensions: [
            {
              key: "demand",
              label: "Demand",
              value: 86,
              confidence: 0.9,
              weight: 1,
              claimIds: ["C-REFUTED"]
            }
          ]
        }
      }
    },
    new Map([
      [
        "C-REFUTED",
        { status: "REFUTED", score: 5, supportingStrength: 10, opposingStrength: 95 }
      ]
    ]),
    { score: null, confidence: 0 }
  );
  assert.equal(axis.score, 0);
  assert.equal(axis.dimensions[0].value, 0);
  assert.ok(axis.confidence >= 0.85);
});

test("confirmed founder identity inherits persistent observations across opportunities", () => {
  const events = deepClone(SEED_EVENTS);
  const dataset = events[0].payload.dataset;
  const sibling = deepClone(dataset.opportunities[0]);
  sibling.id = "SYN-C001-B";
  sibling.companyName = "NuraFlex Next";
  sibling.founderObservations = [];
  sibling.timeline = [];
  dataset.opportunities.push(sibling);

  const state = replayEvents(events);
  const source = state.opportunities.find((item) => item.id === "SYN-C001");
  const inherited = state.opportunities.find((item) => item.id === "SYN-C001-B");
  assert.deepEqual(
    computeCaseFromState(state, inherited).founderScore,
    computeCaseFromState(state, source).founderScore
  );
  assert.equal(computeCase(inherited, state.thesis).founderScore.score, null);
});

test("retracting linked proof evidence removes its founder contribution but preserves history", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  append(events, "PROOF_VERIFIED", DEMO_TRANSITIONS["SYN-C001"].verify);
  let state = replayEvents(events);
  let opportunity = state.opportunities.find((item) => item.id === "SYN-C001");
  const before = computeCaseFromState(state, opportunity).founderScore;

  append(events, "EVIDENCE_RETRACTED", {
    opportunityId: "SYN-C001",
    evidenceId: "NUR-E07",
    reason: "Synthetic calibration fixture invalidated"
  });
  state = replayEvents(events);
  opportunity = state.opportunities.find((item) => item.id === "SYN-C001");
  const after = computeCaseFromState(state, opportunity).founderScore;
  assert.ok(opportunity.evidence.find((item) => item.id === "NUR-E07").retractedAt);
  assert.ok(opportunity.founderObservations.some((item) => item.id === "NUR-O09"));
  assert.ok(after.score < before.score);
  assert.ok(
    state.founderProfiles
      .find((profile) => profile.founderId === opportunity.founderId)
      .observationRefs.some((reference) => reference.observationId === "NUR-O09")
  );
});

test("proof noncompletion changes workflow only and never becomes adverse founder evidence", () => {
  const events = deepClone(SEED_EVENTS);
  let state = replayEvents(events);
  let opportunity = state.opportunities.find((item) => item.id === "SYN-C001");
  const before = computeCaseFromState(state, opportunity);
  const sourceChannelsBefore = deepClone(state.sourceChannels);

  append(events, "PROOF_NOT_COMPLETED", {
    opportunityId: "SYN-C001",
    contractId: "NUR-EC01",
    status: "DECLINED",
    reasonCategory: "CONFIDENTIALITY_CONSTRAINT"
  });
  state = replayEvents(events);
  opportunity = state.opportunities.find((item) => item.id === "SYN-C001");
  const after = computeCaseFromState(state, opportunity);
  assert.deepEqual(after.founderScore, before.founderScore);
  assert.deepEqual(after.axes, before.axes);
  assert.deepEqual(
    after.claims.map((claim) => claim.trust),
    before.claims.map((claim) => claim.trust)
  );
  assert.deepEqual(state.sourceChannels, sourceChannelsBefore);
  assert.notEqual(after.decision.code, "PASS");
  assert.equal(opportunity.evidenceContracts[0].status, "DECLINED");
});

test("malformed sequence gaps, duplicate sequences, and second initialization are rejected", () => {
  const gap = deepClone(SEED_EVENTS);
  const submission = nextEvent(gap, "PROOF_SUBMITTED", DEMO_TRANSITIONS["SYN-C001"].submit, {
    kind: "HUMAN",
    id: "Synthetic founder"
  });
  submission.seq = 3;
  gap.push(submission);
  assert.throws(() => replayEvents(gap), /sequence gap/i);

  const duplicateSequence = deepClone(SEED_EVENTS);
  const sameSeq = deepClone(submission);
  sameSeq.eventId = "UNIQUE-DUPLICATE-SEQUENCE";
  sameSeq.seq = 1;
  duplicateSequence.push(sameSeq);
  assert.throws(() => replayEvents(duplicateSequence), /duplicate event sequence/i);

  const secondInitialization = deepClone(SEED_EVENTS);
  const second = deepClone(secondInitialization[0]);
  second.eventId = "SECOND-INITIALIZATION";
  second.seq = 2;
  secondInitialization.push(second);
  assert.throws(() => replayEvents(secondInitialization), /exactly one dataset initialization/i);
});

test("a partial decision-critical claim cannot clear the recommendation gate", () => {
  const state = seedState();
  const opportunity = state.opportunities.find((item) => item.id === "SYN-C004");
  const item = computeCaseFromState(state, opportunity);
  const trust = new Map(
    item.claims.map((claim) => [
      claim.id,
      claim.decisionCritical
        ? { ...claim.trust, score: 65, status: "PARTIAL" }
        : claim.trust
    ])
  );
  const decision = decideOpportunity(opportunity, state.thesis, item.axes, trust);
  assert.equal(decision.code, "INVESTIGATE");
});

test("invalid axis weights and thesis floors fail closed", () => {
  const invalidDataset = deepClone(SEED_EVENTS);
  invalidDataset[0].payload.dataset.opportunities[0].axisInputs.MARKET.dimensions[0].weight = -0.1;
  assert.throws(() => replayEvents(invalidDataset), /dimension weight/i);

  const invalidThesis = deepClone(SEED_EVENTS);
  append(invalidThesis, "THESIS_UPDATED", {
    thesis: { axisRecommendFloors: { FOUNDER: 101, MARKET: 60, IDEA_MARKET: 65 } }
  });
  assert.throws(() => replayEvents(invalidThesis), /recommendation floor/i);
});

test("decision amendments append a new version without rewriting the frozen record", () => {
  const events = deepClone(SEED_EVENTS);
  append(events, "DECISION_FROZEN", {
    opportunityId: "SYN-C004",
    rationale: "All current evidence gates were reviewed.",
    acknowledgements: ["axes", "claims", "unknowns"]
  });
  append(events, "DECISION_AMENDED", {
    opportunityId: "SYN-C004",
    rationale: "New diligence condition added without rewriting history."
  });
  const state = replayEvents(events);
  const opportunity = state.opportunities.find((item) => item.id === "SYN-C004");
  assert.equal(opportunity.finalDecision.version, 1);
  assert.equal(opportunity.decisionAmendments[0].version, 2);
  assert.equal(opportunity.decisionAmendments[0].amendsVersion, 1);
});
