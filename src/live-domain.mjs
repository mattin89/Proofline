/**
 * Proofline real-data opportunity scoring.
 *
 * This module deliberately scores the evidence-backed opportunity, not a
 * founder's personal worth. It accepts only a small, allow-listed vocabulary;
 * protected traits, prestige proxies, social-popularity metrics, caller-defined
 * weights, and uncited assertions are not admissible scoring inputs.
 */

export const LIVE_SCORE_SCHEMA_VERSION = "proofline.live-score.v1";

export const LIVE_DIMENSIONS = Object.freeze([
  "FOUNDER_EXECUTION",
  "MARKET_PROBLEM_PULL",
  "PRODUCT_TECHNICAL_FIT",
  "EVIDENCE_QUALITY",
  "REVENUE_PLAUSIBILITY"
]);

const RUBRIC = {
  FOUNDER_EXECUTION: {
    label: "Founder execution evidence",
    weight: 0.18,
    criteria: {
      DELIVERY_RECORD: { label: "Reported delivery evidence", weight: 0.3 },
      LEARNING_VELOCITY: { label: "Observed learning velocity", weight: 0.25 },
      EVIDENCE_DISCIPLINE: { label: "Evidence discipline", weight: 0.25 },
      DOMAIN_EXECUTION: { label: "Demonstrated domain execution", weight: 0.2 }
    }
  },
  MARKET_PROBLEM_PULL: {
    label: "Market / problem pull",
    weight: 0.25,
    criteria: {
      PROBLEM_SEVERITY: { label: "Problem severity", weight: 0.3 },
      BUYER_URGENCY: { label: "Buyer urgency", weight: 0.3 },
      MARKET_TIMING: { label: "Market timing", weight: 0.15 },
      INCUMBENT_PAIN: { label: "Incumbent pain alignment", weight: 0.25 }
    }
  },
  PRODUCT_TECHNICAL_FIT: {
    label: "Product / technical fit",
    weight: 0.23,
    criteria: {
      TECHNICAL_FEASIBILITY: { label: "Technical feasibility", weight: 0.3 },
      DIFFERENTIATION: { label: "Defensible differentiation", weight: 0.25 },
      VALIDATION: { label: "Independent validation", weight: 0.25 },
      ACADEMIC_ALIGNMENT: { label: "Academic / technical research alignment", weight: 0.2 }
    }
  },
  EVIDENCE_QUALITY: {
    label: "Evidence quality",
    weight: 0.14,
    criteria: {}
  },
  REVENUE_PLAUSIBILITY: {
    label: "Revenue plausibility",
    weight: 0.2,
    criteria: {
      WILLINGNESS_TO_PAY: { label: "Observed willingness to pay", weight: 0.3 },
      UNIT_ECONOMICS: { label: "Unit-economics plausibility", weight: 0.25 },
      SALES_PATH: { label: "Credible sales path", weight: 0.25 },
      MARKET_SCALE: { label: "Evidence-backed revenue scale", weight: 0.2 }
    }
  }
};

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const SCORING_RUBRIC = deepFreeze(RUBRIC);

export const SOURCE_POLICIES = deepFreeze({
  PEER_REVIEWED_RESEARCH: { reliability: 0.9, freshnessDays: 365.25 * 8 },
  GOVERNMENT_OR_REGULATORY: { reliability: 0.94, freshnessDays: 365.25 * 5 },
  INDEPENDENT_TECHNICAL: { reliability: 0.88, freshnessDays: 365.25 * 5 },
  CUSTOMER_PRIMARY: { reliability: 0.84, freshnessDays: 365.25 * 2 },
  INCUMBENT_PRIMARY: { reliability: 0.78, freshnessDays: 365.25 * 3 },
  PATENT: { reliability: 0.76, freshnessDays: 365.25 * 10 },
  REPUTABLE_NEWS: { reliability: 0.72, freshnessDays: 365.25 * 2 },
  INDUSTRY_REPORT: { reliability: 0.69, freshnessDays: 365.25 * 3 },
  STARTUP_PRIMARY: { reliability: 0.62, freshnessDays: 365.25 * 2 },
  UPLOADED_BUSINESS_PLAN: { reliability: 0.52, freshnessDays: 365.25 * 2 },
  SOCIAL_PROFILE: { reliability: 0.42, freshnessDays: 365.25 },
  SEARCH_SNIPPET: { reliability: 0.3, freshnessDays: 180 },
  OTHER: { reliability: 0.4, freshnessDays: 365.25 }
});

const REVIEW_CAPS = Object.freeze({ VERIFIED: 1, REVIEWED: 0.78, UNREVIEWED: 0.35 });
const SUBJECTS = new Set([
  "STARTUP",
  "FOUNDER",
  "CUSTOMER",
  "INCUMBENT",
  "ACADEMIC",
  "MARKET",
  "REGULATORY",
  "TECHNICAL",
  "OTHER"
]);
const STANCES = new Set(["SUPPORT", "OPPOSE", "CONTEXT"]);
const EVIDENCE_FIELDS = new Set([
  "id",
  "title",
  "sourceUrl",
  "excerpt",
  "capturedAt",
  "publishedAt",
  "sourceType",
  "subject",
  "roleResolution",
  "independenceGroup",
  "reviewState",
  "directness",
  "entityMatchConfidence",
  "retractedAt",
  "retractionReason"
]);
const CLAIM_FIELDS = new Set([
  "id",
  "dimension",
  "criterion",
  "statement",
  "assessmentScore",
  "rationale",
  "evidenceLinks"
]);
const CLAIM_LINK_FIELDS = new Set(["evidenceId", "stance"]);
const CONTRADICTION_FIELDS = new Set([
  "id",
  "claimIds",
  "evidenceIds",
  "severity",
  "status",
  "note"
]);
const INPUT_FIELDS = new Set(["opportunityId", "asOf", "evidence", "claims", "contradictions", "mode"]);
const SEVERITY_PENALTIES = Object.freeze({ LOW: 4, MEDIUM: 10, HIGH: 18 });
const BUILD_INPUT_FIELDS = new Set([
  "opportunityId",
  "asOf",
  "evidence",
  "companyName",
  "founderNames",
  "thesis",
  "mode"
]);

