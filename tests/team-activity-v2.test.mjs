import test from "node:test";
import assert from "node:assert/strict";

import { SCORED_PIPELINE_LEADS } from "../src/sourced-pipeline-v2.mjs";
import {
  DEMO_OUTCOME_FORMULA_VERSION,
  SIMULATED_ACTION_LABELS,
  TEAM_ACTIVITY,
  simulatedInvestmentAmountForScore,
  simulatedWorkflowActionForLead
} from "../src/team-activity-v2.mjs";

const EXPECTED_DEMO_COLLEAGUES = Object.freeze([
  "Dr. Maya Chen",
  "Daniel Okafor",
  "Sofia Rossi",
  "Jonas Weber",
  "Priya Nair"
]);

function referenceAllocationForScore(score) {
  if (!Number.isFinite(score)) return 0;
  if (score >= 70) return 100_000;
  if (score >= 60) return 75_000;
  if (score >= 50) return 50_000;
  return 25_000;
}

test("the score-to-demo-allocation helper is a pure, deterministic band formula", () => {
  const cases = [
    [Number.NaN, 0],
    [49.999, 25_000],
    [50, 50_000],
    [59.999, 50_000],
    [60, 75_000],
    [69.999, 75_000],
    [70, 100_000],
    [100, 100_000]
  ];
  for (const [score, expected] of cases) {
    assert.equal(simulatedInvestmentAmountForScore(score), expected);
    assert.equal(simulatedInvestmentAmountForScore(score), referenceAllocationForScore(score));
  }
});

test("Team Activity maps five simulated colleagues to exact real scored company facts", () => {
  assert.equal(TEAM_ACTIVITY.length, 5);
  assert.equal(new Set(TEAM_ACTIVITY.map((item) => item.colleagueName)).size, 5);
  assert.deepEqual(TEAM_ACTIVITY.map((item) => item.colleagueName), EXPECTED_DEMO_COLLEAGUES);
  assert.equal(new Set(TEAM_ACTIVITY.map((item) => item.leadId)).size, SCORED_PIPELINE_LEADS.length);

  for (const item of TEAM_ACTIVITY) {
    const realLead = SCORED_PIPELINE_LEADS.find((lead) => lead.id === item.leadId);
    assert.ok(realLead, `missing real source lead for ${item.leadId}`);
    assert.equal(item.simulation, true);
    assert.ok(item.colleagueRole);
    assert.equal(item.companyName, realLead.companyName);
    assert.deepEqual([...item.founderNames], [...realLead.founderNames]);
    assert.equal(item.sector, realLead.sector);
    assert.equal(item.stage, realLead.stage);
    assert.equal(item.fundingAsReported, realLead.fundingAsReported);
    assert.equal(item.engineScore, realLead.engineSnapshot.opportunityScore);
    assert.equal(item.scoreMode, "PROVISIONAL");
    assert.equal(item.coveragePercentage, realLead.engineSnapshot.coveragePercentage);
    assert.equal(item.uncertaintyPoints, realLead.engineSnapshot.uncertaintyPoints);
    assert.equal(item.researchId, realLead.engineSnapshot.researchId);
    assert.deepEqual(item.evidence, realLead.evidence);
  }
});

test("every displayed investment amount is simulated and calculated only from its frozen score", () => {
  for (const item of TEAM_ACTIVITY) {
    const expected = referenceAllocationForScore(item.engineScore);
    assert.equal(item.simulatedInvestmentAmount, expected);
    assert.equal(item.simulatedInvestmentAmount, simulatedInvestmentAmountForScore(item.engineScore));
    assert.equal(item.simulatedInvestmentCurrency, "USD");
    assert.match(item.allocationFormula, /Score.+\$100K.+\$75K.+\$50K.+\$25K/i);
  }
});

test("Team Activity and queue actions carry explicit simulation markings and allowed labels", () => {
  const allowedCodes = Object.keys(SIMULATED_ACTION_LABELS);
  assert.deepEqual(allowedCodes.sort(), [
    "PASS_CURRENT_THESIS",
    "POLICY_SCREEN_ELIGIBLE",
    "REQUEST_EVIDENCE"
  ]);

  for (const item of TEAM_ACTIVITY) {
    const action = item.workflowAction;
    assert.equal(action.simulation, true);
    assert.ok(allowedCodes.includes(action.code));
    assert.equal(action.label, SIMULATED_ACTION_LABELS[action.code]);
    assert.equal(action.formulaVersion, DEMO_OUTCOME_FORMULA_VERSION);
    assert.match(action.explanation, /illustrative|not.+policy result|not.+decision/i);
    assert.deepEqual(action, simulatedWorkflowActionForLead(item.leadId));
  }
});
