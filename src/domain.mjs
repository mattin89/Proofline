export const AXES = Object.freeze(["FOUNDER", "MARKET", "IDEA_MARKET"]);

export const DECISION_LABELS = Object.freeze({
  REQUEST_PROOF: "Request evidence",
  INVESTIGATE: "Continue diligence",
  HUMAN_HOLD: "Human review required",
  PASS: "Pass current thesis",
  RECOMMEND: "Policy screen eligible",
  FINALIZED: "Policy record frozen"
});

const ALLOWED_FOUNDER_DIMENSIONS = Object.freeze([
  "EXECUTION",
  "LEARNING",
  "EVIDENCE_DISCIPLINE",
  "DOMAIN_DEPTH"
]);

const ALLOWED_FOUNDER_OBSERVATION_FIELDS = new Set([
  "id",
  "dimension",
  "score",
  "evidenceQuality",
  "independenceGroup",
  "observedAt",
  "source",
  "description",
  "evidenceIds"
]);

const ALLOWED_FOUNDER_OBSERVATION_SOURCES = new Set([
  "PROOF_TASK",
  "VERIFIED_ARTIFACT",
  "STRUCTURED_REFERENCE",
  "PUBLIC_WORK"
]);

const ALLOWED_EVIDENCE_FIELDS = new Set([
  "id",
  "kind",
  "title",
  "sourceUrl",
  "excerpt",
  "capturedAt",
  "validAt",
  "independenceGroup",
  "entityMatchConfidence",
  "directness",
  "temporalFit",
  "sourceReliability",
  "recency",
  "reviewState",
  "syntheticFixture",
  "identityState",
  "origin",
  "retractedAt",
  "retractionReason"
]);

const ALLOWED_EVIDENCE_KINDS = new Set([
  "OFFICIAL_PRIMARY",
  "VERIFIED_ARTIFACT",
  "REPUTABLE_SECONDARY",
  "SELF_REPORT",
  "PUBLIC_WORK",
  "MODEL_INFERENCE",
  "SYNTHETIC_DEMO"
]);

const ALLOWED_CLAIM_FIELDS = new Set([
  "id",
  "statement",
  "type",
  "axis",
  "materiality",
  "decisionCritical",
  "observedAt",
  "evidenceLinks"
]);
const ALLOWED_CLAIM_LINK_FIELDS = new Set(["evidenceId", "stance"]);
const ALLOWED_AXIS_FIELDS = new Set(["label", "trend", "dimensions"]);
const ALLOWED_AXIS_DIMENSION_FIELDS = new Set([
  "key",
  "label",
  "value",
  "confidence",
  "weight",
  "claimIds",
  "useFounderScore"
]);
const ALLOWED_CONTRADICTION_FIELDS = new Set([
  "id",
  "claimIds",
  "evidenceIds",
  "severity",
  "status",
  "title",
  "note",
  "resolutionNote",
  "resolvedAt"
]);
const ALLOWED_THESIS_FIELDS = new Set([
  "id",
  "version",
  "name",
  "sectors",
  "stages",
  "geographies",
  "checkSize",
  "ownershipMinPct",
  "ownershipMaxPct",
  "riskAppetite",
  "hardExclusions",
  "axisRecommendFloors",
  "axisRejectFloors",
  "decisionHorizonHours"
]);
const ALLOWED_CHECK_SIZE_FIELDS = new Set(["min", "max", "currency"]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value, allowedKeys, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`${label} contains inadmissible field(s): ${unknown.join(", ")}.`);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
}

function assertFiniteRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
}

function assertOptionalDate(value, label) {
  if (value != null && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) {
    throw new Error(`${label} must be an ISO-compatible timestamp.`);
  }
}

export function assertFounderObservationAdmissible(observation) {
  assertAllowedKeys(observation, ALLOWED_FOUNDER_OBSERVATION_FIELDS, "Founder observation");
  assertNonEmptyString(observation.id, "Founder observation id");
  if (!ALLOWED_FOUNDER_DIMENSIONS.includes(observation.dimension)) {
    throw new Error(`Founder observation dimension ${String(observation.dimension)} is not allowed.`);
  }
  if (!ALLOWED_FOUNDER_OBSERVATION_SOURCES.has(observation.source)) {
    throw new Error(`Founder observation source ${String(observation.source)} is not admissible.`);
  }
  assertFiniteRange(observation.score, 0, 100, "Founder observation score");
  assertFiniteRange(observation.evidenceQuality, 0, 1, "Founder observation evidence quality");
  assertNonEmptyString(observation.independenceGroup, "Founder observation independence group");
  assertNonEmptyString(observation.description, "Founder observation description");
  assertStringArray(observation.evidenceIds, "Founder observation evidenceIds", { allowEmpty: false });
  assertOptionalDate(observation.observedAt, "Founder observation timestamp");
  if (!observation.observedAt) throw new Error("Founder observation timestamp is required.");
  return true;
}

export function assertEvidenceAdmissible(evidence) {
  assertAllowedKeys(evidence, ALLOWED_EVIDENCE_FIELDS, "Evidence");
  assertNonEmptyString(evidence.id, "Evidence id");
  if (!ALLOWED_EVIDENCE_KINDS.has(evidence.kind)) {
    throw new Error(`Evidence kind ${String(evidence.kind)} is not admissible.`);
  }
  assertNonEmptyString(evidence.independenceGroup, "Evidence independence group");
  for (const [field, label] of [
    ["entityMatchConfidence", "entity-match confidence"],
    ["directness", "directness"],
    ["temporalFit", "temporal fit"],
    ["sourceReliability", "source reliability"],
    ["recency", "recency"]
  ]) {
    if (evidence[field] != null) assertFiniteRange(evidence[field], 0, 1, `Evidence ${label}`);
  }
  assertOptionalDate(evidence.capturedAt, "Evidence capture timestamp");
  assertOptionalDate(evidence.validAt, "Evidence validity timestamp");
  assertOptionalDate(evidence.retractedAt, "Evidence retraction timestamp");
  if (evidence.sourceUrl != null) {
    let parsed;
    try {
      parsed = new URL(evidence.sourceUrl);
    } catch {
      throw new Error("Evidence source URL must be valid.");
    }
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
      throw new Error("Evidence source URL must use HTTP or HTTPS.");
    }
  }
  if (evidence.reviewState != null && !new Set(["VERIFIED", "UNREVIEWED"]).has(evidence.reviewState)) {
    throw new Error(`Evidence review state ${String(evidence.reviewState)} is not allowed.`);
  }
  if (evidence.syntheticFixture != null && typeof evidence.syntheticFixture !== "boolean") {
    throw new Error("Evidence syntheticFixture must be boolean.");
  }
  if (evidence.origin != null && evidence.origin !== "EXTERNAL_LIVE_LEAD") {
    throw new Error(`Evidence origin ${String(evidence.origin)} is not allowed.`);
  }
  return true;
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function evidenceQuality(evidence) {
  if (!evidence) return 0;
  assertEvidenceAdmissible(evidence);
  if (evidence.retractedAt || evidence.reviewState === "UNREVIEWED") return 0;

  const score =
    0.35 * clamp(evidence.sourceReliability ?? 0) +
    0.25 * clamp(evidence.directness ?? 0) +
    0.15 * clamp(evidence.temporalFit ?? 0) +
    0.15 * clamp(evidence.entityMatchConfidence ?? 0) +
    0.1 * clamp(evidence.recency ?? 0);

  let cap = 1;
  if (!evidence.sourceUrl || !evidence.excerpt || !evidence.capturedAt) cap = Math.min(cap, 0.35);
  if (evidence.kind === "MODEL_INFERENCE") cap = Math.min(cap, 0.3);
  if (evidence.kind === "SYNTHETIC_DEMO") cap = Math.min(cap, 0.4);
  if (evidence.identityState && evidence.identityState !== "CONFIRMED") cap = Math.min(cap, 0.49);

  return round(clamp(Math.min(score, cap)) * 100);
}