// Protected characteristics are excluded specifically from founder-execution
// assessments. The market may legitimately concern, for example, disability or
// ageing; that does not make the trait an admissible founder-scoring signal.
const PROTECTED_FOUNDER_PATTERNS = [
  /\b(?:race|racial|ethnicity|ethnic origin)\b/i,
  /\b(?:sex|gender|gender identity|sexual orientation)\b/i,
  /\b(?:religion|religious belief)\b/i,
  /\b(?:disability|disabled|medical condition|genetic information)\b/i,
  /\b(?:pregnan(?:t|cy)|marital status|family status)\b/i,
  /\b(?:age|nationality|citizenship)\b/i
];
const PRESTIGE_PATTERNS = [
  /\b(?:elite|prestigious|top[- ]tier)\s+(?:school|university|college|employer)\b/i,
  /\b(?:school|university|college|employer)\s+pedigree\b/i,
  /\b(?:ivy league|brand[- ]name employer|prestige signal)\b/i,
  /\b(?:attended|graduated from|alumnus of|alumna of)\s+(?:harvard|stanford|yale|mit|oxford|cambridge)\b/i,
  /\b(?:ex-|former\s+)(?:google|meta|facebook|apple|amazon|microsoft|tesla|spacex|openai|mckinsey|goldman sachs)\b/i
];
const SOCIAL_POPULARITY_PATTERNS = [
  /\b(?:followers?|likes?|impressions?|subscribers?|retweets?|reposts?|social views?)\b/i,
  /\b(?:social popularity|influencer status|celebrity status|verified badge|blue check|went viral|trending account)\b/i
];
const ACADEMIC_ALIGNMENT_SOURCE_TYPES = new Set([
  "PEER_REVIEWED_RESEARCH",
  "INDEPENDENT_TECHNICAL"
]);
const ROLE_RESOLUTIONS = new Set([
  "SOURCE_OWNERSHIP",
  "STARTUP_IDENTITY_MATCH",
  "FOUNDER_IDENTITY_MATCH",
  "ACADEMIC_SOURCE_AND_RESEARCH_TEXT",
  "INCUMBENT_ENTITY_AND_PAIN_TEXT",
  "UNRESOLVED"
]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} contains inadmissible field(s): ${unknown.join(", ")}.`);
}

function assertText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
}

function assertRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
}

function assertTimestamp(value, label, { optional = false } = {}) {
  if (optional && value == null) return;
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO-compatible timestamp.`);
  }
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assertText(item?.id, `${label} id`);
    if (ids.has(item.id)) throw new Error(`${label} id ${item.id} is duplicated.`);
    ids.add(item.id);
  }
  return ids;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function evidenceEligibleForMode(evidence, mode) {
  return mode === "PROVISIONAL" || evidence.reviewState !== "UNREVIEWED";
}

function normalizedAttributionText(value) {
  return ` ${String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")} `;
}

function hasFounderAttribution(evidence, founderNames) {
  if (evidence.subject === "FOUNDER") return true;
  const haystack = normalizedAttributionText(`${evidence.title} ${evidence.excerpt}`);
  return founderNames.some((name) => {
    const normalizedName = normalizedAttributionText(name).trim();
    return normalizedName.length > 1 && haystack.includes(` ${normalizedName} `);
  });
}

function timestampMs(value) {
  return Date.parse(value);
}

function assertCitationUrl(value, sourceType) {
  assertText(value, "Evidence sourceUrl");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Evidence sourceUrl must be a valid citation URL.");
  }
  const allowed = new Set(["http:", "https:", "proofline:"]);
  if (!allowed.has(parsed.protocol)) throw new Error("Evidence sourceUrl must use HTTP, HTTPS, or proofline protocol.");
  if (parsed.protocol === "proofline:" && sourceType !== "UPLOADED_BUSINESS_PLAN") {
    throw new Error("Only uploaded business-plan evidence may use a proofline citation URL.");
  }
}

function founderPolicyLeak(text) {
  if (PROTECTED_FOUNDER_PATTERNS.some((pattern) => pattern.test(text))) return "PROTECTED";
  if (PRESTIGE_PATTERNS.some((pattern) => pattern.test(text))) return "PRESTIGE";
  if (SOCIAL_POPULARITY_PATTERNS.some((pattern) => pattern.test(text))) return "POPULARITY";
  return null;
}

function assertNoPolicyLeak(claim, linkedEvidence = []) {
  const text = `${claim.statement} ${claim.rationale}`;
  const claimLeak = claim.dimension === "FOUNDER_EXECUTION" ? founderPolicyLeak(text) : null;
  if (claimLeak === "PROTECTED") {
    throw new Error(`Claim ${claim.id} uses a protected characteristic in founder execution scoring.`);
  }
  if (claimLeak === "PRESTIGE" || PRESTIGE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(`Claim ${claim.id} uses an inadmissible prestige proxy.`);
  }
  if (claimLeak === "POPULARITY" || SOCIAL_POPULARITY_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(`Claim ${claim.id} uses an inadmissible social-popularity metric.`);
  }

  if (claim.dimension !== "FOUNDER_EXECUTION") return;
  for (const evidence of linkedEvidence) {
    const evidenceLeak = founderPolicyLeak(`${evidence.title} ${evidence.excerpt}`);
    if (evidenceLeak === "PROTECTED") {
      throw new Error(`Claim ${claim.id} links protected-characteristic evidence into founder execution scoring.`);
    }
    if (evidenceLeak === "PRESTIGE") {
      throw new Error(`Claim ${claim.id} links an inadmissible prestige proxy into founder execution scoring.`);
    }
    if (evidenceLeak === "POPULARITY") {
      throw new Error(`Claim ${claim.id} links an inadmissible social-popularity metric into founder execution scoring.`);
    }
  }
}

function assertEvidence(evidence, asOfMs) {
  assertAllowedKeys(evidence, EVIDENCE_FIELDS, "Evidence");
  assertText(evidence.id, "Evidence id");
  assertText(evidence.title, `Evidence ${evidence.id} title`);
  assertText(evidence.excerpt, `Evidence ${evidence.id} excerpt`);
  assertText(evidence.independenceGroup, `Evidence ${evidence.id} independenceGroup`);
  if (!Object.hasOwn(SOURCE_POLICIES, evidence.sourceType)) {
    throw new Error(`Evidence ${evidence.id} sourceType ${String(evidence.sourceType)} is not allowed.`);
  }
  if (!SUBJECTS.has(evidence.subject)) {
    throw new Error(`Evidence ${evidence.id} subject ${String(evidence.subject)} is not allowed.`);
  }
  if (evidence.roleResolution != null && !ROLE_RESOLUTIONS.has(evidence.roleResolution)) {
    throw new Error(`Evidence ${evidence.id} roleResolution ${String(evidence.roleResolution)} is not allowed.`);
  }
  if (!Object.hasOwn(REVIEW_CAPS, evidence.reviewState)) {
    throw new Error(`Evidence ${evidence.id} reviewState ${String(evidence.reviewState)} is not allowed.`);
  }
  assertCitationUrl(evidence.sourceUrl, evidence.sourceType);
  assertTimestamp(evidence.capturedAt, `Evidence ${evidence.id} capturedAt`);
  assertTimestamp(evidence.publishedAt, `Evidence ${evidence.id} publishedAt`, { optional: true });
  assertTimestamp(evidence.retractedAt, `Evidence ${evidence.id} retractedAt`, { optional: true });
  assertRange(evidence.directness, 0, 1, `Evidence ${evidence.id} directness`);
  assertRange(evidence.entityMatchConfidence, 0, 1, `Evidence ${evidence.id} entityMatchConfidence`);
  if (timestampMs(evidence.capturedAt) > asOfMs) throw new Error(`Evidence ${evidence.id} was captured after asOf.`);
  if (evidence.publishedAt && timestampMs(evidence.publishedAt) > asOfMs) {
    throw new Error(`Evidence ${evidence.id} was published after asOf.`);
  }
  if (evidence.retractedAt && timestampMs(evidence.retractedAt) > asOfMs) {
    throw new Error(`Evidence ${evidence.id} was retracted after asOf.`);
  }
  if (evidence.retractedAt && !evidence.retractionReason?.trim()) {
    throw new Error(`Evidence ${evidence.id} retractionReason is required when retractedAt is set.`);
  }
}

