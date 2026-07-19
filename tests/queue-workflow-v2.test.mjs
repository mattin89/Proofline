import assert from "node:assert/strict";
import test from "node:test";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import {
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS,
  latestCheckApproval,
  normalizedHttpUrl,
  projectLiveQueue,
  projectQueueNextAction,
  queueAssessment,
  recordNonBindingCheckApproval,
  setQueueNextAction
} from "../src/live-queue.mjs";
import { SCORED_PIPELINE_LEADS } from "../src/sourced-pipeline-v2.mjs";

const ACKNOWLEDGEMENTS = NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((item) => item.code);

function liveState(assessment = null) {
  return {
    assessments: assessment ? [assessment] : [],
    queueEvents: [],
    selectedQueueId: null
  };
}

function approvalOptions(recordId, overrides = {}) {
  return {
    recordId,
    policy: DEFAULT_CHECK_POLICY,
    reviewer: "Mario Reviewer",
    rationale: "The reviewed evidence clears every published policy gate; remaining diligence is acknowledged.",
    acknowledgements: ACKNOWLEDGEMENTS,
    occurredAt: "2026-07-19T10:00:00.000Z",
    ...overrides
  };
}

test("a live assessment overlay preserves frozen lead facts and deduplicates normalized public URLs", () => {
  const frozenLead = SCORED_PIPELINE_LEADS.find((item) => item.companyName === "MDsim");
  const assessment = createEmovoDemoAssessment();
  assessment.id = "LIVE-MDSIM-REFRESH";
  assessment.companyName = "MDsim";
  assessment.founderNames = ["Updated founder evidence"];
  assessment.research.researchId = "RES-LIVE-MDSIM";
  assessment.evidence.push({
    id: "LIVE-DUPLICATE",
    title: "Duplicate financing source",
    sourceUrl: "http://www.mdsim.health/2025/06/03/mdsim-closes-2-3-million-seed-round-to-launch-spinesim/?utm_source=demo#round",
    reviewState: "UNREVIEWED"
  });
  const live = liveState(assessment);
  queueAssessment(live, assessment.id, "2026-07-19T09:00:00.000Z");

  const [record] = projectLiveQueue(live, [frozenLead]);

  assert.equal(record.recordType, "LIVE_ASSESSMENT");
  assert.equal(record.sector, frozenLead.sector);
  assert.equal(record.stage, frozenLead.stage);
  assert.equal(record.fundingAsReported, frozenLead.fundingAsReported);
  assert.deepEqual(record.currentVerification, frozenLead.currentVerification);
  assert.equal(record.context, frozenLead.context);
  assert.equal(record.sourceLeadId, frozenLead.id);
  assert.equal(record.frozenLeadSnapshot, frozenLead);
  assert.ok(record.founderNames.includes(frozenLead.founderNames[0]));
  assert.equal(record.priorEngineSnapshot, frozenLead.engineSnapshot);
  const financingKey = normalizedHttpUrl(frozenLead.links[0]);
  assert.equal(record.evidence.filter((item) => normalizedHttpUrl(item.sourceUrl || item.url) === financingKey).length, 1);
  assert.equal(record.links.filter((item) => normalizedHttpUrl(item) === financingKey).length, 1);
});