export function aggregateEvidenceStrength(evidenceItems) {
  const bestByIndependentGroup = new Map();
  for (const evidence of evidenceItems) {
    const quality = evidenceQuality(evidence);
    if (quality <= 0) continue;
    const group = evidence.independenceGroup || evidence.id;
    const existing = bestByIndependentGroup.get(group);
    if (!existing || quality > existing.quality) {
      bestByIndependentGroup.set(group, { evidence, quality });
    }
  }
  const qualities = [...bestByIndependentGroup.values()]
    .map((item) => item.quality)
    .sort((a, b) => b - a);
  if (!qualities.length) return { strength: 0, independentGroups: 0, qualities: [] };
  const strength = clamp(qualities[0] + Math.max(0, qualities.length - 1) * 8, 0, 100);
  return {
    strength: round(strength),
    independentGroups: qualities.length,
    qualities
  };
}

export function computeClaimTrust(claim, evidenceById, contradictions = []) {
  const supporting = [];
  const opposing = [];
  const context = [];

  for (const link of claim.evidenceLinks || []) {
    const evidence = evidenceById.get(link.evidenceId);
    if (!evidence) continue;
    if (link.stance === "support") supporting.push(evidence);
    else if (link.stance === "oppose") opposing.push(evidence);
    else context.push(evidence);
  }

  const support = aggregateEvidenceStrength(supporting);
  const oppose = aggregateEvidenceStrength(opposing);
  const openMaterialContradiction = contradictions.some(
    (item) =>
      item.status === "OPEN" &&
      (item.severity === "HIGH" || item.severity === "MEDIUM") &&
      item.claimIds?.includes(claim.id)
  );

  let status = "UNVERIFIED";
  let score = support.strength;

  if (support.strength >= 55 && oppose.strength >= 55) {
    status = "CONTESTED";
    score = Math.min(59, support.strength * (1 - 0.45 * (oppose.strength / 100)));
  } else if (oppose.strength >= 65 && oppose.strength - support.strength >= 20) {
    status = "REFUTED";
    score = Math.max(5, support.strength * 0.25);
  } else if (support.strength >= 70 && support.strength - oppose.strength >= 20) {
    status = "SUPPORTED";
  } else if (support.strength >= 40) {
    status = "PARTIAL";
  }

  if (openMaterialContradiction) {
    status = "CONTESTED";
    score = Math.min(score, 59);
  }

  score = round(clamp(score, 0, 100));
  const label =
    status === "SUPPORTED"
      ? score >= 85
        ? "Directly validated"
        : "Corroborated"
      : status === "CONTESTED"
        ? "Contested"
        : status === "REFUTED"
          ? "Refuted"
          : status === "PARTIAL"
            ? "Partial"
            : "Unsupported / unknown";

  return {
    score,
    status,
    label,
    supportingStrength: support.strength,
    opposingStrength: oppose.strength,
    independentSupportingGroups: support.independentGroups,
    independentOpposingGroups: oppose.independentGroups,
    supporting,
    opposing,
    context,
    openMaterialContradiction
  };
}

export function computeFounderScore(observations = [], evidenceById = null) {
  const byDimension = new Map();

  for (const observation of observations) {
    assertFounderObservationAdmissible(observation);
    const linkedQualities =
      evidenceById instanceof Map
        ? observation.evidenceIds.map((evidenceId) => evidenceQuality(evidenceById.get(evidenceId)) / 100)
        : [];
    if (linkedQualities.some((quality) => quality <= 0)) continue;
    const effectiveObservation = linkedQualities.length
      ? { ...observation, evidenceQuality: Math.min(observation.evidenceQuality, ...linkedQualities) }
      : observation;
    const group = effectiveObservation.independenceGroup || effectiveObservation.id;
    if (!byDimension.has(effectiveObservation.dimension)) byDimension.set(effectiveObservation.dimension, new Map());
    const dimensionGroups = byDimension.get(effectiveObservation.dimension);
    const existing = dimensionGroups.get(group);
    if (!existing || effectiveObservation.evidenceQuality > existing.evidenceQuality) {
      dimensionGroups.set(group, effectiveObservation);
    }
  }

  const dimensions = {};
  for (const dimension of ALLOWED_FOUNDER_DIMENSIONS) {
    const grouped = [...(byDimension.get(dimension)?.values() || [])];
    if (!grouped.length) continue;
    const totalWeight = grouped.reduce((sum, item) => sum + clamp(item.evidenceQuality), 0);
    const weighted = grouped.reduce(
      (sum, item) => sum + clamp(item.score, 0, 100) * clamp(item.evidenceQuality),
      0
    );
    const dimensionScore = (50 * 2 + weighted) / (2 + totalWeight);
    const confidence = 1 - Math.exp(-totalWeight / 3);
    dimensions[dimension] = {
      score: round(dimensionScore),
      confidence: round(confidence, 2),
      observations: grouped.length
    };
  }

  const available = Object.values(dimensions);
  const coverage = available.length / ALLOWED_FOUNDER_DIMENSIONS.length;
  const overall =
    available.length >= 3
      ? round(available.reduce((sum, item) => sum + item.score, 0) / available.length)
      : null;
  const meanConfidence = available.length
    ? available.reduce((sum, item) => sum + item.confidence, 0) / available.length
    : 0;
  const confidence = round(coverage * meanConfidence, 2);
  const uncertainty = overall == null ? null : Math.max(6, round(24 * (1 - confidence)));

  return {
    score: overall,
    coverage: round(coverage, 2),
    confidence,
    uncertaintyBand: uncertainty,
    dimensions
  };
}

function weightedMean(items, valueAccessor, weightAccessor) {
  const totalWeight = items.reduce((sum, item) => sum + weightAccessor(item), 0);
  if (!totalWeight) return null;
  return items.reduce((sum, item) => sum + valueAccessor(item) * weightAccessor(item), 0) / totalWeight;
}

function assertStringArray(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
  }
  for (const item of value) assertNonEmptyString(item, `${label} item`);
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    assertNonEmptyString(item?.id, `${label} id`);
    if (seen.has(item.id)) throw new Error(`${label} id ${item.id} is duplicated.`);
    seen.add(item.id);
  }
  return seen;
}

function assertClaimAdmissible(claim, evidenceIds) {
  assertAllowedKeys(claim, ALLOWED_CLAIM_FIELDS, "Claim");
  assertNonEmptyString(claim.id, "Claim id");
  assertNonEmptyString(claim.statement, "Claim statement");
  if (!AXES.includes(claim.axis)) throw new Error(`Claim axis ${String(claim.axis)} is not allowed.`);
  if (!new Set(["FACT", "FOUNDER_STATEMENT", "ESTIMATE", "MODEL_INFERENCE", "UNKNOWN"]).has(claim.type)) {
    throw new Error(`Claim type ${String(claim.type)} is not allowed.`);
  }
  if (!new Set(["LOW", "MEDIUM", "HIGH"]).has(claim.materiality)) {
    throw new Error(`Claim materiality ${String(claim.materiality)} is not allowed.`);
  }
  if (typeof claim.decisionCritical !== "boolean") throw new Error("Claim decisionCritical must be boolean.");
  assertOptionalDate(claim.observedAt, "Claim observation timestamp");
  if (!claim.observedAt) throw new Error("Claim observation timestamp is required.");
  if (!Array.isArray(claim.evidenceLinks)) throw new Error("Claim evidenceLinks must be an array.");
  for (const link of claim.evidenceLinks) {
    assertAllowedKeys(link, ALLOWED_CLAIM_LINK_FIELDS, "Claim evidence link");
    assertNonEmptyString(link.evidenceId, "Claim evidence id");
    if (!evidenceIds.has(link.evidenceId)) throw new Error(`Claim references unknown evidence ${link.evidenceId}.`);
    if (!new Set(["support", "oppose", "context"]).has(link.stance)) {
      throw new Error(`Claim evidence stance ${String(link.stance)} is not allowed.`);
    }
  }
}