function assertClaim(claim, evidenceById) {
  assertAllowedKeys(claim, CLAIM_FIELDS, "Claim");
  assertText(claim.id, "Claim id");
  if (claim.dimension === "EVIDENCE_QUALITY" || !Object.hasOwn(SCORING_RUBRIC, claim.dimension)) {
    throw new Error(`Claim ${claim.id} dimension ${String(claim.dimension)} is not a scorable claim dimension.`);
  }
  const criterionPolicy = SCORING_RUBRIC[claim.dimension].criteria[claim.criterion];
  if (!criterionPolicy) {
    throw new Error(`Claim ${claim.id} criterion ${String(claim.criterion)} is not allowed for ${claim.dimension}.`);
  }
  assertText(claim.statement, `Claim ${claim.id} statement`);
  assertText(claim.rationale, `Claim ${claim.id} rationale`);
  assertRange(claim.assessmentScore, 0, 100, `Claim ${claim.id} assessmentScore`);
  if (!Array.isArray(claim.evidenceLinks)) throw new Error(`Claim ${claim.id} evidenceLinks must be an array.`);
  const linkedIds = new Set();
  const linkedEvidence = [];
  for (const link of claim.evidenceLinks) {
    assertAllowedKeys(link, CLAIM_LINK_FIELDS, `Claim ${claim.id} evidence link`);
    assertText(link.evidenceId, `Claim ${claim.id} evidenceId`);
    if (!evidenceById.has(link.evidenceId)) {
      throw new Error(`Claim ${claim.id} references unknown evidence ${link.evidenceId}.`);
    }
    if (!STANCES.has(link.stance)) {
      throw new Error(`Claim ${claim.id} evidence stance ${String(link.stance)} is not allowed.`);
    }
    if (linkedIds.has(link.evidenceId)) {
      throw new Error(`Claim ${claim.id} links evidence ${link.evidenceId} more than once.`);
    }
    linkedIds.add(link.evidenceId);
    linkedEvidence.push(evidenceById.get(link.evidenceId));
  }
  assertNoPolicyLeak(claim, linkedEvidence);
}

function assertContradiction(contradiction, claimIds, evidenceIds) {
  assertAllowedKeys(contradiction, CONTRADICTION_FIELDS, "Contradiction");
  assertText(contradiction.id, "Contradiction id");
  assertText(contradiction.note, `Contradiction ${contradiction.id} note`);
  if (!Array.isArray(contradiction.claimIds) || !contradiction.claimIds.length) {
    throw new Error(`Contradiction ${contradiction.id} claimIds must be a non-empty array.`);
  }
  if (!Array.isArray(contradiction.evidenceIds) || !contradiction.evidenceIds.length) {
    throw new Error(`Contradiction ${contradiction.id} evidenceIds must be a non-empty array.`);
  }
  for (const claimId of new Set(contradiction.claimIds)) {
    if (!claimIds.has(claimId)) throw new Error(`Contradiction ${contradiction.id} references unknown claim ${claimId}.`);
  }
  for (const evidenceId of new Set(contradiction.evidenceIds)) {
    if (!evidenceIds.has(evidenceId)) {
      throw new Error(`Contradiction ${contradiction.id} references unknown evidence ${evidenceId}.`);
    }
  }
  if (!Object.hasOwn(SEVERITY_PENALTIES, contradiction.severity)) {
    throw new Error(`Contradiction ${contradiction.id} severity ${String(contradiction.severity)} is not allowed.`);
  }
  if (!new Set(["OPEN", "RESOLVED"]).has(contradiction.status)) {
    throw new Error(`Contradiction ${contradiction.id} status ${String(contradiction.status)} is not allowed.`);
  }
}

export function assertLiveScoreInput(input) {
  assertAllowedKeys(input, INPUT_FIELDS, "Live score input");
  assertText(input.opportunityId, "Live score opportunityId");
  assertTimestamp(input.asOf, "Live score asOf");
  if (!Array.isArray(input.evidence)) throw new Error("Live score evidence must be an array.");
  if (!Array.isArray(input.claims)) throw new Error("Live score claims must be an array.");
  if (!Array.isArray(input.contradictions)) throw new Error("Live score contradictions must be an array.");
  if (input.mode != null && !new Set(["REVIEWED", "PROVISIONAL"]).has(input.mode)) {
    throw new Error(`Live score mode ${String(input.mode)} is not allowed.`);
  }
  const asOfMs = timestampMs(input.asOf);
  const evidenceIds = assertUniqueIds(input.evidence, "Evidence");
  for (const evidence of input.evidence) assertEvidence(evidence, asOfMs);
  const evidenceById = new Map(input.evidence.map((evidence) => [evidence.id, evidence]));
  const claimIds = assertUniqueIds(input.claims, "Claim");
  const criterionKeys = new Set();
  for (const claim of input.claims) {
    assertClaim(claim, evidenceById);
    const key = `${claim.dimension}:${claim.criterion}`;
    if (criterionKeys.has(key)) {
      throw new Error(`Only one consolidated claim is allowed for rubric criterion ${key}.`);
    }
    criterionKeys.add(key);
  }
  assertUniqueIds(input.contradictions, "Contradiction");
  for (const contradiction of input.contradictions) {
    assertContradiction(contradiction, claimIds, evidenceIds);
  }
  return true;
}

export function computeLiveEvidenceQuality(evidence, asOf) {
  assertTimestamp(asOf, "Evidence quality asOf");
  assertEvidence(evidence, timestampMs(asOf));
  const policy = SOURCE_POLICIES[evidence.sourceType];
  const flags = [];
  let freshness = 0.25;
  let ageDays = null;
  let cap = REVIEW_CAPS[evidence.reviewState];

  if (evidence.publishedAt) {
    ageDays = Math.max(0, (timestampMs(asOf) - timestampMs(evidence.publishedAt)) / 86_400_000);
    freshness = clamp(1 - ageDays / (policy.freshnessDays * 2), 0.15, 1);
    if (ageDays > policy.freshnessDays) {
      flags.push("STALE");
      cap = Math.min(cap, 0.55);
    }
    if (ageDays > policy.freshnessDays * 2) {
      flags.push("SEVERELY_STALE");
      cap = Math.min(cap, 0.35);
    }
  } else {
    flags.push("MISSING_PUBLICATION_DATE");
    cap = Math.min(cap, 0.4);
  }
  if (evidence.reviewState === "UNREVIEWED") flags.push("UNREVIEWED");
  if (evidence.sourceType === "UPLOADED_BUSINESS_PLAN") cap = Math.min(cap, 0.65);
  if (evidence.sourceType === "SOCIAL_PROFILE") cap = Math.min(cap, 0.45);
  if (evidence.sourceType === "SEARCH_SNIPPET") {
    flags.push("SEARCH_SNIPPET_ONLY");
    cap = Math.min(cap, 0.3);
  }
  if (evidence.entityMatchConfidence < 0.5) flags.push("LOW_ENTITY_MATCH");
  if (evidence.retractedAt) {
    flags.push("RETRACTED");
    cap = 0;
  }

  const raw =
    0.45 * policy.reliability +
    0.25 * evidence.directness +
    0.2 * evidence.entityMatchConfidence +
    0.1 * freshness;
  const quality = clamp(Math.min(raw, cap));
  return {
    quality: round(quality * 100),
    qualityFraction: round(quality, 4),
    rawQuality: round(raw * 100),
    cap: round(cap * 100),
    sourceReliability: round(policy.reliability * 100),
    freshness: round(freshness * 100),
    ageDays: ageDays == null ? null : round(ageDays),
    flags: flags.sort()
  };
}

