import {
  SCORED_PIPELINE_CAPTURED_ON,
  SCORED_PIPELINE_LEADS
} from "./sourced-pipeline-v2.mjs";

export const DEMO_OUTCOME_FORMULA_VERSION = "proofline.demo-outcome.v1";

export const SIMULATED_ACTION_LABELS = Object.freeze({
  REQUEST_EVIDENCE: "Request evidence",
  PASS_CURRENT_THESIS: "Pass current thesis",
  POLICY_SCREEN_ELIGIBLE: "Policy screen eligible"
});

const DEMO_PERSONAS = Object.freeze([
  Object.freeze({ leadId: "LEAD-MDSIM-2025-SEED", colleagueName: "Dr. Maya Chen", colleagueRole: "Health partner", actionCode: "REQUEST_EVIDENCE" }),
  Object.freeze({ leadId: "LEAD-SWARM-2025-SEED", colleagueName: "Daniel Okafor", colleagueRole: "Robotics partner", actionCode: "PASS_CURRENT_THESIS" }),
  Object.freeze({ leadId: "LEAD-YUTORI-2025-SEED", colleagueName: "Sofia Rossi", colleagueRole: "AI partner", actionCode: "POLICY_SCREEN_ELIGIBLE" }),
  Object.freeze({ leadId: "LEAD-NASCENT-2025-SEED", colleagueName: "Jonas Weber", colleagueRole: "Climate and industry partner", actionCode: "REQUEST_EVIDENCE" }),
  Object.freeze({ leadId: "LEAD-SPACEDOTS-2025-SEED", colleagueName: "Priya Nair", colleagueRole: "Frontier-tech partner", actionCode: "POLICY_SCREEN_ELIGIBLE" })
]);

const ACTION_BY_LEAD_ID = Object.freeze(Object.fromEntries(DEMO_PERSONAS.map((persona) => [persona.leadId, persona.actionCode])));

export function simulatedInvestmentAmountForScore(score) {
  if (!Number.isFinite(score)) return 0;
  if (score >= 70) return 100_000;
  if (score >= 60) return 75_000;
  if (score >= 50) return 50_000;
  return 25_000;
}

export function simulatedWorkflowActionForLead(leadId) {
  const code = ACTION_BY_LEAD_ID[leadId] || "REQUEST_EVIDENCE";
  return Object.freeze({
    simulation: true,
    code,
    label: SIMULATED_ACTION_LABELS[code],
    formulaVersion: DEMO_OUTCOME_FORMULA_VERSION,
    explanation: "Illustrative queue action only; it is not a Proofline policy result or investment-committee decision."
  });
}

export const TEAM_ACTIVITY = Object.freeze(DEMO_PERSONAS.map((persona) => {
  const lead = SCORED_PIPELINE_LEADS.find((item) => item.id === persona.leadId);
  if (!lead) throw new Error(`Missing real lead for simulated colleague activity: ${persona.leadId}`);
  const score = lead.engineSnapshot.opportunityScore;
  return Object.freeze({
    id: `TEAM-${lead.id}`,
    simulation: true,
    colleagueName: persona.colleagueName,
    colleagueRole: persona.colleagueRole,
    leadId: lead.id,
    companyName: lead.companyName,
    founderNames: lead.founderNames,
    sector: lead.sector,
    stage: lead.stage,
    fundingAsReported: lead.fundingAsReported,
    engineScore: score,
    scoreMode: lead.engineSnapshot.scoreMode,
    coveragePercentage: lead.engineSnapshot.coveragePercentage,
    uncertaintyPoints: lead.engineSnapshot.uncertaintyPoints,
    researchId: lead.engineSnapshot.researchId,
    simulatedInvestmentAmount: simulatedInvestmentAmountForScore(score),
    simulatedInvestmentCurrency: "USD",
    allocationFormula: "Score ≥70: $100K; ≥60: $75K; ≥50: $50K; otherwise: $25K.",
    workflowAction: simulatedWorkflowActionForLead(lead.id),
    evidence: lead.evidence,
    capturedOn: SCORED_PIPELINE_CAPTURED_ON
  });
}));