function assertAxisInputsAdmissible(axisInputs, claimIds) {
  if (!isPlainObject(axisInputs)) throw new Error("Axis inputs must be an object.");
  const unknownAxes = Object.keys(axisInputs).filter((key) => !AXES.includes(key));
  if (unknownAxes.length) throw new Error(`Axis inputs contain unknown axes: ${unknownAxes.join(", ")}.`);
  for (const axisName of AXES) {
    const axis = axisInputs[axisName];
    if (!axis) throw new Error(`Axis inputs are missing ${axisName}.`);
    assertAllowedKeys(axis, ALLOWED_AXIS_FIELDS, `${axisName} axis`);
    assertNonEmptyString(axis.label, `${axisName} axis label`);
    if (!new Set(["UP", "FLAT", "DOWN", "UNKNOWN"]).has(axis.trend)) {
      throw new Error(`${axisName} axis trend ${String(axis.trend)} is not allowed.`);
    }
    if (!Array.isArray(axis.dimensions) || !axis.dimensions.length) {
      throw new Error(`${axisName} axis must have at least one dimension.`);
    }
    const keys = new Set();
    for (const dimension of axis.dimensions) {
      assertAllowedKeys(dimension, ALLOWED_AXIS_DIMENSION_FIELDS, `${axisName} dimension`);
      assertNonEmptyString(dimension.key, `${axisName} dimension key`);
      assertNonEmptyString(dimension.label, `${axisName} dimension label`);
      if (keys.has(dimension.key)) throw new Error(`${axisName} dimension ${dimension.key} is duplicated.`);
      keys.add(dimension.key);
      assertFiniteRange(dimension.weight, Number.EPSILON, 1, `${axisName} dimension weight`);
      if (dimension.value != null) assertFiniteRange(dimension.value, 0, 100, `${axisName} dimension value`);
      if (dimension.confidence != null) {
        assertFiniteRange(dimension.confidence, 0, 1, `${axisName} dimension confidence`);
      }
      if (dimension.useFounderScore != null && typeof dimension.useFounderScore !== "boolean") {
        throw new Error(`${axisName} dimension useFounderScore must be boolean.`);
      }
      if (dimension.claimIds != null) {
        assertStringArray(dimension.claimIds, `${axisName} dimension claimIds`);
        for (const claimId of dimension.claimIds) {
          if (!claimIds.has(claimId)) throw new Error(`${axisName} dimension references unknown claim ${claimId}.`);
        }
      }
    }
    const totalWeight = axis.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.000001) {
      throw new Error(`${axisName} dimension weights must sum to 1.`);
    }
  }
  const founderScoreWiring = AXES.flatMap((axisName) =>
    axisInputs[axisName].dimensions
      .filter((dimension) => dimension.useFounderScore)
      .map((dimension) => ({ axisName, key: dimension.key }))
  );
  if (
    founderScoreWiring.length !== 1 ||
    founderScoreWiring[0].axisName !== "FOUNDER" ||
    founderScoreWiring[0].key !== "persistent_evidence"
  ) {
    throw new Error("Persistent Founder Score must appear exactly once in FOUNDER.persistent_evidence.");
  }
}

function assertContradictionAdmissible(contradiction, claimIds, evidenceIds) {
  assertAllowedKeys(contradiction, ALLOWED_CONTRADICTION_FIELDS, "Contradiction");
  assertNonEmptyString(contradiction.id, "Contradiction id");
  assertStringArray(contradiction.claimIds, "Contradiction claimIds", { allowEmpty: false });
  assertStringArray(contradiction.evidenceIds, "Contradiction evidenceIds", { allowEmpty: false });
  for (const claimId of contradiction.claimIds) {
    if (!claimIds.has(claimId)) throw new Error(`Contradiction references unknown claim ${claimId}.`);
  }
  for (const evidenceId of contradiction.evidenceIds) {
    if (!evidenceIds.has(evidenceId)) throw new Error(`Contradiction references unknown evidence ${evidenceId}.`);
  }
  if (!new Set(["LOW", "MEDIUM", "HIGH"]).has(contradiction.severity)) {
    throw new Error(`Contradiction severity ${String(contradiction.severity)} is not allowed.`);
  }
  if (!new Set(["OPEN", "TEMPORALLY_RECONCILED", "DEFINITION_MISMATCH", "SOURCE_RETRACTED", "HUMAN_RESOLVED"]).has(contradiction.status)) {
    throw new Error(`Contradiction status ${String(contradiction.status)} is not allowed.`);
  }
  assertOptionalDate(contradiction.resolvedAt, "Contradiction resolution timestamp");
}

export function assertDecisionScoringPayloadAdmissible(opportunity) {
  if (!isPlainObject(opportunity)) throw new Error("Opportunity must be an object.");
  const evidence = opportunity.evidence || [];
  const observations = opportunity.founderObservations || [];
  const claims = opportunity.claims || [];
  const contradictions = opportunity.contradictions || [];
  if (!Array.isArray(evidence) || !Array.isArray(observations) || !Array.isArray(claims) || !Array.isArray(contradictions)) {
    throw new Error("Opportunity decision collections must be arrays.");
  }
  const evidenceIds = assertUniqueIds(evidence, "Evidence");
  evidence.forEach(assertEvidenceAdmissible);
  assertUniqueIds(observations, "Founder observation");
  observations.forEach(assertFounderObservationAdmissible);
  for (const observation of observations) {
    for (const evidenceId of observation.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(`Founder observation ${observation.id} references unknown evidence ${evidenceId}.`);
      }
    }
  }
  const claimIds = assertUniqueIds(claims, "Claim");
  claims.forEach((claim) => assertClaimAdmissible(claim, evidenceIds));
  assertAxisInputsAdmissible(opportunity.axisInputs, claimIds);
  assertUniqueIds(contradictions, "Contradiction");
  contradictions.forEach((item) => assertContradictionAdmissible(item, claimIds, evidenceIds));
  return true;
}

export function assertThesisAdmissible(thesis) {
  assertAllowedKeys(thesis, ALLOWED_THESIS_FIELDS, "Thesis");
  assertNonEmptyString(thesis.id, "Thesis id");
  if (!Number.isInteger(thesis.version) || thesis.version < 1) throw new Error("Thesis version must be a positive integer.");
  assertNonEmptyString(thesis.name, "Thesis name");
  assertStringArray(thesis.sectors, "Thesis sectors", { allowEmpty: false });
  assertStringArray(thesis.stages, "Thesis stages", { allowEmpty: false });
  assertStringArray(thesis.geographies, "Thesis geographies", { allowEmpty: false });
  assertAllowedKeys(thesis.checkSize, ALLOWED_CHECK_SIZE_FIELDS, "Thesis check size");
  assertFiniteRange(thesis.checkSize.min, 1, Number.MAX_SAFE_INTEGER, "Thesis minimum check size");
  assertFiniteRange(thesis.checkSize.max, 1, Number.MAX_SAFE_INTEGER, "Thesis maximum check size");
  if (thesis.checkSize.min > thesis.checkSize.max) throw new Error("Thesis check-size minimum cannot exceed maximum.");
  assertNonEmptyString(thesis.checkSize.currency, "Thesis check-size currency");
  assertFiniteRange(thesis.ownershipMinPct, 0, 100, "Thesis minimum ownership");
  assertFiniteRange(thesis.ownershipMaxPct, 0, 100, "Thesis maximum ownership");
  if (thesis.ownershipMinPct > thesis.ownershipMaxPct) {
    throw new Error("Thesis ownership minimum cannot exceed maximum.");
  }
  assertNonEmptyString(thesis.riskAppetite, "Thesis risk appetite");
  assertStringArray(thesis.hardExclusions, "Thesis hard exclusions");
  for (const [label, floors] of [
    ["recommendation", thesis.axisRecommendFloors],
    ["rejection", thesis.axisRejectFloors]
  ]) {
    if (!isPlainObject(floors) || Object.keys(floors).length !== AXES.length) {
      throw new Error(`Thesis ${label} floors must cover all three axes.`);
    }
    for (const axisName of AXES) {
      assertFiniteRange(floors[axisName], 0, 100, `Thesis ${label} floor for ${axisName}`);
    }
  }
  assertFiniteRange(thesis.decisionHorizonHours, 1, 168, "Thesis decision horizon");
  return true;
}