const SELF_AUTHORED_SOURCE_TYPES = new Set([
  "STARTUP_PRIMARY",
  "UPLOADED_BUSINESS_PLAN",
  "SOCIAL_PROFILE"
]);
const NEGATION_OR_FAILURE = /\b(?:not|no evidence|without|failed|failure|unproven|unverified|disputed|retracted|cancelled|canceled|declined)\b/i;
const COMPARATOR_NEGATION = /\b(?:not|no evidence|without|unproven|unverified|disputed|retracted|cancelled|canceled|declined)\b/i;
const DERIVATION_POLICIES = deepFreeze({
  DELIVERY_RECORD: {
    dimension: "FOUNDER_EXECUTION",
    subjects: ["FOUNDER", "STARTUP", "CUSTOMER", "TECHNICAL"],
    patterns: [/\b(?:shipped|launched|deployed|delivered|released|completed|implemented)\b/i]
  },
  LEARNING_VELOCITY: {
    dimension: "FOUNDER_EXECUTION",
    subjects: ["FOUNDER", "STARTUP", "CUSTOMER", "TECHNICAL"],
    patterns: [/\b(?:iterat(?:e|ed|ion)|experiment(?:ed|s)?|customer feedback|learning cycle|pivoted)\b/i]
  },
  EVIDENCE_DISCIPLINE: {
    dimension: "FOUNDER_EXECUTION",
    subjects: ["FOUNDER", "STARTUP", "CUSTOMER", "TECHNICAL"],
    patterns: [/\b(?:audited|reproducible|measurement|measured|test results?|validation dataset|documented protocol)\b/i]
  },
  DOMAIN_EXECUTION: {
    dimension: "FOUNDER_EXECUTION",
    subjects: ["FOUNDER", "STARTUP", "CUSTOMER", "TECHNICAL"],
    patterns: [/\b(?:operated|engineered|manufactured|clinical deployment|field deployment|published research|granted patent)\b/i]
  },
  PROBLEM_SEVERITY: {
    dimension: "MARKET_PROBLEM_PULL",
    subjects: ["CUSTOMER", "MARKET", "INCUMBENT", "REGULATORY", "ACADEMIC"],
    patterns: [/\b(?:downtime|bottleneck|shortage|unmet need|cost burden|revenue loss|safety risk|failure rate)\b/i]
  },
  BUYER_URGENCY: {
    dimension: "MARKET_PROBLEM_PULL",
    subjects: ["CUSTOMER", "MARKET", "INCUMBENT", "REGULATORY"],
    patterns: [/\b(?:purchase order|procurement|request for proposal|rfp|budget allocated|contracted|urgent need|compliance deadline)\b/i]
  },
  MARKET_TIMING: {
    dimension: "MARKET_PROBLEM_PULL",
    subjects: ["MARKET", "INCUMBENT", "REGULATORY", "ACADEMIC"],
    patterns: [/\b(?:regulation|mandate|adoption|capacity constraint|supply constraint|deadline|market transition)\b/i]
  },
  INCUMBENT_PAIN: {
    dimension: "MARKET_PROBLEM_PULL",
    subjects: ["STARTUP", "TECHNICAL", "INCUMBENT"],
    patterns: []
  },
  TECHNICAL_FEASIBILITY: {
    dimension: "PRODUCT_TECHNICAL_FIT",
    subjects: ["STARTUP", "TECHNICAL", "CUSTOMER", "ACADEMIC"],
    patterns: [/\b(?:prototype|bench test|field test|validated|demonstrated|performance test|technical milestone)\b/i]
  },
  DIFFERENTIATION: {
    dimension: "PRODUCT_TECHNICAL_FIT",
    subjects: ["STARTUP", "TECHNICAL", "CUSTOMER", "ACADEMIC"],
    patterns: [/\b(?:granted patent|proprietary|benchmark improvement|performance advantage|cost reduction|novel method)\b/i]
  },
  VALIDATION: {
    dimension: "PRODUCT_TECHNICAL_FIT",
    subjects: ["CUSTOMER", "TECHNICAL", "ACADEMIC", "REGULATORY"],
    patterns: [/\b(?:independent validation|third-party test|customer pilot|peer-reviewed validation|certified|replicated)\b/i]
  },
  ACADEMIC_ALIGNMENT: {
    dimension: "PRODUCT_TECHNICAL_FIT",
    subjects: ["STARTUP", "TECHNICAL", "ACADEMIC"],
    patterns: []
  },
  WILLINGNESS_TO_PAY: {
    dimension: "REVENUE_PLAUSIBILITY",
    subjects: ["CUSTOMER", "MARKET", "REGULATORY", "STARTUP"],
    patterns: [/\b(?:paid pilot|purchase order|contract value|annual recurring revenue|revenue|subscription price|budget allocated)\b/i]
  },
  UNIT_ECONOMICS: {
    dimension: "REVENUE_PLAUSIBILITY",
    subjects: ["CUSTOMER", "MARKET", "TECHNICAL", "STARTUP"],
    patterns: [/\b(?:gross margin|unit economics|payback period|cost per unit|bill of materials|customer acquisition cost|lifetime value)\b/i]
  },
  SALES_PATH: {
    dimension: "REVENUE_PLAUSIBILITY",
    subjects: ["CUSTOMER", "MARKET", "REGULATORY", "STARTUP"],
    patterns: [/\b(?:sales cycle|distribution partner|channel partner|procurement path|commercial pipeline|conversion rate)\b/i]
  },
  MARKET_SCALE: {
    dimension: "REVENUE_PLAUSIBILITY",
    subjects: ["MARKET", "REGULATORY", "CUSTOMER", "INCUMBENT"],
    patterns: [/\b(?:annual spending|addressable units|market size|serviceable market|installed base|procurement volume)\b/i]
  }
});

const TOPIC_STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "annual", "based", "been", "before", "being",
  "between", "business", "company", "could", "evidence", "from", "have", "into", "market", "more",
  "other", "over", "report", "research", "startup", "study", "than", "that", "their", "there", "these",
  "they", "this", "through", "under", "using", "were", "which", "with", "would", "challenge", "completed",
  "delivered", "delivery", "demonstrated", "deployed", "evidence", "failure", "implemented", "launched", "platform",
  "problem", "product", "prototype", "released", "shipped", "solution", "system", "team", "validated", "validation"
]);

function normalizedTokens(text, excludedTokens) {
  return new Set(
    String(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (token) =>
          token.length >= 5 &&
          !TOPIC_STOP_WORDS.has(token) &&
          !excludedTokens.has(token) &&
          !/^\d+$/.test(token)
      )
  );
}

