export const CHECK_POLICY_VERSION = "proofline.check-sizing.v1";

const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "CHF", "GBP"]);
const MODES = new Set(["FIXED", "RISK_ADJUSTED"]);

export const DEFAULT_CHECK_POLICY = Object.freeze({
  mode: "FIXED",
  currency: "USD",
  fixedAmount: 100_000,
  baseAmount: 100_000,
  minimumAmount: 50_000,
  maximumAmount: 100_000,
  increment: 25_000
});

export const ELIGIBILITY_FLOORS = Object.freeze({
  FOUNDER_EXECUTION: 55,
  MARKET_PROBLEM_PULL: 55,
  PRODUCT_TECHNICAL_FIT: 55,
  REVENUE_PLAUSIBILITY: 50,
  // This diagnostic is already coverage-adjusted by the scoring engine. The
  // separate 70% coverage and 50% confidence gates prevent double-penalizing
  // the same missingness while still requiring a multi-source evidence pack.
  EVIDENCE_QUALITY: 40,
  coverage: 0.7,
  confidence: 0.5,
  maximumUncertainty: 25
});

const RISK_BANDS = Object.freeze([
  Object.freeze({ maximumRisk: 30, multiplier: 1 }),
  Object.freeze({ maximumRisk: 42, multiplier: 0.75 }),
  Object.freeze({ maximumRisk: 55, multiplier: 0.5 })
]);

function integer(value, label, minimum = 1, maximum = 10_000_000) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

export function validateCheckPolicy(candidate = DEFAULT_CHECK_POLICY) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Check policy must be an object.");
  }
  const allowed = new Set([
    "mode",
    "currency",
    "fixedAmount",
    "baseAmount",
    "minimumAmount",
    "maximumAmount",
    "increment"
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) throw new Error(`Check policy contains unknown field ${key}.`);
  }
  const policy = { ...DEFAULT_CHECK_POLICY, ...candidate };
  if (!MODES.has(policy.mode)) throw new Error("Check policy mode must be FIXED or RISK_ADJUSTED.");
  if (!SUPPORTED_CURRENCIES.has(policy.currency)) {
    throw new Error("Check policy currency must be USD, EUR, CHF, or GBP.");
  }
  integer(policy.increment, "increment", 1_000, 1_000_000);
  for (const field of ["fixedAmount", "baseAmount", "minimumAmount", "maximumAmount"]) {
    integer(policy[field], field, 5_000, 10_000_000);
    if (policy[field] % policy.increment !== 0) {
      throw new Error(`${field} must be divisible by increment.`);
    }
  }
  if (policy.minimumAmount > policy.baseAmount || policy.baseAmount > policy.maximumAmount) {
    throw new Error("Risk-adjusted amounts must satisfy minimumAmount <= baseAmount <= maximumAmount.");
  }
  return Object.freeze(policy);
}

function dimension(score, key) {
  return score?.dimensions?.find((item) => item.key === key) || null;
}

function weightedConfidence(score) {
  const dimensions = Array.isArray(score?.dimensions) ? score.dimensions : [];
  const totalWeight = dimensions.reduce((sum, item) => sum + (Number(item.compositeWeight) || 0), 0);
  if (!totalWeight) return 0;
  return dimensions.reduce(
    (sum, item) => sum + (Number(item.confidence) || 0) * (Number(item.compositeWeight) || 0),
    0
  ) / totalWeight;
}

function gate(label, passed, actual, required) {
  return { label, passed, actual, required };
}