export function computeAxis(axisName, opportunity, claimTrustById, founderScore) {
  const definition = opportunity.axisInputs?.[axisName];
  if (!definition) {
    return { axis: axisName, score: null, confidence: 0, coverage: 0, trend: "UNKNOWN", dimensions: [] };
  }

  const dimensions = definition.dimensions.map((dimension) => {
    const value = dimension.useFounderScore ? founderScore.score : dimension.value;
    const baseConfidence = dimension.useFounderScore
      ? founderScore.confidence
      : clamp(dimension.confidence ?? 0.5);
    const claimTrusts = (dimension.claimIds || [])
      .map((claimId) => claimTrustById.get(claimId))
      .filter(Boolean);
    const hasRefutedClaim = claimTrusts.some((trust) => trust.status === "REFUTED");
    const claimConfidence = claimTrusts.length
      ? claimTrusts.reduce(
          (sum, trust) =>
            sum +
            (trust.status === "REFUTED"
              ? trust.opposingStrength / 100
              : trust.score / 100),
          0
        ) / claimTrusts.length
      : 1;
    return {
      ...dimension,
      value: hasRefutedClaim ? 0 : Number.isFinite(value) ? clamp(value, 0, 100) : null,
      effectiveConfidence: round(Math.min(baseConfidence, claimConfidence), 2)
    };
  });

  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const observed = dimensions.filter((item) => Number.isFinite(item.value));
  const observedWeight = observed.reduce((sum, item) => sum + item.weight, 0);
  const coverage = totalWeight ? observedWeight / totalWeight : 0;
  const score =
    coverage >= 0.6
      ? round(weightedMean(observed, (item) => item.value, (item) => item.weight))
      : null;
  const confidence = observed.length
    ? round(
        coverage *
          weightedMean(observed, (item) => item.effectiveConfidence, (item) => item.weight),
        2
      )
    : 0;

  return {
    axis: axisName,
    label: definition.label,
    score,
    confidence,
    coverage: round(coverage, 2),
    trend: definition.trend || "UNKNOWN",
    dimensions
  };
}

export function stripsProhibitedDecisionFields(opportunity) {
  try {
    assertDecisionScoringPayloadAdmissible(opportunity);
    return true;
  } catch {
    return false;
  }
}

function hasObjectiveThesisMismatch(opportunity, thesis) {
  const sectorMatch = opportunity.sectors?.some((sector) => thesis.sectors.includes(sector));
  const stageMatch = thesis.stages.includes(opportunity.companyStage);
  const geographyMatch = thesis.geographies.includes(opportunity.geography);
  return !(sectorMatch && stageMatch && geographyMatch);
}

export function decideOpportunity(opportunity, thesis, axes, claimTrustById) {
  if (!stripsProhibitedDecisionFields(opportunity)) {
    return {
      code: "HUMAN_HOLD",
      label: DECISION_LABELS.HUMAN_HOLD,
      reason: "An inadmissible or unrecognized field entered the decision payload.",
      ruleIds: ["POLICY_PROTECTED_DATA_ISOLATION"],
      blockerClaimIds: []
    };
  }

  const axisMap = new Map(axes.map((axis) => [axis.axis, axis]));
  const activeContract = opportunity.evidenceContracts?.find((contract) =>
    ["PROPOSED", "SENT", "SUBMITTED", "UNDER_REVIEW"].includes(contract.status)
  );
  const highOpenContradiction = opportunity.contradictions?.some(
    (item) => item.status === "OPEN" && item.severity === "HIGH"
  );
  const decisionCriticalClaims = opportunity.claims?.filter((claim) => claim.decisionCritical) || [];
  const unsupportedCriticalClaims = decisionCriticalClaims.filter((claim) => {
    const trust = claimTrustById.get(claim.id);
    return !trust || trust.score < 70 || trust.status !== "SUPPORTED";
  });

  if (opportunity.finalDecision) {
    return {
      code: "FINALIZED",
      label: DECISION_LABELS.FINALIZED,
      reason: opportunity.finalDecision.rationale,
      ruleIds: ["POLICY_RECORD_IMMUTABLE"],
      blockerClaimIds: [],
      frozenDecision: opportunity.finalDecision
    };
  }

  if (opportunity.complianceBlocker || opportunity.identityState === "AMBIGUOUS") {
    return {
      code: "HUMAN_HOLD",
      label: DECISION_LABELS.HUMAN_HOLD,
      reason: opportunity.complianceBlocker
        ? "A compliance blocker requires human resolution."
        : "Founder identity is ambiguous; persistent evidence cannot be inherited.",
      ruleIds: [opportunity.complianceBlocker ? "GATE_COMPLIANCE" : "GATE_IDENTITY"],
      blockerClaimIds: []
    };
  }

  if (hasObjectiveThesisMismatch(opportunity, thesis)) {
    return {
      code: "PASS",
      label: DECISION_LABELS.PASS,
      reason: "The opportunity is outside the configured thesis.",
      ruleIds: ["GATE_THESIS_MATCH"],
      blockerClaimIds: []
    };
  }

  if (activeContract && (unsupportedCriticalClaims.length || highOpenContradiction)) {
    return {
      code: activeContract.status === "PROPOSED" || activeContract.status === "SENT" ? "REQUEST_PROOF" : "INVESTIGATE",
      label:
        activeContract.status === "PROPOSED" || activeContract.status === "SENT"
          ? DECISION_LABELS.REQUEST_PROOF
          : DECISION_LABELS.INVESTIGATE,
      reason:
        activeContract.status === "PROPOSED" || activeContract.status === "SENT"
          ? "A bounded evidence request can resolve a decision-critical gap."
          : "Submitted evidence must be validated before it can affect the decision.",
      ruleIds: ["MISSINGNESS_CREATES_EVIDENCE_PATH"],
      blockerClaimIds: unsupportedCriticalClaims.map((claim) => claim.id)
    };
  }

  if (highOpenContradiction) {
    return {
      code: "HUMAN_HOLD",
      label: DECISION_LABELS.HUMAN_HOLD,
      reason: "A high-severity contradiction remains unresolved.",
      ruleIds: ["GATE_OPEN_CONTRADICTION"],
      blockerClaimIds: unsupportedCriticalClaims.map((claim) => claim.id)
    };
  }

  const rejectAxis = AXES.map((axisName) => ({
    axis: axisMap.get(axisName),
    floor: thesis.axisRejectFloors[axisName]
  })).find(
    ({ axis, floor }) =>
      axis && Number.isFinite(axis.score) && axis.score < floor && axis.confidence >= 0.55
  );
  if (rejectAxis) {
    return {
      code: "PASS",
      label: DECISION_LABELS.PASS,
      reason: `${rejectAxis.axis.label} is below its independent rejection floor; stronger axes cannot compensate.`,
      ruleIds: ["RULE_NON_COMPENSATORY_REJECT"],
      blockerClaimIds: unsupportedCriticalClaims.map((claim) => claim.id)
    };
  }

  const incompleteAxis = axes.find(
    (axis) => !Number.isFinite(axis.score) || axis.coverage < 0.7 || axis.confidence < 0.55
  );
  if (incompleteAxis || unsupportedCriticalClaims.length) {
    return {
      code: "INVESTIGATE",
      label: DECISION_LABELS.INVESTIGATE,
      reason: incompleteAxis
        ? `${incompleteAxis.label} needs more reliable evidence.`
        : "A decision-critical claim remains insufficiently supported.",
      ruleIds: ["GATE_EVIDENCE_SUFFICIENCY"],
      blockerClaimIds: unsupportedCriticalClaims.map((claim) => claim.id)
    };
  }

  const allMeetRecommendFloor = AXES.every((axisName) => {
    const axis = axisMap.get(axisName);
    return axis && Number.isFinite(axis.score) && axis.score >= thesis.axisRecommendFloors[axisName];
  });
  if (allMeetRecommendFloor) {
    return {
      code: "RECOMMEND",
      label: DECISION_LABELS.RECOMMEND,
      reason: "All three independent axes meet the current thesis floors and no evidence-integrity gate is open.",
      ruleIds: ["RULE_ALL_AXES_CLEAR", "RULE_HUMAN_REVIEW_REQUIRED"],
      blockerClaimIds: []
    };
  }

  return {
    code: "INVESTIGATE",
    label: DECISION_LABELS.INVESTIGATE,
    reason: "The evidence is usable, but at least one independent axis remains below its recommendation floor.",
    ruleIds: ["RULE_NON_COMPENSATORY_CONTINUE"],
    blockerClaimIds: []
  };
}