function sharesTopic(left, right, excludedTokens) {
  const leftTokens = normalizedTokens(`${left.title} ${left.excerpt}`, excludedTokens);
  const rightTokens = normalizedTokens(`${right.title} ${right.excerpt}`, excludedTokens);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function sharedTopicCount(left, right, excludedTokens) {
  const leftTokens = normalizedTokens(`${left.title} ${left.excerpt}`, excludedTokens);
  const rightTokens = normalizedTokens(`${right.title} ${right.excerpt}`, excludedTokens);
  return [...leftTokens].filter((token) => rightTokens.has(token)).length;
}

function hasCompatibleSubjectSource(item) {
  if (item.subject === "ACADEMIC") {
    if (!ACADEMIC_ALIGNMENT_SOURCE_TYPES.has(item.sourceType)) return false;
    return item.roleResolution == null || item.roleResolution === "ACADEMIC_SOURCE_AND_RESEARCH_TEXT";
  }
  if (item.subject === "INCUMBENT") {
    if (item.roleResolution != null) return item.roleResolution === "INCUMBENT_ENTITY_AND_PAIN_TEXT";
    return item.sourceType === "INCUMBENT_PRIMARY";
  }
  return true;
}

function derivedEvidenceCandidates(evidence, policy, asOf, mode, founderNames) {
  return evidence
    .filter((item) => evidenceEligibleForMode(item, mode))
    .filter((item) => policy.subjects.includes(item.subject))
    .filter(hasCompatibleSubjectSource)
    .filter(
      (item) =>
        policy.dimension !== "FOUNDER_EXECUTION" ||
        (hasFounderAttribution(item, founderNames) &&
          founderPolicyLeak(`${item.title} ${item.excerpt}`) == null)
    )
    .filter((item) => !NEGATION_OR_FAILURE.test(`${item.title} ${item.excerpt}`))
    .filter((item) => policy.patterns.some((pattern) => pattern.test(`${item.title} ${item.excerpt}`)))
    .map((item) => ({ evidence: item, quality: computeLiveEvidenceQuality(item, asOf) }))
    .filter((item) => item.quality.quality > 0);
}

function coherentIndependentSet(candidates, excludedTokens) {
  const groups = bestByIndependenceGroup(candidates);
  const items = [...groups.values()].sort((left, right) => {
    const difference = right.quality.quality - left.quality.quality;
    return difference || left.evidence.id.localeCompare(right.evidence.id);
  });
  const coherentIds = new Set();
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      if (sharesTopic(items[leftIndex].evidence, items[rightIndex].evidence, excludedTokens)) {
        coherentIds.add(items[leftIndex].evidence.id);
        coherentIds.add(items[rightIndex].evidence.id);
      }
    }
  }
  return items.filter((item) => coherentIds.has(item.evidence.id));
}

function hasReviewedIndependentSource(items) {
  return items.some(
    (item) =>
      !SELF_AUTHORED_SOURCE_TYPES.has(item.evidence.sourceType) &&
      item.evidence.reviewState !== "UNREVIEWED"
  );
}

function qualifiesForMode(items, mode) {
  if (new Set(items.map((item) => item.evidence.independenceGroup)).size < 2) return false;
  if (mode === "PROVISIONAL") return true;
  return hasReviewedIndependentSource(items);
}

function assessmentFromDerivedEvidence(items, mode) {
  const meanQuality = items.reduce((sum, item) => sum + item.quality.quality, 0) / items.length;
  const externalGroups = new Set(
    items
      .filter((item) => !SELF_AUTHORED_SOURCE_TYPES.has(item.evidence.sourceType))
      .map((item) => item.evidence.independenceGroup)
  ).size;
  let score = 52 + meanQuality * 0.18 + Math.min(5, Math.max(0, items.length - 2) * 2.5);
  // A founder/startup-authored source may corroborate entity details, but it
  // cannot by itself make the automated assessment strong.
  if (externalGroups < 2) score = Math.min(score, 62);
  if (mode === "PROVISIONAL") score = Math.min(score, 58);
  return round(clamp(score, 50, 70));
}

function buildDerivedClaim(criterion, items, mode) {
  const policy = DERIVATION_POLICIES[criterion];
  const isAcademicAlignment = criterion === "ACADEMIC_ALIGNMENT";
  return {
    id: `AUTO-${criterion}`,
    dimension: policy.dimension,
    criterion,
    statement: isAcademicAlignment
      ? "Role-tagged sources support an academic / technical research-alignment signal."
      : `Role-tagged sources contain evidence relevant to ${SCORING_RUBRIC[policy.dimension].criteria[criterion].label.toLowerCase()}.`,
    assessmentScore: assessmentFromDerivedEvidence(items, mode),
    rationale:
      `Conservative deterministic adapter: ${items.length} independent, topically coherent source groups qualified. ` +
      "Keywords only routed candidate excerpts; source roles, review state, and independent corroboration determined scoring eligibility." +
      (isAcademicAlignment
        ? " This signal does not establish peer review, product efficacy, or product adoption."
        : ""),
    evidenceLinks: items
      .slice(0, 4)
      .map((item) => ({ evidenceId: item.evidence.id, stance: "SUPPORT" }))
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))
  };
}

function deriveComparatorClaim(criterion, evidence, asOf, excludedTokens, mode) {
  const startupCandidates = evidence
    .filter((item) => evidenceEligibleForMode(item, mode))
    .filter((item) => new Set(["STARTUP", "TECHNICAL"]).has(item.subject))
    .filter((item) => !NEGATION_OR_FAILURE.test(`${item.title} ${item.excerpt}`))
    .filter((item) =>
      /\b(?:device|exoskeleton|glove|orthosis|product|prototype|robot(?:ic)?|solution|platform|technology|system|validated|demonstrated|reduces?|improves?|prevents?)\b/i.test(
        `${item.title} ${item.excerpt}`
      )
    )
    .map((item) => ({ evidence: item, quality: computeLiveEvidenceQuality(item, asOf) }))
    .filter((item) => item.quality.quality > 0);
  const comparatorCandidates = evidence
    .filter((item) => evidenceEligibleForMode(item, mode))
    .filter((item) =>
      criterion === "INCUMBENT_PAIN"
        ? item.subject === "INCUMBENT" && hasCompatibleSubjectSource(item)
        : item.subject === "ACADEMIC" && hasCompatibleSubjectSource(item)
    )
    .filter((item) => !COMPARATOR_NEGATION.test(`${item.title} ${item.excerpt}`))
    .filter((item) =>
      /\b(?:challenge|bottleneck|deficit|downtime|failure|fatigue|impairment|limited|limitation|loss|risk|shortage|spasticity|unmet|cost|inefficien|need|problem)\b/i.test(
        `${item.title} ${item.excerpt}`
      )
    )
    .map((item) => ({ evidence: item, quality: computeLiveEvidenceQuality(item, asOf) }))
    .filter((item) => item.quality.quality > 0);

  const paired = [];
  for (const startup of startupCandidates) {
    for (const comparator of comparatorCandidates) {
      if (
        startup.evidence.independenceGroup !== comparator.evidence.independenceGroup &&
        sharedTopicCount(startup.evidence, comparator.evidence, excludedTokens) >= 2
      ) {
        paired.push(startup, comparator);
      }
    }
  }
  const items = [...bestByIndependenceGroup(paired).values()]
    .sort((left, right) => right.quality.quality - left.quality.quality || left.evidence.id.localeCompare(right.evidence.id));
  if (!qualifiesForMode(items, mode)) return null;
  return buildDerivedClaim(criterion, items, mode);
}