test("Queue next-action edits are validated, append-only, and distinguish saved edits from simulated defaults", () => {
  const live = liveState();
  const fallback = projectQueueNextAction(live, "LEAD-1", {
    code: "REQUEST_EVIDENCE",
    label: "Request evidence",
    simulation: true
  });
  assert.equal(fallback.origin, "SIMULATED_DEFAULT");
  assert.equal(fallback.eventId, null);

  const first = setQueueNextAction(
    live,
    "LEAD-1",
    "REQUEST_EVIDENCE",
    "Verify customer references.",
    "Mario",
    "2026-07-19T09:00:00.000Z"
  );
  const second = setQueueNextAction(
    live,
    "LEAD-1",
    "PASS_CURRENT_THESIS",
    "Outside the current mandate.",
    "Mario",
    "2026-07-19T09:05:00.000Z"
  );

  assert.equal(live.queueWorkflowEvents.length, 2);
  assert.equal(live.queueWorkflowEvents[0], first);
  assert.equal(live.queueWorkflowEvents[1], second);
  assert.equal(projectQueueNextAction(live, "LEAD-1").actionCode, "PASS_CURRENT_THESIS");
  assert.equal(projectQueueNextAction(live, "LEAD-1").origin, "HUMAN_EDITED");
  assert.equal(first.policyResult, false);
  assert.equal(first.binding, false);
  assert.throws(() => setQueueNextAction(live, "LEAD-1", "APPROVE_TRANSFER"), /must be one of/);
});

test("a genuine check record recomputes the eligible amount, snapshots provenance, and is idempotent", () => {
  const assessment = createEmovoDemoAssessment();
  const live = liveState(assessment);
  queueAssessment(live, assessment.id, "2026-07-19T09:00:00.000Z");
  const recordId = `ASSESSMENT-${assessment.id}`;
  setQueueNextAction(
    live,
    recordId,
    "POLICY_SCREEN_ELIGIBLE",
    "Advance to the genuine policy screen.",
    "Mario",
    "2026-07-19T09:30:00.000Z"
  );

  const first = recordNonBindingCheckApproval(live, approvalOptions(recordId, {
    amount: 9_999_999,
    companyName: "Caller-supplied company",
    founderNames: ["Caller-supplied founder"],
    opportunitySnapshot: { companyName: "Caller-supplied snapshot" }
  }));
  const duplicate = recordNonBindingCheckApproval(live, approvalOptions(recordId, {
    reviewer: "Different caller",
    amount: 25_000,
    occurredAt: "2026-07-19T11:00:00.000Z"
  }));

  assert.equal(first, duplicate);
  assert.equal(live.queueCheckApprovals.length, 1);
  assert.equal(first.amount, 100_000);
  assert.equal(first.currency, "USD");
  assert.equal(first.binding, false);
  assert.equal(first.fundsReserved, false);
  assert.equal(first.transferAuthorized, false);
  assert.equal(first.policySnapshot.fixedAmount, 100_000);
  assert.equal(first.scoreSnapshot.mode, "REVIEWED");
  assert.equal(first.researchSnapshot.researchId, assessment.research.researchId);
  assert.deepEqual(first.opportunitySnapshot, {
    companyName: "Emovo Care",
    founderNames: ["Luca Randazzo", "Iselin Frøybu"],
    sector: "Medical rehabilitation robotics",
    stage: "STAGE_NOT_ESTABLISHED",
    fundingAsReported: "CHF 150K Venture Kick award; current equity stage not established",
    context: assessment.context,
    summary: assessment.research.summary,
    verificationStatus: "REVIEWED",
    links: [
      "https://www.emovocare.com/emovo-clinic",
      "https://emovocare.com/about",
      "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256",
      "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000",
      "https://actu.epfl.ch/news/exoskeleton-device-helps-stroke-victims-regain-han/",
      "https://www.who.int/news-room/fact-sheets/detail/rehabilitation",
      "https://www.england.nhs.uk/ourwork/clinical-policy/stroke/",
      "https://pubmed.ncbi.nlm.nih.gov/32138780/"
    ]
  });
  const uniqueEvidenceUrls = new Set(
    assessment.evidence.map((item) => normalizedHttpUrl(item.sourceUrl || item.url)).filter(Boolean)
  );
  assert.equal(first.researchSnapshot.retainedCitationCount, uniqueEvidenceUrls.size);
  assert.equal(latestCheckApproval(live, recordId), first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.scoreSnapshot.dimensions), true);
  assert.equal(Object.isFrozen(first.opportunitySnapshot), true);
  assert.equal(Object.isFrozen(first.opportunitySnapshot.founderNames), true);
  assert.equal(Object.isFrozen(first.opportunitySnapshot.links), true);

  const frozenOpportunity = structuredClone(first.opportunitySnapshot);
  assessment.companyName = "Mutated company";
  assessment.founderNames.push("Mutated founder");
  assessment.sector = "Mutated sector";
  assessment.stage = "MUTATED_STAGE";
  assessment.fundingAsReported = "Mutated funding";
  assessment.context = "Mutated context";
  assessment.research.summary = "Mutated summary";
  assessment.evidence[0].sourceUrl = "https://example.com/mutated";
  assessment.evidence.push({ sourceUrl: "https://example.com/new" });
  assert.deepEqual(first.opportunitySnapshot, frozenOpportunity);
});