export function founderContextForState(state, opportunity) {
  const scopedEvidence = new Map();
  const scopeObservation = (sourceOpportunity, observation) => {
    const scopedEvidenceIds = observation.evidenceIds.map((evidenceId) => {
      const scopedId = `${sourceOpportunity.id}::${evidenceId}`;
      const evidence = sourceOpportunity.evidence?.find((item) => item.id === evidenceId);
      if (evidence) scopedEvidence.set(scopedId, evidence);
      return scopedId;
    });
    return { ...observation, evidenceIds: scopedEvidenceIds };
  };
  const profile =
    opportunity.identityState === "CONFIRMED"
      ? state.founderProfiles?.find((item) => item.founderId === opportunity.founderId)
      : null;
  const inherited = profile?.observationRefs.flatMap((reference) => {
    const sourceOpportunity = state.opportunities.find((item) => item.id === reference.opportunityId);
    if (
      !sourceOpportunity ||
      sourceOpportunity.identityState !== "CONFIRMED" ||
      sourceOpportunity.founderId !== opportunity.founderId
    ) {
      return [];
    }
    const observation = sourceOpportunity.founderObservations?.find(
      (item) => item.id === reference.observationId
    );
    return observation ? [scopeObservation(sourceOpportunity, observation)] : [];
  });
  const local = (opportunity.founderObservations || []).map((observation) =>
    scopeObservation(opportunity, observation)
  );
  return {
    observations: inherited?.length ? inherited : local,
    evidenceById: scopedEvidence
  };
}

export function computeCase(opportunity, thesis, founderContext = null) {
  const admissible = stripsProhibitedDecisionFields(opportunity);
  const scoringOpportunity = admissible
    ? opportunity
    : { ...opportunity, evidence: [], claims: [], founderObservations: [], axisInputs: {} };
  const evidenceById = new Map((scoringOpportunity.evidence || []).map((item) => [item.id, item]));
  const claimTrustById = new Map();
  const claims = (scoringOpportunity.claims || []).map((claim) => {
    const trust = computeClaimTrust(claim, evidenceById, scoringOpportunity.contradictions || []);
    claimTrustById.set(claim.id, trust);
    return { ...claim, trust };
  });
  const observations = admissible
    ? founderContext?.observations || scoringOpportunity.founderObservations || []
    : [];
  const founderEvidenceById = admissible
    ? founderContext?.evidenceById || evidenceById
    : new Map();
  const founderScore = computeFounderScore(observations, founderEvidenceById);
  const axes = AXES.map((axisName) => computeAxis(axisName, scoringOpportunity, claimTrustById, founderScore));
  const decision = decideOpportunity(opportunity, thesis, axes, claimTrustById);
  const evidenceCoverage = round(
    axes.reduce((sum, axis) => sum + axis.coverage, 0) / Math.max(axes.length, 1),
    2
  );

  return {
    opportunity,
    claims,
    founderScore,
    axes,
    decision,
    evidenceCoverage,
    claimTrustById,
    evidenceById
  };
}

export function computeCaseFromState(state, opportunity) {
  return computeCase(opportunity, state.thesis, founderContextForState(state, opportunity));
}

function updateDimension(opportunity, update) {
  const axis = opportunity.axisInputs?.[update.axis];
  const dimension = axis?.dimensions?.find((item) => item.key === update.key);
  if (!dimension) throw new Error(`Unknown axis dimension ${update.axis}.${update.key}`);
  if (Object.prototype.hasOwnProperty.call(update, "value")) dimension.value = update.value;
  if (Object.prototype.hasOwnProperty.call(update, "confidence")) dimension.confidence = update.confidence;
  if (update.trend) axis.trend = update.trend;
}

function appendTimeline(opportunity, event, label) {
  opportunity.timeline ||= [];
  opportunity.timeline.push({
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    type: event.type,
    label
  });
}

function registerFounderObservation(state, opportunity, observation) {
  if (
    opportunity.identityState !== "CONFIRMED" ||
    typeof opportunity.founderId !== "string" ||
    !opportunity.founderId.trim()
  ) {
    return;
  }
  state.founderProfiles ||= [];
  let profile = state.founderProfiles.find((item) => item.founderId === opportunity.founderId);
  if (!profile) {
    profile = { founderId: opportunity.founderId, observationRefs: [] };
    state.founderProfiles.push(profile);
  }
  const exists = profile.observationRefs.some(
    (reference) =>
      reference.opportunityId === opportunity.id && reference.observationId === observation.id
  );
  if (!exists) {
    profile.observationRefs.push({ opportunityId: opportunity.id, observationId: observation.id });
  }
}

function rebuildFounderProfiles(state) {
  state.founderProfiles = [];
  for (const opportunity of state.opportunities || []) {
    for (const observation of opportunity.founderObservations || []) {
      registerFounderObservation(state, opportunity, observation);
    }
  }
  return state;
}

function assertSyntheticDatasetAdmissible(dataset) {
  if (!isPlainObject(dataset)) throw new Error("Dataset must be an object.");
  if (dataset.synthetic !== true || !String(dataset.datasetVersion || "").startsWith("SYNTHETIC_")) {
    throw new Error("This MVP accepts only explicitly namespaced synthetic datasets.");
  }
  assertNonEmptyString(dataset.watermark, "Synthetic dataset watermark");
  assertThesisAdmissible(dataset.thesis);
  if (!Array.isArray(dataset.opportunities) || !dataset.opportunities.length) {
    throw new Error("Synthetic dataset must contain opportunities.");
  }
  assertUniqueIds(dataset.opportunities, "Opportunity");
  for (const opportunity of dataset.opportunities) {
    if (
      opportunity.synthetic !== true ||
      opportunity.decisionUse !== "demonstration_only" ||
      opportunity.identityNamespace !== dataset.datasetVersion
    ) {
      throw new Error(`Opportunity ${opportunity.id} is outside the synthetic containment boundary.`);
    }
    assertDecisionScoringPayloadAdmissible(opportunity);
  }
}