/**
 * Convert normalized search/upload evidence into a deliberately conservative
 * score input. This is a routing adapter, not an NLP fact checker: a word match
 * only identifies candidates. A criterion is emitted only when role tags,
 * review state, topical coherence, and independent-source requirements pass.
 */
export function buildLiveScoreInput({
  opportunityId,
  asOf,
  evidence,
  companyName,
  founderNames = [],
  thesis = null,
  mode = "REVIEWED"
}) {
  const envelope = { opportunityId, asOf, evidence, companyName, founderNames, thesis, mode };
  assertAllowedKeys(envelope, BUILD_INPUT_FIELDS, "Live score builder input");
  assertText(opportunityId, "Live score builder opportunityId");
  assertText(companyName, "Live score builder companyName");
  assertTimestamp(asOf, "Live score builder asOf");
  if (!Array.isArray(evidence)) throw new Error("Live score builder evidence must be an array.");
  if (!Array.isArray(founderNames)) throw new Error("Live score builder founderNames must be an array.");
  for (const name of founderNames) assertText(name, "Live score builder founder name");
  if (thesis != null && typeof thesis !== "string" && !isPlainObject(thesis)) {
    throw new Error("Live score builder thesis must be text, an object, or null.");
  }
  if (!new Set(["REVIEWED", "PROVISIONAL"]).has(mode)) {
    throw new Error(`Live score builder mode ${String(mode)} is not allowed.`);
  }
  const asOfMs = timestampMs(asOf);
  assertUniqueIds(evidence, "Evidence");
  for (const item of evidence) assertEvidence(item, asOfMs);

  const excludedTokens = normalizedTokens(`${companyName} ${founderNames.join(" ")}`, new Set());
  const claims = [];
  for (const criterion of Object.keys(DERIVATION_POLICIES)) {
    if (criterion === "INCUMBENT_PAIN" || criterion === "ACADEMIC_ALIGNMENT") continue;
    const policy = DERIVATION_POLICIES[criterion];
    const candidates = derivedEvidenceCandidates(evidence, policy, asOf, mode, founderNames);
    const items = coherentIndependentSet(candidates, excludedTokens);
    if (qualifiesForMode(items, mode)) claims.push(buildDerivedClaim(criterion, items, mode));
  }
  for (const criterion of ["INCUMBENT_PAIN", "ACADEMIC_ALIGNMENT"]) {
    const claim = deriveComparatorClaim(criterion, evidence, asOf, excludedTokens, mode);
    if (claim) claims.push(claim);
  }
  const output = {
    opportunityId,
    asOf,
    evidence: [...evidence].sort((left, right) => left.id.localeCompare(right.id)),
    claims: claims.sort((left, right) => left.id.localeCompare(right.id)),
    contradictions: [],
    mode
  };
  assertLiveScoreInput(output);
  return output;
}

function citationFor(evidence, quality) {
  return {
    evidenceId: evidence.id,
    title: evidence.title,
    sourceUrl: evidence.sourceUrl,
    excerpt: evidence.excerpt,
    publishedAt: evidence.publishedAt ?? null,
    capturedAt: evidence.capturedAt,
    sourceType: evidence.sourceType,
    subject: evidence.subject,
    independenceGroup: evidence.independenceGroup,
    reviewState: evidence.reviewState,
    quality: quality.quality,
    flags: [...quality.flags]
  };
}

function bestByIndependenceGroup(items) {
  const best = new Map();
  for (const item of items) {
    if (item.quality.qualityFraction <= 0) continue;
    const group = item.evidence.independenceGroup;
    const previous = best.get(group);
    if (
      !previous ||
      item.quality.qualityFraction > previous.quality.qualityFraction ||
      (item.quality.qualityFraction === previous.quality.qualityFraction && item.evidence.id < previous.evidence.id)
    ) {
      best.set(group, item);
    }
  }
  return best;
}

function aggregateGroupStrength(groupMap) {
  const qualities = [...groupMap.values()]
    .map((item) => item.quality.qualityFraction)
    .sort((left, right) => right - left);
  if (!qualities.length) return 0;
  const diminishing = [1, 0.5, 0.25];
  let complement = 1;
  for (let index = 0; index < Math.min(qualities.length, diminishing.length); index += 1) {
    complement *= 1 - qualities[index] * diminishing[index];
  }
  return round(Math.min(0.95, 1 - complement), 4);
}

function comparisonEligibility(claim, supportGroups) {
  if (claim.criterion !== "INCUMBENT_PAIN" && claim.criterion !== "ACADEMIC_ALIGNMENT") {
    return { required: false, eligible: true, missing: [] };
  }
  const items = [...supportGroups.values()];
  const startup = items.filter((item) => new Set(["STARTUP", "TECHNICAL"]).has(item.evidence.subject));
  const missing = [];
  if (!startup.length) missing.push("STARTUP_OR_TECHNICAL_EVIDENCE");

  let comparator;
  if (claim.criterion === "INCUMBENT_PAIN") {
    comparator = items.filter(
      (item) => item.evidence.subject === "INCUMBENT" && hasCompatibleSubjectSource(item.evidence)
    );
    if (!comparator.length) missing.push("INCUMBENT_PAIN_EVIDENCE");
  } else {
    comparator = items.filter(
      (item) =>
        item.evidence.subject === "ACADEMIC" &&
        hasCompatibleSubjectSource(item.evidence)
    );
    if (!comparator.length) missing.push("ACADEMIC_OR_TECHNICAL_RESEARCH_ALIGNMENT");
  }

  const hasIndependentPair = startup.some((startupItem) =>
    comparator.some(
      (comparatorItem) =>
        startupItem.evidence.independenceGroup !== comparatorItem.evidence.independenceGroup
    )
  );
  if (startup.length && comparator.length && !hasIndependentPair) missing.push("INDEPENDENT_COMPARATOR_SOURCE");
  return {
    required: true,
    eligible: missing.length === 0,
    missing,
    startupEvidenceIds: startup.map((item) => item.evidence.id).sort(),
    comparatorEvidenceIds: comparator.map((item) => item.evidence.id).sort()
  };
}