test("simulated labels, caller context, and incomplete attestations cannot bypass approval gates", () => {
  const staticLive = liveState();
  setQueueNextAction(staticLive, "LEAD-FROZEN", "POLICY_SCREEN_ELIGIBLE");
  assert.throws(
    () => recordNonBindingCheckApproval(staticLive, approvalOptions("LEAD-FROZEN")),
    (error) => error.code === "QUEUED_REVIEWED_ASSESSMENT_REQUIRED"
  );

  const noSavedActionAssessment = createEmovoDemoAssessment();
  const noSavedActionLive = liveState(noSavedActionAssessment);
  queueAssessment(noSavedActionLive, noSavedActionAssessment.id, "2026-07-19T09:00:00.000Z");
  projectQueueNextAction(noSavedActionLive, `ASSESSMENT-${noSavedActionAssessment.id}`, {
    code: "POLICY_SCREEN_ELIGIBLE",
    simulation: true
  });
  assert.throws(
    () => recordNonBindingCheckApproval(
      noSavedActionLive,
      approvalOptions(`ASSESSMENT-${noSavedActionAssessment.id}`)
    ),
    (error) => error.code === "POLICY_SCREEN_ACTION_REQUIRED"
  );

  const gatedAssessment = createEmovoDemoAssessment();
  gatedAssessment.identityConfirmed = false;
  const gatedLive = liveState(gatedAssessment);
  queueAssessment(gatedLive, gatedAssessment.id, "2026-07-19T09:00:00.000Z");
  const gatedRecordId = `ASSESSMENT-${gatedAssessment.id}`;
  setQueueNextAction(gatedLive, gatedRecordId, "POLICY_SCREEN_ELIGIBLE");
  assert.throws(
    () => recordNonBindingCheckApproval(gatedLive, approvalOptions(gatedRecordId, {
      identityConfirmed: true,
      acknowledgements: ACKNOWLEDGEMENTS.slice(0, 2)
    })),
    (error) => error.code === "CHECK_ACKNOWLEDGEMENTS_REQUIRED"
  );
  assert.throws(
    () => recordNonBindingCheckApproval(gatedLive, approvalOptions(gatedRecordId, {
      identityConfirmed: true
    })),
    (error) => error.code === "POLICY_GATES_FAILED" && error.failedGates.includes("Entity identity confirmed")
  );

  const provisionalAssessment = createEmovoDemoAssessment();
  provisionalAssessment.reviewedScore = { ...provisionalAssessment.reviewedScore, mode: "PROVISIONAL" };
  const provisionalLive = liveState(provisionalAssessment);
  queueAssessment(provisionalLive, provisionalAssessment.id, "2026-07-19T09:00:00.000Z");
  const provisionalRecordId = `ASSESSMENT-${provisionalAssessment.id}`;
  setQueueNextAction(provisionalLive, provisionalRecordId, "POLICY_SCREEN_ELIGIBLE");
  assert.throws(
    () => recordNonBindingCheckApproval(provisionalLive, approvalOptions(provisionalRecordId)),
    (error) => error.code === "REVIEWED_SCORE_REQUIRED"
  );
});