function assertEventEnvelope(event) {
  if (!isPlainObject(event)) throw new Error("Event must be an object.");
  assertNonEmptyString(event.eventId, "Event id");
  if (!Number.isInteger(event.seq) || event.seq < 1) throw new Error("Event sequence must be a positive integer.");
  if (![1, 2].includes(event.schemaVersion)) throw new Error(`Unsupported event schema version ${String(event.schemaVersion)}.`);
  assertNonEmptyString(event.type, "Event type");
  assertOptionalDate(event.occurredAt, "Event timestamp");
  if (!event.occurredAt) throw new Error("Event timestamp is required.");
  if (!isPlainObject(event.actor) || !new Set(["HUMAN", "SYSTEM", "AGENT"]).has(event.actor.kind)) {
    throw new Error("Event actor is invalid.");
  }
  assertNonEmptyString(event.actor.id, "Event actor id");
  if (!isPlainObject(event.payload)) throw new Error("Event payload must be an object.");
}

function assertHumanActor(event, action) {
  if (event.actor?.kind !== "HUMAN" || typeof event.actor.id !== "string" || !event.actor.id.trim()) {
    throw new Error(`${action} requires a named human reviewer.`);
  }
}

function assertProofVerificationPayload(payload, opportunity) {
  const allowed = new Set([
    "opportunityId",
    "contractId",
    "pipelineStage",
    "result",
    "evidence",
    "claimLinks",
    "claimLinkUpdates",
    "contradictionResolutions",
    "founderObservations",
    "axisDimensionUpdates",
    "openQuestions",
    "memoUpdates"
  ]);
  assertAllowedKeys(payload, allowed, "PROOF_VERIFIED payload");
  const incomingEvidence = payload.evidence || [];
  const incomingObservations = payload.founderObservations || [];
  if (!Array.isArray(incomingEvidence) || !Array.isArray(incomingObservations)) {
    throw new Error("Proof evidence and founder observations must be arrays.");
  }
  assertAllowedKeys(
    payload.result,
    new Set([
      "outcome",
      "summary",
      "artifacts",
      "criteriaPassed",
      "criteriaTotal",
      "validator",
      "affectedAxes",
      "unchangedAxes"
    ]),
    "Proof result"
  );
  assertNonEmptyString(payload.result.outcome, "Proof result outcome");
  assertNonEmptyString(payload.result.summary, "Proof result summary");
  assertNonEmptyString(payload.result.validator, "Proof result validator");
  assertStringArray(payload.result.artifacts, "Proof result artifacts", { allowEmpty: false });
  assertFiniteRange(payload.result.criteriaTotal, 1, 1000, "Proof result criteria total");
  assertFiniteRange(payload.result.criteriaPassed, 0, payload.result.criteriaTotal, "Proof result criteria passed");
  assertStringArray(payload.result.affectedAxes, "Proof result affected axes");
  assertStringArray(payload.result.unchangedAxes, "Proof result unchanged axes");
  const existingEvidenceIds = new Set((opportunity.evidence || []).map((item) => item.id));
  const newEvidenceIds = assertUniqueIds(incomingEvidence, "Incoming evidence");
  for (const evidence of incomingEvidence) {
    assertEvidenceAdmissible(evidence);
    if (existingEvidenceIds.has(evidence.id)) throw new Error(`Evidence ${evidence.id} already exists.`);
    if (evidence.reviewState !== "VERIFIED") throw new Error("Proof evidence must be explicitly verified.");
    if (evidence.retractedAt || evidence.origin) throw new Error("Proof evidence contains domain-owned lifecycle fields.");
  }
  const allEvidence = new Map(
    [...(opportunity.evidence || []), ...incomingEvidence].map((item) => [item.id, item])
  );
  assertUniqueIds(incomingObservations, "Incoming founder observation");
  const existingObservationIds = new Set((opportunity.founderObservations || []).map((item) => item.id));
  for (const observation of incomingObservations) {
    assertFounderObservationAdmissible(observation);
    if (existingObservationIds.has(observation.id)) {
      throw new Error(`Founder observation ${observation.id} already exists.`);
    }
    for (const evidenceId of observation.evidenceIds) {
      const evidence = allEvidence.get(evidenceId);
      if (!evidence) throw new Error(`Founder observation ${observation.id} references unknown evidence ${evidenceId}.`);
      if (
        !new Set(["VERIFIED_ARTIFACT", "OFFICIAL_PRIMARY", "PUBLIC_WORK"]).has(evidence.kind) ||
        evidence.reviewState !== "VERIFIED" ||
        evidenceQuality(evidence) <= 0
      ) {
        throw new Error(`Founder observation ${observation.id} references inadmissible evidence ${evidenceId}.`);
      }
    }
  }
  for (const link of payload.claimLinks || []) {
    assertAllowedKeys(link, new Set(["claimId", "evidenceId", "stance"]), "Proof claim link");
    if (!newEvidenceIds.has(link.evidenceId) && !existingEvidenceIds.has(link.evidenceId)) {
      throw new Error(`Proof claim link references unknown evidence ${link.evidenceId}.`);
    }
    if (!new Set(["support", "oppose", "context"]).has(link.stance)) {
      throw new Error(`Proof claim stance ${String(link.stance)} is not allowed.`);
    }
  }
  for (const update of payload.claimLinkUpdates || []) {
    assertAllowedKeys(update, new Set(["claimId", "evidenceId", "stance"]), "Proof claim-link update");
    if (!new Set(["support", "oppose", "context"]).has(update.stance)) {
      throw new Error(`Proof claim-link stance ${String(update.stance)} is not allowed.`);
    }
  }
  for (const resolution of payload.contradictionResolutions || []) {
    assertAllowedKeys(
      resolution,
      new Set(["contradictionId", "status", "note"]),
      "Proof contradiction resolution"
    );
    if (!new Set(["TEMPORALLY_RECONCILED", "DEFINITION_MISMATCH", "HUMAN_RESOLVED"]).has(resolution.status)) {
      throw new Error(`Contradiction resolution ${String(resolution.status)} is not allowed.`);
    }
    assertNonEmptyString(resolution.note, "Contradiction resolution note");
  }
  for (const update of payload.axisDimensionUpdates || []) {
    assertAllowedKeys(update, new Set(["axis", "key", "value", "confidence", "trend"]), "Axis update");
    if (!AXES.includes(update.axis)) throw new Error(`Axis update ${String(update.axis)} is not allowed.`);
    assertNonEmptyString(update.key, "Axis update key");
    if (update.value != null) assertFiniteRange(update.value, 0, 100, "Axis update value");
    if (update.confidence != null) assertFiniteRange(update.confidence, 0, 1, "Axis update confidence");
    if (update.trend != null && !new Set(["UP", "FLAT", "DOWN", "UNKNOWN"]).has(update.trend)) {
      throw new Error(`Axis update trend ${String(update.trend)} is not allowed.`);
    }
  }
  if (payload.openQuestions != null) assertStringArray(payload.openQuestions, "Open questions");
  if (payload.memoUpdates != null) {
    assertAllowedKeys(payload.memoUpdates, new Set(["weaknesses", "tractionKpis"]), "Memo update");
    if (payload.memoUpdates.weaknesses != null) assertStringArray(payload.memoUpdates.weaknesses, "Memo weaknesses");
    if (payload.memoUpdates.tractionKpis != null) {
      assertNonEmptyString(payload.memoUpdates.tractionKpis, "Memo traction and KPIs");
    }
  }
}

