import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import {
  DEFAULT_CHECK_POLICY,
  calculatePolicyCheck,
  computeRiskIndex,
  validateCheckPolicy
} from "../src/investment-policy.mjs";

function policyContext() {
  return { identityConfirmed: true, thesisMatch: true, complianceHold: false };
}

function syntheticScore({ founder = 70, market = 70, product = 70, revenue = 70, evidence = 70, mode = "REVIEWED" } = {}) {
  const rows = [
    ["FOUNDER_EXECUTION", founder, 0.18],
    ["MARKET_PROBLEM_PULL", market, 0.25],
    ["PRODUCT_TECHNICAL_FIT", product, 0.23],
    ["EVIDENCE_QUALITY", evidence, 0.14],
    ["REVENUE_PLAUSIBILITY", revenue, 0.2]
  ];
  return {
    mode,
    coverage: { score: 0.9 },
    uncertainty: { points: 18 },
    dimensions: rows.map(([key, score, compositeWeight]) => ({
      key,
      score,
      coverage: 0.9,
      confidence: 0.7,
      compositeWeight
    })),
    contradictions: { open: [] }
  };
}

test("the frozen public-source Emovo demo deterministically clears the fixed USD 100K policy gate", () => {
  const assessment = createEmovoDemoAssessment();
  const output = calculatePolicyCheck(assessment.reviewedScore, DEFAULT_CHECK_POLICY, policyContext());

  assert.equal(output.eligibility.status, "POLICY_ELIGIBLE_FOR_HUMAN_REVIEW");
  assert.equal(output.amount, 100_000);
  assert.equal(output.currency, "USD");
  assert.equal(output.binding, false);
  assert.equal(output.fundsReserved, false);
  assert.equal(output.transferAuthorized, false);
  assert.equal(assessment.reviewedScore.coverage.missingCriteria.includes("REVENUE_PLAUSIBILITY:UNIT_ECONOMICS"), true);
});

test("fixed mode accepts another configured check without changing evidence gates", () => {
  const score = syntheticScore();
  const output = calculatePolicyCheck(score, {
    ...DEFAULT_CHECK_POLICY,
    fixedAmount: 150_000
  }, policyContext());
  assert.equal(output.amount, 150_000);
  assert.equal(output.riskIndex, null);
});

test("missing evidence, provisional mode, unconfirmed policy prerequisites, and contradictions pause sizing", () => {
  const cases = [
    [syntheticScore({ founder: 54.9 }), policyContext(), "FOUNDER_EXECUTION"],
    [syntheticScore({ mode: "PROVISIONAL" }), policyContext(), "Reviewed evidence mode"],
    [syntheticScore(), { ...policyContext(), identityConfirmed: false }, "Entity identity confirmed"],
    [syntheticScore(), { identityConfirmed: true, complianceHold: false }, "Thesis match confirmed"],
    [syntheticScore(), { identityConfirmed: true, thesisMatch: true }, "No compliance hold"],
    [{ ...syntheticScore(), contradictions: { open: [{ id: "C1" }] } }, policyContext(), "No open material contradictions"]
  ];
  for (const [score, context, failedGate] of cases) {
    const output = calculatePolicyCheck(score, DEFAULT_CHECK_POLICY, context);
    assert.equal(output.amount, null);
    assert.equal(output.eligibility.status, "REQUEST_EVIDENCE");
    assert.ok(output.eligibility.failed.includes(failedGate));
  }
});

test("risk-adjusted sizing uses only market, product, and revenue risk after gates pass", () => {
  const policy = { ...DEFAULT_CHECK_POLICY, mode: "RISK_ADJUSTED" };
  const lowRisk = syntheticScore({ market: 70, product: 70, revenue: 70 });
  const middleRisk = syntheticScore({ market: 70, product: 70, revenue: 69.7 });
  const higherRisk = syntheticScore({ market: 58, product: 58, revenue: 58 });
  const highestEligibleRisk = syntheticScore({ market: 58, product: 57.75, revenue: 58 });

  assert.equal(computeRiskIndex(lowRisk), 30);
  assert.equal(calculatePolicyCheck(lowRisk, policy, policyContext()).amount, 100_000);
  assert.equal(computeRiskIndex(middleRisk), 30.1);
  assert.equal(calculatePolicyCheck(middleRisk, policy, policyContext()).amount, 75_000);
  assert.equal(computeRiskIndex(higherRisk), 42);
  assert.equal(calculatePolicyCheck(higherRisk, policy, policyContext()).amount, 75_000);
  assert.equal(computeRiskIndex(highestEligibleRisk), 42.1);
  assert.equal(calculatePolicyCheck(highestEligibleRisk, policy, policyContext()).amount, 50_000);

  const founderMutation = structuredClone(middleRisk);
  founderMutation.dimensions.find((item) => item.key === "FOUNDER_EXECUTION").score = 99;
  assert.equal(computeRiskIndex(founderMutation), computeRiskIndex(middleRisk));
  assert.equal(
    calculatePolicyCheck(founderMutation, policy, policyContext()).amount,
    calculatePolicyCheck(middleRisk, policy, policyContext()).amount
  );
});

test("policy configuration rejects unknown scoring controls and invalid money settings", () => {
  assert.throws(
    () => validateCheckPolicy({ ...DEFAULT_CHECK_POLICY, founderWeight: 0.9 }),
    /unknown field founderWeight/
  );
  assert.throws(
    () => validateCheckPolicy({ ...DEFAULT_CHECK_POLICY, currency: "BTC" }),
    /currency/
  );
  assert.throws(
    () => validateCheckPolicy({ ...DEFAULT_CHECK_POLICY, fixedAmount: 100_001 }),
    /divisible/
  );
  assert.throws(
    () => validateCheckPolicy({ ...DEFAULT_CHECK_POLICY, minimumAmount: 125_000 }),
    /minimumAmount <= baseAmount <= maximumAmount/
  );
});