export function evaluateCheckEligibility(score, context = {}) {
  const gates = [];
  gates.push(gate("Reviewed evidence mode", score?.mode === "REVIEWED", score?.mode || null, "REVIEWED"));
  gates.push(gate("Entity identity confirmed", context.identityConfirmed === true, Boolean(context.identityConfirmed), true));
  gates.push(gate("Thesis match confirmed", context.thesisMatch === true, context.thesisMatch ?? null, true));
  gates.push(gate("No compliance hold", context.complianceHold === false, context.complianceHold ?? null, false));
  const openContradictions = score?.contradictions?.open?.length ?? 0;
  gates.push(gate("No open material contradictions", openContradictions === 0, openContradictions, 0));

  for (const key of [
    "FOUNDER_EXECUTION",
    "MARKET_PROBLEM_PULL",
    "PRODUCT_TECHNICAL_FIT",
    "REVENUE_PLAUSIBILITY",
    "EVIDENCE_QUALITY"
  ]) {
    const actual = dimension(score, key)?.score ?? null;
    gates.push(gate(key, Number.isFinite(actual) && actual >= ELIGIBILITY_FLOORS[key], actual, ELIGIBILITY_FLOORS[key]));
  }

  const coverage = Number(score?.coverage?.score) || 0;
  const confidence = weightedConfidence(score);
  const uncertainty = Number(score?.uncertainty?.points);
  gates.push(gate("Overall evidence coverage", coverage >= ELIGIBILITY_FLOORS.coverage, coverage, ELIGIBILITY_FLOORS.coverage));
  gates.push(gate("Overall source confidence", confidence >= ELIGIBILITY_FLOORS.confidence, confidence, ELIGIBILITY_FLOORS.confidence));
  gates.push(gate(
    "Maximum uncertainty",
    Number.isFinite(uncertainty) && uncertainty <= ELIGIBILITY_FLOORS.maximumUncertainty,
    Number.isFinite(uncertainty) ? uncertainty : null,
    ELIGIBILITY_FLOORS.maximumUncertainty
  ));

  const failed = gates.filter((item) => !item.passed);
  return {
    eligible: failed.length === 0,
    status: failed.length ? "REQUEST_EVIDENCE" : "POLICY_ELIGIBLE_FOR_HUMAN_REVIEW",
    gates,
    failed: failed.map((item) => item.label),
    coverage,
    confidence
  };
}

export function computeRiskIndex(score) {
  const market = dimension(score, "MARKET_PROBLEM_PULL")?.score;
  const product = dimension(score, "PRODUCT_TECHNICAL_FIT")?.score;
  const revenue = dimension(score, "REVENUE_PLAUSIBILITY")?.score;
  if (![market, product, revenue].every(Number.isFinite)) return null;
  return Math.round((0.25 * (100 - market) + 0.4 * (100 - product) + 0.35 * (100 - revenue)) * 10) / 10;
}

function steppedDown(value, increment) {
  return Math.floor(value / increment) * increment;
}

export function calculatePolicyCheck(score, policyCandidate = DEFAULT_CHECK_POLICY, context = {}) {
  const policy = validateCheckPolicy(policyCandidate);
  const eligibility = evaluateCheckEligibility(score, context);
  const base = {
    policyVersion: CHECK_POLICY_VERSION,
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    mode: policy.mode,
    currency: policy.currency,
    eligibility
  };
  if (!eligibility.eligible) {
    return { ...base, amount: null, riskIndex: null, riskBand: null };
  }
  if (policy.mode === "FIXED") {
    return { ...base, amount: policy.fixedAmount, riskIndex: null, riskBand: "FIXED" };
  }

  const riskIndex = computeRiskIndex(score);
  const band = RISK_BANDS.find((item) => riskIndex != null && riskIndex <= item.maximumRisk);
  if (!band) {
    return {
      ...base,
      amount: null,
      riskIndex,
      riskBand: "OUTSIDE_RISK_APPETITE",
      eligibility: {
        ...eligibility,
        eligible: false,
        status: "HUMAN_REVIEW",
        failed: [...eligibility.failed, "Risk index outside configured appetite"]
      }
    };
  }
  const raw = policy.baseAmount * band.multiplier;
  const stepped = steppedDown(raw, policy.increment);
  const amount = Math.max(policy.minimumAmount, Math.min(policy.maximumAmount, stepped));
  return {
    ...base,
    amount,
    riskIndex,
    riskBand: `UP_TO_${band.maximumRisk}`,
    multiplier: band.multiplier
  };
}