function canonicalDecisionRecord(caseItem, thesis, rationale, acknowledgements) {
  return {
    recordType: "NON_BINDING_POLICY_SCREEN",
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    code: caseItem.decision.code,
    label: caseItem.decision.label,
    rationale: rationale.trim(),
    checkAmount: thesis.checkSize.max,
    checkCurrency: thesis.checkSize.currency,
    checkBasis: "THESIS_MAX_AT_FREEZE",
    rules: [...caseItem.decision.ruleIds],
    acknowledgements: [...acknowledgements].sort(),
    axisSnapshot: caseItem.axes.map((axis) => ({
      axis: axis.axis,
      score: axis.score,
      confidence: axis.confidence,
      coverage: axis.coverage,
      trend: axis.trend
    })),
    materialClaimSnapshot: caseItem.claims
      .filter((claim) => claim.materiality === "HIGH" || claim.decisionCritical)
      .map((claim) => ({ id: claim.id, trust: claim.trust.score, status: claim.trust.status }))
  };
}

export function applyEvent(previousState, event) {
  assertEventEnvelope(event);
  if (event.type === "DATASET_INITIALIZED") {
    if (previousState != null) throw new Error("A dataset can be initialized only once.");
    assertAllowedKeys(event.payload, new Set(["dataset"]), "DATASET_INITIALIZED payload");
    if (event.actor.kind !== "SYSTEM") throw new Error("Dataset initialization requires a trusted system actor.");
    assertSyntheticDatasetAdmissible(event.payload.dataset);
    return rebuildFounderProfiles(deepClone(event.payload.dataset));
  }
  if (!previousState) throw new Error("The dataset must be initialized before applying events.");
  const state = deepClone(previousState);
  state.appliedEvents ||= [];
  state.appliedEvents.push({ eventId: event.eventId, seq: event.seq, type: event.type, occurredAt: event.occurredAt });

  if (event.type === "THESIS_UPDATED") {
    assertHumanActor(event, "A thesis update");
    assertAllowedKeys(event.payload, new Set(["thesis"]), "THESIS_UPDATED payload");
    assertAllowedKeys(
      event.payload.thesis,
      new Set([
        "name",
        "sectors",
        "stages",
        "geographies",
        "checkSize",
        "ownershipMinPct",
        "ownershipMaxPct",
        "riskAppetite",
        "hardExclusions",
        "axisRecommendFloors",
        "axisRejectFloors",
        "decisionHorizonHours"
      ]),
      "Thesis update"
    );
    const nextThesis = {
      ...state.thesis,
      ...deepClone(event.payload.thesis),
      version: state.thesis.version + 1
    };
    assertThesisAdmissible(nextThesis);
    state.thesis = nextThesis;
    return state;
  }

  const opportunityId = event.payload?.opportunityId;
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw new Error(`Unknown opportunity ${opportunityId || "(missing)"}`);

  if (event.type === "PROOF_SUBMITTED") {
    assertHumanActor(event, "A proof submission");
    assertAllowedKeys(event.payload, new Set(["opportunityId", "contractId"]), "PROOF_SUBMITTED payload");
    const contract = opportunity.evidenceContracts.find((item) => item.id === event.payload.contractId);
    if (!contract) throw new Error(`Unknown evidence contract ${event.payload.contractId}`);
    if (!["PROPOSED", "SENT"].includes(contract.status)) throw new Error("Evidence contract is not awaiting submission.");
    contract.status = "SUBMITTED";
    contract.submittedAt = event.occurredAt;
    opportunity.pipelineStage = "PROOF_SUBMITTED";
    appendTimeline(opportunity, event, "Founder submitted the bounded evidence package");
    return state;
  }

  if (event.type === "PROOF_NOT_COMPLETED") {
    assertAllowedKeys(
      event.payload,
      new Set(["opportunityId", "contractId", "status", "reasonCategory"]),
      "PROOF_NOT_COMPLETED payload"
    );
    const contract = opportunity.evidenceContracts.find((item) => item.id === event.payload.contractId);
    if (!contract) throw new Error(`Unknown evidence contract ${event.payload.contractId}`);
    if (!new Set(["PROPOSED", "SENT"]).has(contract.status)) {
      throw new Error("Only an open evidence request can be closed without completion.");
    }
    if (!new Set(["NOT_COMPLETED", "DECLINED", "EXPIRED"]).has(event.payload.status)) {
      throw new Error(`Neutral noncompletion status ${String(event.payload.status)} is not allowed.`);
    }
    assertNonEmptyString(event.payload.reasonCategory, "Proof noncompletion reason category");
    contract.status = event.payload.status;
    contract.noncompletion = {
      reasonCategory: event.payload.reasonCategory,
      recordedAt: event.occurredAt,
      actor: { kind: event.actor.kind, id: event.actor.id }
    };
    opportunity.pipelineStage = "SCREENING";
    appendTimeline(opportunity, event, "Evidence request closed without adverse founder inference");
    return state;
  }

  if (event.type === "PROOF_VERIFIED") {
    assertHumanActor(event, "Proof verification");
    assertProofVerificationPayload(event.payload, opportunity);
    const contract = opportunity.evidenceContracts.find((item) => item.id === event.payload.contractId);
    if (!contract || contract.status !== "SUBMITTED") throw new Error("Only submitted evidence can be verified.");
    contract.status = "VERIFIED";
    contract.verifiedAt = event.occurredAt;
    contract.result = deepClone(event.payload.result);
    opportunity.pipelineStage = event.payload.pipelineStage || "DECISION_READY";
    const incomingEvidence = deepClone(event.payload.evidence || []);
    const incomingObservations = deepClone(event.payload.founderObservations || []);
    opportunity.evidence.push(...incomingEvidence);
    opportunity.founderObservations.push(...incomingObservations);
    for (const observation of incomingObservations) registerFounderObservation(state, opportunity, observation);

    for (const link of event.payload.claimLinks || []) {
      const claim = opportunity.claims.find((item) => item.id === link.claimId);
      if (!claim) throw new Error(`Unknown claim ${link.claimId}`);
      if (claim.evidenceLinks.some((item) => item.evidenceId === link.evidenceId)) {
        throw new Error(`Claim ${link.claimId} already links evidence ${link.evidenceId}.`);
      }
      claim.evidenceLinks.push({ evidenceId: link.evidenceId, stance: link.stance });
    }
    for (const linkUpdate of event.payload.claimLinkUpdates || []) {
      const claim = opportunity.claims.find((item) => item.id === linkUpdate.claimId);
      const link = claim?.evidenceLinks.find((item) => item.evidenceId === linkUpdate.evidenceId);
      if (!link) throw new Error(`Unknown claim evidence link ${linkUpdate.claimId}/${linkUpdate.evidenceId}`);
      link.stance = linkUpdate.stance;
    }
    for (const resolution of event.payload.contradictionResolutions || []) {
      const contradiction = opportunity.contradictions.find((item) => item.id === resolution.contradictionId);
      if (!contradiction) throw new Error(`Unknown contradiction ${resolution.contradictionId}`);
      if (contradiction.status !== "OPEN") throw new Error("Only an open contradiction can be resolved.");
      contradiction.status = resolution.status;
      contradiction.resolutionNote = resolution.note;
      contradiction.resolvedAt = event.occurredAt;
    }
    for (const update of event.payload.axisDimensionUpdates || []) updateDimension(opportunity, update);
    if (Array.isArray(event.payload.openQuestions)) {
      opportunity.openQuestions = deepClone(event.payload.openQuestions);
    }
    if (event.payload.memoUpdates) {
      opportunity.memoDraft = { ...opportunity.memoDraft, ...deepClone(event.payload.memoUpdates) };
    }
    appendTimeline(opportunity, event, "Evidence verified against the predeclared rubric");
    assertDecisionScoringPayloadAdmissible(opportunity);
    return state;
  }

  if (event.type === "LIVE_LEAD_ATTACHED") {
    assertHumanActor(event, "Attaching a live lead");
    assertAllowedKeys(
      event.payload,
      new Set(["opportunityId", "claimId", "evidence"]),
      "LIVE_LEAD_ATTACHED payload"
    );
    if (
      Object.prototype.hasOwnProperty.call(event.payload.evidence, "reviewState") ||
      Object.prototype.hasOwnProperty.call(event.payload.evidence, "retractedAt") ||
      Object.prototype.hasOwnProperty.call(event.payload.evidence, "origin")
    ) {
      throw new Error("Live-lead lifecycle fields are owned by the domain.");
    }
    if (!opportunity.claims.some((claim) => claim.id === event.payload.claimId)) {
      throw new Error(`Unknown claim ${event.payload.claimId}`);
    }
    const evidence = {
      ...deepClone(event.payload.evidence),
      reviewState: "UNREVIEWED",
      origin: "EXTERNAL_LIVE_LEAD",
      syntheticFixture: false
    };
    assertEvidenceAdmissible(evidence);
    if (opportunity.evidence.some((item) => item.id === evidence.id)) {
      throw new Error(`Evidence ${evidence.id} already exists.`);
    }
    opportunity.evidence.push(evidence);
    opportunity.researchLeads ||= [];
    opportunity.researchLeads.push({ evidenceId: evidence.id, claimId: event.payload.claimId });
    appendTimeline(opportunity, event, "Live source attached as an unreviewed lead");
    assertDecisionScoringPayloadAdmissible(opportunity);
    return state;
  }

  if (event.type === "EVIDENCE_RETRACTED") {
    assertHumanActor(event, "Evidence retraction");
    assertAllowedKeys(
      event.payload,
      new Set(["opportunityId", "evidenceId", "reason"]),
      "EVIDENCE_RETRACTED payload"
    );
    assertNonEmptyString(event.payload.reason, "Evidence retraction reason");
    const evidence = opportunity.evidence.find((item) => item.id === event.payload.evidenceId);
    if (!evidence) throw new Error(`Unknown evidence ${event.payload.evidenceId}`);
    if (evidence.retractedAt) throw new Error("Evidence is already retracted.");
    evidence.retractedAt = event.occurredAt;
    evidence.retractionReason = event.payload.reason;
    appendTimeline(opportunity, event, `Evidence retracted: ${event.payload.reason}`);
    return state;
  }

  if (event.type === "DECISION_FROZEN") {
    assertHumanActor(event, "A non-binding policy record");
    assertAllowedKeys(
      event.payload,
      new Set(["opportunityId", "rationale", "acknowledgements"]),
      "DECISION_FROZEN payload"
    );
    if (opportunity.finalDecision) throw new Error("The policy record is already frozen; create an amendment instead.");
    if (opportunity.pipelineStage !== "DECISION_READY") {
      throw new Error("Only a decision-ready opportunity can be frozen.");
    }
    assertNonEmptyString(event.payload.rationale, "Decision rationale");
    if (event.payload.rationale.trim().length < 12) {
      throw new Error("Decision rationale must contain at least 12 characters.");
    }
    assertStringArray(event.payload.acknowledgements, "Decision acknowledgements", { allowEmpty: false });
    const acknowledgementSet = new Set(event.payload.acknowledgements);
    if (
      acknowledgementSet.size !== 3 ||
      !["axes", "claims", "unknowns"].every((item) => acknowledgementSet.has(item))
    ) {
      throw new Error("Decision acknowledgements must cover axes, claims, and unknowns.");
    }
    const currentCase = computeCaseFromState(state, opportunity);
    if (currentCase.decision.code !== "RECOMMEND") {
      throw new Error(`The current decision is ${currentCase.decision.code}, not RECOMMEND.`);
    }
    const record = canonicalDecisionRecord(
      currentCase,
      state.thesis,
      event.payload.rationale,
      event.payload.acknowledgements
    );
    opportunity.finalDecision = {
      ...record,
      reviewer: event.actor.id.trim(),
      frozenAt: event.occurredAt,
      version: 1,
      thesisVersion: state.thesis.version,
      eventSeq: event.seq
    };
    opportunity.pipelineStage = "FINALIZED";
    state.decisions ||= [];
    state.decisions.push({ opportunityId, ...deepClone(opportunity.finalDecision) });
    appendTimeline(opportunity, event, "Human reviewer froze the non-binding policy record");
    return state;
  }

  if (event.type === "DECISION_AMENDED") {
    assertHumanActor(event, "A decision amendment");
    assertAllowedKeys(
      event.payload,
      new Set(["opportunityId", "rationale"]),
      "DECISION_AMENDED payload"
    );
    if (!opportunity.finalDecision) throw new Error("Only a frozen decision can receive an amendment.");
    assertNonEmptyString(event.payload.rationale, "Decision amendment rationale");
    if (event.payload.rationale.trim().length < 12) {
      throw new Error("Decision amendment rationale must contain at least 12 characters.");
    }
    opportunity.decisionAmendments ||= [];
    const amendment = {
      version: opportunity.decisionAmendments.length + 2,
      amendsVersion: opportunity.finalDecision.version,
      rationale: event.payload.rationale.trim(),
      reviewer: event.actor.id.trim(),
      amendedAt: event.occurredAt,
      eventSeq: event.seq
    };
    opportunity.decisionAmendments.push(amendment);
    state.decisions ||= [];
    state.decisions.push({ opportunityId, type: "AMENDMENT", ...deepClone(amendment) });
    appendTimeline(opportunity, event, "Human reviewer appended a decision amendment");
    return state;
  }

  throw new Error(`Unsupported event type ${event.type}`);
}