function scoreClaim(claim, evidenceById, qualityById, contradictions, mode) {
  const linked = claim.evidenceLinks
    .map((link) => ({
      link,
      evidence: evidenceById.get(link.evidenceId),
      quality: qualityById.get(link.evidenceId)
    }))
    .filter((item) => evidenceEligibleForMode(item.evidence, mode));
  let supportGroups = bestByIndependenceGroup(linked.filter((item) => item.link.stance === "SUPPORT"));
  const opposeGroups = bestByIndependenceGroup(linked.filter((item) => item.link.stance === "OPPOSE"));
  const overlappingGroups = [...supportGroups.keys()].filter((group) => opposeGroups.has(group));
  // A copied/related source cannot simultaneously corroborate both sides. The
  // conservative treatment keeps it on the opposing side only.
  for (const group of overlappingGroups) supportGroups.delete(group);

  const supportStrength = aggregateGroupStrength(supportGroups);
  const opposingStrength = aggregateGroupStrength(opposeGroups);
  const comparison = comparisonEligibility(claim, supportGroups);
  const openContradictions = contradictions.filter(
    (item) => item.status === "OPEN" && item.claimIds.includes(claim.id)
  );
  let explicitPenalty = 0;
  for (const contradiction of openContradictions) {
    const contradictionItems = contradiction.evidenceIds
      .map((evidenceId) => ({
        evidence: evidenceById.get(evidenceId),
        quality: qualityById.get(evidenceId)
      }))
      .filter((item) => evidenceEligibleForMode(item.evidence, mode));
    const strength = aggregateGroupStrength(bestByIndependenceGroup(contradictionItems));
    explicitPenalty += SEVERITY_PENALTIES[contradiction.severity] * strength;
  }
  explicitPenalty = Math.min(25, explicitPenalty);

  let status = "SCORED";
  if (!supportGroups.size || supportStrength <= 0) status = "UNSCORED_NO_VERIFIABLE_SUPPORT";
  else if (mode === "PROVISIONAL" && supportGroups.size < 2) {
    status = "UNSCORED_INSUFFICIENT_INDEPENDENCE";
  }
  else if (!comparison.eligible) status = "UNSCORED_INCOMPLETE_COMPARISON";
  else if (openContradictions.length || (supportStrength >= 0.45 && opposingStrength >= 0.45)) status = "CONTESTED";
  else if (supportStrength < 0.35) status = "LOW_EVIDENCE";

  const scorable = !status.startsWith("UNSCORED");
  const scoreBeforeContradictions = scorable
    ? clamp(50 + (claim.assessmentScore - 50) * supportStrength - 25 * opposingStrength, 0, 100)
    : null;
  const score = scorable ? clamp(scoreBeforeContradictions - explicitPenalty, 0, 100) : null;
  const confidence = scorable
    ? clamp(supportStrength * (1 - 0.55 * opposingStrength) * (1 - explicitPenalty / 50))
    : 0;
  const citations = linked
    .filter((item) => item.quality.quality > 0)
    .sort((left, right) => left.evidence.id.localeCompare(right.evidence.id))
    .map((item) => ({ stance: item.link.stance, ...citationFor(item.evidence, item.quality) }));

  return {
    id: claim.id,
    dimension: claim.dimension,
    criterion: claim.criterion,
    criterionLabel: SCORING_RUBRIC[claim.dimension].criteria[claim.criterion].label,
    statement: claim.statement,
    rationale: claim.rationale,
    assessmentScore: claim.assessmentScore,
    score: score == null ? null : round(score),
    scoreBeforeContradictions:
      scoreBeforeContradictions == null ? null : round(scoreBeforeContradictions),
    confidence: round(confidence, 3),
    status,
    supportStrength: round(supportStrength * 100),
    opposingStrength: round(opposingStrength * 100),
    independentSupportingGroups: supportGroups.size,
    independentOpposingGroups: opposeGroups.size,
    correlatedSupportOppositionGroups: overlappingGroups.sort(),
    contradictionPenalty: round(explicitPenalty),
    contradictionIds: openContradictions.map((item) => item.id).sort(),
    comparison,
    citations
  };
}

function computeSubstantiveDimension(key, claims, scoreField = "score") {
  const policy = SCORING_RUBRIC[key];
  const claimsByCriterion = new Map(claims.filter((claim) => claim.dimension === key).map((claim) => [claim.criterion, claim]));
  let coveredWeight = 0;
  let weightedScore = 0;
  let weightedConfidence = 0;
  const criteria = [];
  for (const [criterion, criterionPolicy] of Object.entries(policy.criteria)) {
    const claim = claimsByCriterion.get(criterion);
    const value = claim?.[scoreField] ?? null;
    const covered = value != null;
    if (covered) {
      coveredWeight += criterionPolicy.weight;
      weightedScore += value * criterionPolicy.weight;
      weightedConfidence += claim.confidence * criterionPolicy.weight;
    }
    criteria.push({
      key: criterion,
      label: criterionPolicy.label,
      weight: criterionPolicy.weight,
      covered,
      score: covered ? round(value) : null,
      confidence: covered ? claim.confidence : 0,
      claimId: claim?.id ?? null,
      status: claim?.status ?? "MISSING"
    });
  }
  const observedScore = coveredWeight ? weightedScore / coveredWeight : null;
  const conservativeScore = observedScore == null ? null : 50 + (observedScore - 50) * coveredWeight;
  return {
    key,
    label: policy.label,
    compositeWeight: policy.weight,
    score: conservativeScore == null ? null : round(conservativeScore),
    observedScore: observedScore == null ? null : round(observedScore),
    coverage: round(coveredWeight, 3),
    confidence: round(weightedConfidence, 3),
    criteria
  };
}

function computeEvidenceDimension(scoredClaims, evidenceById, qualityById) {
  const usedIds = new Set(
    scoredClaims
      .filter((claim) => claim.score != null)
      .flatMap((claim) => claim.citations.map((citation) => citation.evidenceId))
  );
  const used = [...usedIds].map((id) => ({ evidence: evidenceById.get(id), quality: qualityById.get(id) }));
  const groups = bestByIndependenceGroup(used);
  const substantiveCoverage =
    ["FOUNDER_EXECUTION", "MARKET_PROBLEM_PULL", "PRODUCT_TECHNICAL_FIT", "REVENUE_PLAUSIBILITY"]
      .map((key) => computeSubstantiveDimension(key, scoredClaims).coverage)
      .reduce((sum, value) => sum + value, 0) / 4;
  const rawMean = groups.size
    ? [...groups.values()].reduce((sum, item) => sum + item.quality.quality, 0) / groups.size
    : null;
  const coveredClaims = scoredClaims.filter((claim) => claim.score != null).length;
  const independenceCoverage = coveredClaims ? Math.min(1, groups.size / (coveredClaims * 1.5)) : 0;
  const score = rawMean == null ? null : rawMean * (0.7 + 0.3 * independenceCoverage);
  const coverage = substantiveCoverage * independenceCoverage;
  return {
    key: "EVIDENCE_QUALITY",
    label: SCORING_RUBRIC.EVIDENCE_QUALITY.label,
    compositeWeight: SCORING_RUBRIC.EVIDENCE_QUALITY.weight,
    score: score == null ? null : round(score),
    observedScore: rawMean == null ? null : round(rawMean),
    coverage: round(coverage, 3),
    confidence: round(coverage * (rawMean == null ? 0 : rawMean / 100), 3),
    independentGroups: groups.size,
    linkedEvidence: usedIds.size,
    independenceCoverage: round(independenceCoverage, 3),
    criteria: []
  };
}

function buildDimensions(scoredClaims, evidenceById, qualityById, scoreField = "score") {
  const substantive = [
    "FOUNDER_EXECUTION",
    "MARKET_PROBLEM_PULL",
    "PRODUCT_TECHNICAL_FIT",
    "REVENUE_PLAUSIBILITY"
  ].map((key) => computeSubstantiveDimension(key, scoredClaims, scoreField));
  const evidence = computeEvidenceDimension(scoredClaims, evidenceById, qualityById);
  const byKey = new Map([...substantive, evidence].map((dimension) => [dimension.key, dimension]));
  return LIVE_DIMENSIONS.map((key) => byKey.get(key));
}

