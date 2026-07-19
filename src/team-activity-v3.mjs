import { TEAM_ACTIVITY } from "./team-activity-v2.mjs";

export const RECORDED_CHECK_ACTIVITY_TYPE = "NON_BINDING_CHECK_APPROVAL_RECORDED";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function immutableClone(value, fallback) {
  if (value == null) return deepFreeze(structuredClone(fallback));
  return deepFreeze(structuredClone(value));
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function coveragePercentage(scoreSnapshot) {
  const percentage = scoreSnapshot?.coverage?.percentage;
  if (Number.isFinite(percentage)) return percentage;
  const ratio = scoreSnapshot?.coverage?.score;
  return Number.isFinite(ratio) ? Math.round(ratio * 1_000) / 10 : null;
}

function approvalTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function projectApproval(approval) {
  const opportunity = approval.opportunitySnapshot || {};
  const score = approval.scoreSnapshot || {};
  const research = approval.researchSnapshot || {};
  const policy = approval.policySnapshot || {};
  const policyCheck = approval.policyCheckSnapshot || {};

  return deepFreeze({
    id: `TEAM-${approval.approvalId}`,
    activityType: RECORDED_CHECK_ACTIVITY_TYPE,
    simulation: false,
    isCurrentUser: true,
    colleagueName: approval.reviewer,
    colleagueRole: "Check reviewer",
    recordId: approval.recordId,
    assessmentId: approval.assessmentId,
    approvalId: approval.approvalId,
    companyName: opportunity.companyName || "Company not retained",
    founderNames: immutableClone(opportunity.founderNames, []),
    sector: opportunity.sector || "Sector not retained",
    stage: opportunity.stage || "Stage not retained",
    fundingAsReported: opportunity.fundingAsReported || "Funding not retained",
    engineScore: finiteOrNull(score.opportunityScore),
    scoreMode: score.mode || null,
    coveragePercentage: coveragePercentage(score),
    uncertaintyPoints: finiteOrNull(score.uncertainty?.points),
    researchId: research.researchId || null,
    evidence: immutableClone(research.evidence, []),
    capturedOn: approval.occurredAt || research.generatedAt || null,
    workflowAction: deepFreeze({
      simulation: false,
      code: approval.type,
      label: "Recorded non-binding check",
      actor: approval.reviewer,
      occurredAt: approval.occurredAt,
      explanation: "Human-recorded session check; it is non-binding and does not reserve or transfer funds."
    }),
    checkApproval: deepFreeze({
      approvalId: approval.approvalId,
      amount: approval.amount,
      currency: approval.currency,
      status: approval.status,
      mode: approval.mode,
      riskIndex: finiteOrNull(approval.riskIndex),
      riskBand: approval.riskBand ?? null,
      policyVersion: approval.policyVersion || policyCheck.policyVersion || null,
      policySnapshot: immutableClone(policy, {}),
      policyCheckSnapshot: immutableClone(policyCheck, {}),
      rationale: approval.rationale,
      acknowledgements: immutableClone(approval.acknowledgements, []),
      occurredAt: approval.occurredAt,
      binding: approval.binding,
      fundsReserved: approval.fundsReserved,
      transferAuthorized: approval.transferAuthorized
    })
  });
}

/**
 * Projects only immutable approval snapshots. Assessment state is deliberately
 * never read here, so later research or intake edits cannot rewrite history.
 */
export function projectRecordedCheckActivity(live) {
  const approvals = Array.isArray(live?.queueCheckApprovals) ? live.queueCheckApprovals : [];
  const records = approvals
    .map((approval, index) => ({ approval, index }))
    .filter(({ approval }) => approval?.type === RECORDED_CHECK_ACTIVITY_TYPE)
    .sort((left, right) => {
      const byTime = approvalTimestamp(right.approval.occurredAt) - approvalTimestamp(left.approval.occurredAt);
      return byTime || right.index - left.index;
    })
    .map(({ approval }) => projectApproval(approval));
  return deepFreeze(records);
}

export function projectTeamActivity(live) {
  return deepFreeze([
    ...projectRecordedCheckActivity(live),
    ...TEAM_ACTIVITY
  ]);
}