export function replayEvents(events, asOfSeq = Infinity) {
  if (!Array.isArray(events) || !events.length) throw new Error("An event history is required.");
  const eventIds = new Set();
  const sequences = new Set();
  for (const event of events) {
    assertEventEnvelope(event);
    if (eventIds.has(event.eventId)) throw new Error(`Duplicate event id ${event.eventId}.`);
    if (sequences.has(event.seq)) throw new Error(`Duplicate event sequence ${event.seq}.`);
    eventIds.add(event.eventId);
    sequences.add(event.seq);
  }
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  if (ordered[0].seq !== 1 || ordered[0].type !== "DATASET_INITIALIZED") {
    throw new Error("Event sequence 1 must initialize the dataset.");
  }
  if (ordered.filter((event) => event.type === "DATASET_INITIALIZED").length !== 1) {
    throw new Error("The event history must contain exactly one dataset initialization.");
  }
  ordered.forEach((event, index) => {
    if (event.seq !== index + 1) throw new Error(`Event history has a sequence gap before ${event.seq}.`);
  });
  const selected = ordered.filter((event) => event.seq <= asOfSeq);
  let state = null;
  for (const event of selected) {
    state = applyEvent(state, event);
  }
  if (!state) throw new Error("No dataset initialization event was supplied.");
  return state;
}

export function nextEvent(events, type, payload, actor = { kind: "HUMAN", id: "Mario" }) {
  const nextSeq = events.reduce((max, event) => Math.max(max, event.seq), 0) + 1;
  const eventId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `evt-${nextSeq}-${Math.random().toString(16).slice(2)}`;
  return {
    eventId,
    seq: nextSeq,
    type,
    payload: deepClone(payload),
    actor: deepClone(actor),
    occurredAt: new Date().toISOString(),
    schemaVersion: 2
  };
}

export function assertPrestigeInvariant(baseOpportunity, prestigeTwin, thesis) {
  const base = computeCase(baseOpportunity, thesis);
  const twin = computeCase(prestigeTwin, thesis);
  return {
    founderScoreEqual: base.founderScore.score === twin.founderScore.score,
    axesEqual: JSON.stringify(base.axes) === JSON.stringify(twin.axes),
    decisionEqual: base.decision.code === twin.decision.code,
    claimTrustEqual:
      JSON.stringify(base.claims.map((claim) => claim.trust.score)) ===
      JSON.stringify(twin.claims.map((claim) => claim.trust.score))
  };
}