function compositeFromDimensions(dimensions) {
  return dimensions.reduce(
    (sum, dimension) => sum + (dimension.score ?? 50) * dimension.compositeWeight,
    0
  );
}

function comparisonOutput(criterion, scoredClaims) {
  const claim = scoredClaims.find((item) => item.criterion === criterion);
  if (!claim) return { status: "MISSING", claimId: null, score: null, missing: ["COMPARISON_CLAIM"], citations: [] };
  const comparatorSubject = criterion === "INCUMBENT_PAIN" ? "INCUMBENT" : "ACADEMIC";
  return {
    status: claim.comparison.eligible && claim.score != null ? "EVIDENCE_BACKED" : "INCOMPLETE",
    claimId: claim.id,
    score: claim.score,
    missing: [...claim.comparison.missing],
    startupEvidenceIds: claim.comparison.startupEvidenceIds ?? [],
    comparatorEvidenceIds: claim.comparison.comparatorEvidenceIds ?? [],
    citations: claim.citations.filter((citation) =>
      new Set(["STARTUP", "TECHNICAL", comparatorSubject]).has(citation.subject)
    ),
    ...(criterion === "ACADEMIC_ALIGNMENT"
      ? {
          evidenceStandard: "RESEARCH_ALIGNMENT_ONLY",
          doesNotEstablish: ["PEER_REVIEW", "PRODUCT_EFFICACY", "PRODUCT_ADOPTION"]
        }
      : {})
  };
}

function uncertaintyFor(score, coverage, confidence, openContradictions, provisional = false) {
  const contradictionPressure = Math.min(1, openContradictions.length / 3);
  const points = clamp(
    8 + 27 * (1 - coverage) + 15 * (1 - confidence) + 8 * contradictionPressure,
    8,
    40
  );
  const rounded = Math.max(provisional ? 18 : 0, Math.ceil(points));
  const level = rounded >= 28 ? "HIGH" : rounded >= 18 ? "MEDIUM" : "LOW";
  const drivers = [];
  if (coverage < 0.65) drivers.push("MATERIAL_EVIDENCE_GAPS");
  if (confidence < 0.6) drivers.push("LIMITED_SOURCE_STRENGTH");
  if (openContradictions.length) drivers.push("OPEN_CONTRADICTIONS");
  if (!drivers.length) drivers.push("RESIDUAL_MODEL_AND_MARKET_UNCERTAINTY");
  return {
    level,
    points: rounded,
    band: { low: round(clamp(score - rounded, 0, 100)), high: round(clamp(score + rounded, 0, 100)) },
    drivers
  };
}

export function computeLiveOpportunityScore(input) {
  assertLiveScoreInput(input);
  const mode = input.mode ?? "REVIEWED";
  const provisional = mode === "PROVISIONAL";
  const evidence = [...input.evidence].sort((left, right) => left.id.localeCompare(right.id));
  const claims = [...input.claims].sort((left, right) => left.id.localeCompare(right.id));
  const contradictions = [...input.contradictions].sort((left, right) => left.id.localeCompare(right.id));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const qualityById = new Map(
    evidence.map((item) => [item.id, computeLiveEvidenceQuality(item, input.asOf)])
  );
  const scoredClaims = claims.map((claim) =>
    scoreClaim(claim, evidenceById, qualityById, contradictions, mode)
  );
  const dimensions = buildDimensions(scoredClaims, evidenceById, qualityById);
  const dimensionsBeforeContradictions = buildDimensions(
    scoredClaims,
    evidenceById,
    qualityById,
    "scoreBeforeContradictions"
  );
  const compositeBefore = compositeFromDimensions(dimensionsBeforeContradictions);
  const composite = clamp(compositeFromDimensions(dimensions), 0, 100);
  const opportunityScore = round(provisional ? Math.min(74, composite) : composite);
  const contradictionPenalty = round(Math.max(0, compositeBefore - composite));
  const coverageScore = dimensions.reduce(
    (sum, dimension) => sum + dimension.coverage * dimension.compositeWeight,
    0
  );
  const confidenceScore = dimensions.reduce(
    (sum, dimension) => sum + dimension.confidence * dimension.compositeWeight,
    0
  );
  const totalCriteria = Object.entries(SCORING_RUBRIC)
    .filter(([key]) => key !== "EVIDENCE_QUALITY")
    .reduce((sum, [, dimension]) => sum + Object.keys(dimension.criteria).length, 0);
  const coveredCriteria = scoredClaims.filter((claim) => claim.score != null).length;
  const openContradictions = contradictions.filter((item) => item.status === "OPEN");
  const allCitations = evidence
    .filter((item) => evidenceEligibleForMode(item, mode))
    .map((item) => citationFor(item, qualityById.get(item.id)))
    .filter((citation) => citation.quality > 0);

  return {
    schemaVersion: LIVE_SCORE_SCHEMA_VERSION,
    opportunityId: input.opportunityId,
    asOf: input.asOf,
    mode,
    label: "Opportunity score",
    opportunityScore,
    scoreMeaning:
      `A bounded, evidence- and coverage-adjusted ${provisional ? "provisional screening " : ""}opportunity assessment. ` +
      "It is not a probability of success, an investment recommendation, or a measure of founder worth.",
    coverage: {
      score: round(coverageScore, 3),
      percentage: round(coverageScore * 100),
      coveredCriteria,
      totalCriteria,
      missingCriteria: dimensions
        .filter((dimension) => dimension.key !== "EVIDENCE_QUALITY")
        .flatMap((dimension) =>
          dimension.criteria
            .filter((criterion) => !criterion.covered)
            .map((criterion) => `${dimension.key}:${criterion.key}`)
        )
    },
    uncertainty: uncertaintyFor(
      opportunityScore,
      coverageScore,
      confidenceScore,
      openContradictions,
      provisional
    ),
    dimensions,
    claims: scoredClaims,
    comparisons: {
      incumbentPain: comparisonOutput("INCUMBENT_PAIN", scoredClaims),
      academicResearch: comparisonOutput("ACADEMIC_ALIGNMENT", scoredClaims)
    },
    evidenceLedger: evidence.map((item) => ({
      ...citationFor(item, qualityById.get(item.id)),
      retractedAt: item.retractedAt ?? null,
      retractionReason: item.retractionReason ?? null
    })),
    citations: allCitations,
    contradictions: {
      open: openContradictions.map((item) => ({
        id: item.id,
        claimIds: [...new Set(item.claimIds)].sort(),
        evidenceIds: [...new Set(item.evidenceIds)].sort(),
        severity: item.severity,
        note: item.note
      })),
      resolved: contradictions
        .filter((item) => item.status === "RESOLVED")
        .map((item) => item.id),
      includedCompositePenalty: contradictionPenalty
    },
    policy: {
      scoringUnit: "OPPORTUNITY_AND_EXECUTION_EVIDENCE",
      excludedInputs: [
        "PROTECTED_TRAITS",
        "PERSONAL_WORTH",
        "SOCIAL_POPULARITY",
        "PRESTIGE_OR_PEDIGREE",
        "UNCITED_ASSERTIONS"
      ],
      callerDefinedWeightsAccepted: false,
      provisional,
      decisionImpact: !provisional,
      deterministicAsOf: input.asOf
    }
  };
}
