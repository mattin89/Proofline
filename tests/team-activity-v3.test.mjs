import assert from "node:assert/strict";
import test from "node:test";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import {
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS,
  queueAssessment,
  recordNonBindingCheckApproval,
  setQueueNextAction
} from "../src/live-queue.mjs";
import { TEAM_ACTIVITY } from "../src/team-activity-v2.mjs";
import {
  RECORDED_CHECK_ACTIVITY_TYPE,
  projectRecordedCheckActivity,
  projectTeamActivity
} from "../src/team-activity-v3.mjs";

const ACKNOWLEDGEMENTS = NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((item) => item.code);

function emptyLive(...assessments) {
  return {
    assessments,
    queueEvents: [],
    queueWorkflowEvents: [],
    queueCheckApprovals: [],
    selectedQueueId: null
  };
}

function approveAssessment(live, assessment, {
  reviewer = "Mario",
  queueActor = "PROOFLINE_CURATED_PUBLIC_DEMO",
  policy = DEFAULT_CHECK_POLICY,
  queueAt = "2026-07-19T09:00:00.000Z",
  actionAt = "2026-07-19T09:30:00.000Z",
  approvalAt = "2026-07-19T10:00:00.000Z"
} = {}) {
  queueAssessment(live, assessment.id, queueAt);
  const recordId = `ASSESSMENT-${assessment.id}`;
  setQueueNextAction(
    live,
    recordId,
    "POLICY_SCREEN_ELIGIBLE",
    "Advance the reviewed evidence pack to the non-binding check screen.",
    queueActor,
    actionAt
  );
  const approval = recordNonBindingCheckApproval(live, {
    recordId,
    policy,
    reviewer,
    rationale: "The reviewed evidence clears every configured gate; all remaining diligence is acknowledged.",
    acknowledgements: ACKNOWLEDGEMENTS,
    occurredAt: approvalAt
  });
  return { approval, recordId };
}

test("without a recorded approval Team Activity remains the five simulated demo records", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  queueAssessment(live, assessment.id, "2026-07-19T09:00:00.000Z");
  setQueueNextAction(
    live,
    `ASSESSMENT-${assessment.id}`,
    "POLICY_SCREEN_ELIGIBLE",
    "Eligible workflow instruction only.",
    "Mario",
    "2026-07-19T09:30:00.000Z"
  );

  assert.deepEqual(projectRecordedCheckActivity(live), []);
  const projected = projectTeamActivity(live);
  assert.equal(projected.length, 5);
  assert.deepEqual(projected, TEAM_ACTIVITY);
  assert.ok(projected.every((item) => item.simulation === true));
  assert.equal(Object.isFrozen(projected), true);
});

test("Mario's Emovo approval projects exact real startup, founder, score, research, and USD 100K check facts", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  const { approval, recordId } = approveAssessment(live, assessment);

  const recorded = projectRecordedCheckActivity(live);
  const projected = projectTeamActivity(live);
  assert.equal(recorded.length, 1);
  assert.equal(projected.length, 6);
  assert.deepEqual(projected[0], recorded[0]);

  const activity = recorded[0];
  assert.equal(activity.id, `TEAM-${approval.approvalId}`);
  assert.equal(activity.activityType, RECORDED_CHECK_ACTIVITY_TYPE);
  assert.equal(activity.activityType, approval.type);
  assert.equal(activity.simulation, false);
  assert.equal(activity.isCurrentUser, true);
  assert.equal(activity.colleagueName, "Mario");
  assert.equal(activity.colleagueRole, "Check reviewer");
  assert.equal(activity.recordId, recordId);
  assert.equal(activity.assessmentId, assessment.id);
  assert.equal(activity.approvalId, approval.approvalId);
  assert.equal(activity.companyName, "Emovo Care");
  assert.deepEqual(activity.founderNames, ["Luca Randazzo", "Iselin Frøybu"]);
  assert.equal(activity.sector, assessment.sector);
  assert.equal(activity.stage, assessment.stage);
  assert.equal(activity.fundingAsReported, assessment.fundingAsReported);
  assert.equal(activity.engineScore, approval.scoreSnapshot.opportunityScore);
  assert.equal(activity.scoreMode, "REVIEWED");
  assert.equal(activity.coveragePercentage, approval.scoreSnapshot.coverage.percentage);
  assert.equal(activity.uncertaintyPoints, approval.scoreSnapshot.uncertainty.points);
  assert.equal(activity.researchId, approval.researchSnapshot.researchId);
  assert.deepEqual(activity.evidence, approval.researchSnapshot.evidence);
  assert.equal(activity.capturedOn, approval.occurredAt);

  assert.equal(activity.workflowAction.label, "Recorded non-binding check");
  assert.equal(activity.workflowAction.code, approval.type);
  assert.equal(activity.workflowAction.actor, "Mario");
  assert.equal(activity.workflowAction.simulation, false);
  assert.equal(activity.checkApproval.amount, 100_000);
  assert.equal(activity.checkApproval.currency, "USD");
  assert.equal(activity.checkApproval.status, "NON_BINDING_RECORDED");
  assert.equal(activity.checkApproval.policyVersion, approval.policyVersion);
  assert.equal(activity.checkApproval.rationale, approval.rationale);
  assert.deepEqual(activity.checkApproval.acknowledgements, ACKNOWLEDGEMENTS);
});

test("the approval reviewer is displayed instead of the curated Queue actor", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  approveAssessment(live, assessment, {
    reviewer: "Mario",
    queueActor: "PROOFLINE_CURATED_PUBLIC_DEMO"
  });

  const [activity] = projectRecordedCheckActivity(live);
  assert.equal(activity.colleagueName, "Mario");
  assert.equal(activity.workflowAction.actor, "Mario");
  assert.doesNotMatch(JSON.stringify(activity), /PROOFLINE_CURATED_PUBLIC_DEMO/);
});

test("idempotent approval recording produces only one Mario activity", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  const { approval, recordId } = approveAssessment(live, assessment);
  const duplicate = recordNonBindingCheckApproval(live, {
    recordId,
    policy: { ...DEFAULT_CHECK_POLICY, currency: "EUR", fixedAmount: 150_000 },
    reviewer: "Different caller",
    rationale: "A duplicate caller must not rewrite the immutable approval.",
    acknowledgements: ACKNOWLEDGEMENTS,
    occurredAt: "2026-07-19T11:00:00.000Z"
  });

  assert.equal(duplicate, approval);
  assert.equal(live.queueCheckApprovals.length, 1);
  const real = projectRecordedCheckActivity(live);
  assert.equal(real.length, 1);
  assert.equal(real.filter((item) => item.colleagueName === "Mario").length, 1);
  assert.equal(projectTeamActivity(live).length, 6);
});

test("recorded activity remains an immutable approval-time projection after mutable assessment changes", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  approveAssessment(live, assessment);
  const before = projectRecordedCheckActivity(live)[0];

  assessment.companyName = "Rewritten company";
  assessment.founderNames = ["Rewritten founder"];
  assessment.sector = "Rewritten sector";
  assessment.stage = "REWRITTEN_STAGE";
  assessment.fundingAsReported = "Rewritten funding";
  assessment.research.researchId = "REWRITTEN-RESEARCH";
  assessment.evidence[0].title = "Rewritten evidence";
  assessment.reviewedScore.opportunityScore = 1;
  assessment.reviewedScore.coverage.percentage = 1;
  assessment.reviewedScore.uncertainty.points = 99;

  const after = projectRecordedCheckActivity(live)[0];
  assert.deepEqual(after, before);
  assert.equal(after.companyName, "Emovo Care");
  assert.deepEqual(after.founderNames, ["Luca Randazzo", "Iselin Frøybu"]);
  assert.notEqual(after.researchId, "REWRITTEN-RESEARCH");
  assert.notEqual(after.engineScore, 1);
  assert.equal(Object.isFrozen(after), true);
  assert.equal(Object.isFrozen(after.founderNames), true);
  assert.equal(Object.isFrozen(after.evidence), true);
  assert.equal(Object.isFrozen(after.evidence[0]), true);
  assert.equal(Object.isFrozen(after.checkApproval), true);
  assert.equal(Object.isFrozen(after.checkApproval.policySnapshot), true);
});

test("recorded checks retain their actual policy amount and currency without simulated allocation fields", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  const policy = {
    ...DEFAULT_CHECK_POLICY,
    currency: "EUR",
    fixedAmount: 150_000
  };
  const { approval } = approveAssessment(live, assessment, { policy });
  const [activity] = projectRecordedCheckActivity(live);

  assert.equal(approval.amount, 150_000);
  assert.equal(approval.currency, "EUR");
  assert.equal(activity.checkApproval.amount, 150_000);
  assert.equal(activity.checkApproval.currency, "EUR");
  assert.equal(activity.checkApproval.mode, "FIXED");
  assert.deepEqual(activity.checkApproval.policySnapshot, approval.policySnapshot);
  assert.deepEqual(activity.checkApproval.policyCheckSnapshot, approval.policyCheckSnapshot);
  assert.equal("simulatedInvestmentAmount" in activity, false);
  assert.equal("simulatedInvestmentCurrency" in activity, false);
  assert.equal("allocationFormula" in activity, false);
});

test("real approval records are newest-first and precede all five simulated colleagues", () => {
  const olderAssessment = createEmovoDemoAssessment();
  const newerAssessment = createEmovoDemoAssessment();
  newerAssessment.id = "DEMO-EMOVO-SECOND-2026-07-19";
  newerAssessment.companyName = "Emovo Care Second Review";
  newerAssessment.research.researchId = newerAssessment.id;
  const live = emptyLive(olderAssessment, newerAssessment);

  approveAssessment(live, olderAssessment, {
    queueAt: "2026-07-19T08:00:00.000Z",
    actionAt: "2026-07-19T08:30:00.000Z",
    approvalAt: "2026-07-19T09:00:00.000Z"
  });
  approveAssessment(live, newerAssessment, {
    queueAt: "2026-07-19T09:01:00.000Z",
    actionAt: "2026-07-19T09:30:00.000Z",
    approvalAt: "2026-07-19T10:00:00.000Z"
  });

  const real = projectRecordedCheckActivity(live);
  assert.deepEqual(real.map((item) => item.companyName), [
    "Emovo Care Second Review",
    "Emovo Care"
  ]);
  const all = projectTeamActivity(live);
  assert.deepEqual(all.slice(0, 2), real);
  assert.deepEqual(all.slice(2), TEAM_ACTIVITY);
});

test("recorded check safety flags remain explicitly false and never imply invested capital", () => {
  const assessment = createEmovoDemoAssessment();
  const live = emptyLive(assessment);
  approveAssessment(live, assessment);
  const [activity] = projectRecordedCheckActivity(live);

  assert.equal(activity.checkApproval.binding, false);
  assert.equal(activity.checkApproval.fundsReserved, false);
  assert.equal(activity.checkApproval.transferAuthorized, false);
  assert.match(activity.workflowAction.explanation, /non-binding/i);
  assert.match(activity.workflowAction.explanation, /does not reserve or transfer funds/i);
  assert.doesNotMatch(activity.workflowAction.label, /invested|investment/i);
});
