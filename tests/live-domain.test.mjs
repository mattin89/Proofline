import test from "node:test";
import assert from "node:assert/strict";

import {
  LIVE_DIMENSIONS,
  LIVE_SCORE_SCHEMA_VERSION,
  SCORING_RUBRIC,
  assertLiveScoreInput,
  buildLiveScoreInput,
  computeLiveEvidenceQuality,
  computeLiveOpportunityScore
} from "../src/live-domain.mjs";

const AS_OF = "2026-07-18T12:00:00Z";

function source(id, overrides = {}) {
  return {
    id,
    title: `Evidence ${id}`,
    sourceUrl: `https://evidence.example/${id}`,
    excerpt: "Battery thermal monitoring evidence.",
    capturedAt: "2026-07-17T12:00:00Z",
    publishedAt: "2026-06-01T00:00:00Z",
    sourceType: "INDEPENDENT_TECHNICAL",
    subject: "TECHNICAL",
    independenceGroup: `group-${id}`,
    reviewState: "VERIFIED",
    directness: 0.9,
    entityMatchConfidence: 0.95,
    ...overrides
  };
}

function fixtureEvidence() {
  return [
    source("startup", {
      title: "ThermaSense battery platform",
      excerpt: "A. Researcher and the team shipped a battery thermal-risk monitoring prototype for pack operators.",
      sourceType: "STARTUP_PRIMARY",
      subject: "STARTUP",
      independenceGroup: "startup-site",
      reviewState: "REVIEWED"
    }),
    source("customer", {
      title: "Battery operator deployment record",
      excerpt: "A battery operator confirms A. Researcher and the team delivered a field deployment for thermal-risk monitoring.",
      sourceType: "CUSTOMER_PRIMARY",
      subject: "CUSTOMER",
      independenceGroup: "customer-a"
    }),
    source("lab", {
      title: "Independent battery validation",
      excerpt: "Third-party test results independently validated the battery thermal-risk prototype performance.",
      sourceType: "INDEPENDENT_TECHNICAL",
      subject: "TECHNICAL",
      independenceGroup: "lab-a"
    }),
    source("incumbent", {
      title: "Incumbent battery risk filing",
      excerpt: "The incumbent reports battery thermal failure downtime and safety risk as a material challenge.",
      sourceType: "INCUMBENT_PRIMARY",
      subject: "INCUMBENT",
      independenceGroup: "incumbent-filing"
    }),
    source("paper", {
      title: "Peer-reviewed battery safety study",
      excerpt: "The study identifies battery thermal failure risk and an unmet need for earlier monitoring.",
      sourceType: "PEER_REVIEWED_RESEARCH",
      subject: "ACADEMIC",
      independenceGroup: "doi-10-example"
    }),
    source("order", {
      title: "Battery customer purchase order",
      excerpt: "A battery fleet issued a purchase order and paid pilot contract for thermal monitoring.",
      sourceType: "CUSTOMER_PRIMARY",
      subject: "CUSTOMER",
      independenceGroup: "customer-b"
    }),
    source("market", {
      title: "Battery monitoring annual spending",
      excerpt: "The industry report quantifies annual spending and market size for battery safety monitoring.",
      sourceType: "INDUSTRY_REPORT",
      subject: "MARKET",
      independenceGroup: "market-report"
    })
  ];
}

function baseInput() {
  return {
    opportunityId: "LIVE-THERMA",
    asOf: AS_OF,
    evidence: fixtureEvidence(),
    claims: [
      {
        id: "C-DELIVERY",
        dimension: "FOUNDER_EXECUTION",
        criterion: "DELIVERY_RECORD",
        statement: "The team has an externally corroborated delivery record.",
        assessmentScore: 80,
        rationale: "A customer record corroborates the startup artifact.",
        evidenceLinks: [
          { evidenceId: "startup", stance: "SUPPORT" },
          { evidenceId: "customer", stance: "SUPPORT" }
        ]
      },
      {
        id: "C-INCUMBENT",
        dimension: "MARKET_PROBLEM_PULL",
        criterion: "INCUMBENT_PAIN",
        statement: "The product addresses a documented incumbent battery-safety constraint.",
        assessmentScore: 84,
        rationale: "The startup artifact and incumbent filing address the same technical problem.",
        evidenceLinks: [
          { evidenceId: "startup", stance: "SUPPORT" },
          { evidenceId: "incumbent", stance: "SUPPORT" }
        ]
      },
      {
        id: "C-ACADEMIC",
        dimension: "PRODUCT_TECHNICAL_FIT",
        criterion: "ACADEMIC_ALIGNMENT",
        statement: "The product direction aligns with a documented research need.",
        assessmentScore: 78,
        rationale: "A product artifact is paired with independent peer-reviewed research.",
        evidenceLinks: [
          { evidenceId: "startup", stance: "SUPPORT" },
          { evidenceId: "paper", stance: "SUPPORT" }
        ]
      },
      {
        id: "C-WTP",
        dimension: "REVENUE_PLAUSIBILITY",
        criterion: "WILLINGNESS_TO_PAY",
        statement: "A buyer has supplied direct willingness-to-pay evidence.",
        assessmentScore: 76,
        rationale: "The purchase-order source is direct customer evidence.",
        evidenceLinks: [{ evidenceId: "order", stance: "SUPPORT" }]
      }
    ],
    contradictions: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("returns five separate dimensions and a bounded, non-probabilistic Opportunity score", () => {
  const result = computeLiveOpportunityScore(baseInput());
  assert.equal(result.schemaVersion, LIVE_SCORE_SCHEMA_VERSION);
  assert.equal(result.label, "Opportunity score");
  assert.ok(result.opportunityScore >= 0 && result.opportunityScore <= 100);
  assert.deepEqual(result.dimensions.map((dimension) => dimension.key), LIVE_DIMENSIONS);
  assert.match(result.scoreMeaning, /not a probability of success/i);
  assert.match(result.scoreMeaning, /not.*measure of founder worth/i);
  assert.equal(Object.hasOwn(result, "successProbability"), false);
  assert.equal(result.policy.scoringUnit, "OPPORTUNITY_AND_EXECUTION_EVIDENCE");
  assert.equal(
    Object.values(SCORING_RUBRIC).reduce((sum, dimension) => sum + dimension.weight, 0),
    1
  );
});

test("scored claims and comparator outputs retain traceable citations", () => {
  const result = computeLiveOpportunityScore(baseInput());
  assert.ok(result.claims.every((claim) => claim.score == null || claim.citations.length > 0));
  assert.equal(result.comparisons.incumbentPain.status, "EVIDENCE_BACKED");
  assert.equal(result.comparisons.academicResearch.status, "EVIDENCE_BACKED");
  assert.deepEqual(result.comparisons.incumbentPain.comparatorEvidenceIds, ["incumbent"]);
  assert.deepEqual(result.comparisons.academicResearch.comparatorEvidenceIds, ["paper"]);
  assert.ok(result.citations.every((citation) => citation.sourceUrl.startsWith("https://")));
});

test("sorting the same inputs differently produces byte-identical output", () => {
  const input = baseInput();
  const reversed = clone(input);
  reversed.evidence.reverse();
  reversed.claims.reverse();
  assert.deepEqual(computeLiveOpportunityScore(input), computeLiveOpportunityScore(reversed));
});

test("an uncited high assessment remains unscored and cannot inflate the composite", () => {
  const input = {
    opportunityId: "SPARSE",
    asOf: AS_OF,
    evidence: [],
    claims: [
      {
        id: "C-HYPE",
        dimension: "REVENUE_PLAUSIBILITY",
        criterion: "MARKET_SCALE",
        statement: "The addressable revenue scale is claimed to be large.",
        assessmentScore: 100,
        rationale: "No external material was supplied.",
        evidenceLinks: []
      }
    ],
    contradictions: []
  };
  const result = computeLiveOpportunityScore(input);
  assert.equal(result.claims[0].status, "UNSCORED_NO_VERIFIABLE_SUPPORT");
  assert.equal(result.claims[0].score, null);
  assert.equal(result.opportunityScore, 50);
  assert.equal(result.coverage.coveredCriteria, 0);
  assert.equal(result.uncertainty.level, "HIGH");
});

test("copies in one independence group never create extra corroboration", () => {
  const one = baseInput();
  one.claims = [one.claims[0]];
  const copied = clone(one);
  const original = copied.evidence.find((item) => item.id === "customer");
  for (let index = 0; index < 5; index += 1) {
    copied.evidence.push({
      ...clone(original),
      id: `customer-copy-${index}`,
      sourceUrl: `https://copies.example/${index}`,
      independenceGroup: original.independenceGroup
    });
    copied.claims[0].evidenceLinks.push({ evidenceId: `customer-copy-${index}`, stance: "SUPPORT" });
  }
  const oneResult = computeLiveOpportunityScore(one).claims[0];
  const copiedResult = computeLiveOpportunityScore(copied).claims[0];
  assert.equal(copiedResult.supportStrength, oneResult.supportStrength);
  assert.equal(copiedResult.independentSupportingGroups, oneResult.independentSupportingGroups);
  assert.equal(copiedResult.score, oneResult.score);
});

test("unreviewed, search-snippet, stale, and retracted evidence are capped deterministically", () => {
  const unreviewed = source("unreviewed", {
    sourceType: "SEARCH_SNIPPET",
    reviewState: "UNREVIEWED",
    directness: 1,
    entityMatchConfidence: 1
  });
  const stale = source("stale", {
    sourceType: "REPUTABLE_NEWS",
    publishedAt: "2018-01-01T00:00:00Z",
    directness: 1,
    entityMatchConfidence: 1
  });
  const retracted = source("retracted", {
    retractedAt: "2026-07-01T00:00:00Z",
    retractionReason: "The source corrected the reported result."
  });
  const unreviewedQuality = computeLiveEvidenceQuality(unreviewed, AS_OF);
  const staleQuality = computeLiveEvidenceQuality(stale, AS_OF);
  const retractedQuality = computeLiveEvidenceQuality(retracted, AS_OF);
  assert.ok(unreviewedQuality.quality <= 30);
  assert.ok(unreviewedQuality.flags.includes("UNREVIEWED"));
  assert.ok(staleQuality.quality <= 35);
  assert.ok(staleQuality.flags.includes("SEVERELY_STALE"));
  assert.equal(retractedQuality.quality, 0);
  assert.ok(retractedQuality.flags.includes("RETRACTED"));
});

test("open, cited contradictions reduce claim and composite scores; resolved ones do not", () => {
  const baseline = baseInput();
  baseline.claims = [baseline.claims[0]];
  const open = clone(baseline);
  open.contradictions.push({
    id: "X-DELIVERY",
    claimIds: ["C-DELIVERY"],
    evidenceIds: ["customer"],
    severity: "HIGH",
    status: "OPEN",
    note: "The customer record conflicts with the asserted delivery scope."
  });
  const resolved = clone(open);
  resolved.contradictions[0].status = "RESOLVED";
  const baselineResult = computeLiveOpportunityScore(baseline);
  const openResult = computeLiveOpportunityScore(open);
  const resolvedResult = computeLiveOpportunityScore(resolved);
  assert.ok(openResult.claims[0].score < baselineResult.claims[0].score);
  assert.ok(openResult.opportunityScore < baselineResult.opportunityScore);
  assert.ok(openResult.contradictions.includedCompositePenalty > 0);
  assert.equal(resolvedResult.opportunityScore, baselineResult.opportunityScore);
});

test("an incomplete incumbent or academic comparison is excluded rather than guessed", () => {
  const input = baseInput();
  input.claims = [input.claims.find((claim) => claim.id === "C-INCUMBENT")];
  input.claims[0].evidenceLinks = [{ evidenceId: "incumbent", stance: "SUPPORT" }];
  const result = computeLiveOpportunityScore(input);
  assert.equal(result.claims[0].status, "UNSCORED_INCOMPLETE_COMPARISON");
  assert.equal(result.claims[0].score, null);
  assert.ok(result.claims[0].comparison.missing.includes("STARTUP_OR_TECHNICAL_EVIDENCE"));
  assert.equal(result.comparisons.incumbentPain.status, "INCOMPLETE");
});

test("protected traits, prestige proxies, popularity metrics, and caller weights fail closed", () => {
  const protectedInput = baseInput();
  protectedInput.claims[0].statement = "The founder's age improves expected execution.";
  assert.throws(() => assertLiveScoreInput(protectedInput), /protected characteristic/i);

  const prestigeInput = baseInput();
  prestigeInput.claims[0].rationale = "The founder attended an elite university.";
  assert.throws(() => assertLiveScoreInput(prestigeInput), /prestige proxy/i);

  const namedPrestigeInput = baseInput();
  namedPrestigeInput.claims[0].rationale = "The founder attended Harvard.";
  assert.throws(() => assertLiveScoreInput(namedPrestigeInput), /prestige proxy/i);

  const popularityInput = baseInput();
  popularityInput.claims[0].rationale = "The founder has many followers.";
  assert.throws(() => assertLiveScoreInput(popularityInput), /social-popularity/i);

  const weighted = baseInput();
  weighted.claims[0].weight = 100;
  assert.throws(() => assertLiveScoreInput(weighted), /inadmissible field.*weight/i);

  const protectedField = baseInput();
  protectedField.evidence[0].gender = "inadmissible";
  assert.throws(() => assertLiveScoreInput(protectedField), /inadmissible field.*gender/i);
});

test("future-dated evidence, unsafe citation schemes, duplicates, and duplicate criteria fail closed", () => {
  const future = baseInput();
  future.evidence[0].capturedAt = "2027-01-01T00:00:00Z";
  assert.throws(() => assertLiveScoreInput(future), /captured after asOf/i);

  const unsafe = baseInput();
  unsafe.evidence[0].sourceUrl = "javascript:alert(1)";
  assert.throws(() => assertLiveScoreInput(unsafe), /HTTP, HTTPS, or proofline/i);

  const duplicateEvidence = baseInput();
  duplicateEvidence.evidence.push(clone(duplicateEvidence.evidence[0]));
  assert.throws(() => assertLiveScoreInput(duplicateEvidence), /evidence id .* duplicated/i);

  const duplicateCriterion = baseInput();
  duplicateCriterion.claims.push({ ...clone(duplicateCriterion.claims[0]), id: "C-DELIVERY-2" });
  assert.throws(() => assertLiveScoreInput(duplicateCriterion), /one consolidated claim/i);
});

test("uploaded plans have durable proofline citations but remain source-quality capped", () => {
  const plan = source("plan", {
    sourceUrl: "proofline://upload/plan-001",
    sourceType: "UPLOADED_BUSINESS_PLAN",
    subject: "STARTUP",
    reviewState: "REVIEWED"
  });
  const result = computeLiveEvidenceQuality(plan, AS_OF);
  assert.ok(result.quality < 70);

  const invalid = { ...plan, sourceType: "REPUTABLE_NEWS" };
  assert.throws(() => computeLiveEvidenceQuality(invalid, AS_OF), /Only uploaded business-plan/i);
});

test("the raw-evidence adapter derives only independently corroborated, role-tagged claims", () => {
  const built = buildLiveScoreInput({
    opportunityId: "AUTO-THERMA",
    asOf: AS_OF,
    evidence: fixtureEvidence(),
    companyName: "ThermaSense",
    founderNames: ["A. Researcher"],
    thesis: { sectors: ["climate", "industrial"] }
  });
  const criteria = new Set(built.claims.map((claim) => claim.criterion));
  assert.ok(criteria.has("DELIVERY_RECORD"));
  assert.ok(criteria.has("INCUMBENT_PAIN"));
  assert.ok(criteria.has("ACADEMIC_ALIGNMENT"));
  assert.ok(built.claims.every((claim) => claim.evidenceLinks.length >= 2));
  assert.ok(built.claims.every((claim) => claim.assessmentScore <= 70));
  assert.doesNotThrow(() => assertLiveScoreInput(built));
  const score = computeLiveOpportunityScore(built);
  assert.equal(score.comparisons.incumbentPain.status, "EVIDENCE_BACKED");
  assert.equal(score.comparisons.academicResearch.status, "EVIDENCE_BACKED");
});

test("the adapter leaves founder-only, copied, keyword-only, or negated material unscored", () => {
  const planOnly = source("plan-only", {
    title: "Battery team delivery",
    excerpt: "The battery team shipped a thermal monitoring product.",
    sourceUrl: "proofline://upload/plan-only",
    sourceType: "UPLOADED_BUSINESS_PLAN",
    subject: "STARTUP",
    independenceGroup: "founder-plan",
    reviewState: "REVIEWED"
  });
  const copied = source("copy", {
    title: "Battery team delivery copy",
    excerpt: "The battery team shipped a thermal monitoring product.",
    sourceType: "REPUTABLE_NEWS",
    subject: "STARTUP",
    independenceGroup: "founder-plan"
  });
  const unrelated = source("unrelated", {
    title: "Payroll delivery",
    excerpt: "A payroll vendor shipped a tax automation tool.",
    sourceType: "REPUTABLE_NEWS",
    subject: "STARTUP",
    independenceGroup: "unrelated"
  });
  const negated = source("negated", {
    title: "Battery delivery not verified",
    excerpt: "No evidence shows that the battery product shipped.",
    sourceType: "CUSTOMER_PRIMARY",
    subject: "CUSTOMER",
    independenceGroup: "negated"
  });
  const built = buildLiveScoreInput({
    opportunityId: "AUTO-SPARSE",
    asOf: AS_OF,
    evidence: [planOnly, copied, unrelated, negated],
    companyName: "SparseCo",
    founderNames: [],
    thesis: null
  });
  assert.equal(built.claims.some((claim) => claim.criterion === "DELIVERY_RECORD"), false);
  assert.equal(computeLiveOpportunityScore(built).coverage.coveredCriteria, 0);
});

test("founder names and thesis metadata never become scoring evidence", () => {
  const built = buildLiveScoreInput({
    opportunityId: "NAMES-ONLY",
    asOf: AS_OF,
    evidence: [],
    companyName: "EmptyCo",
    founderNames: ["Famous Founder"],
    thesis: { name: "Prestige-heavy text is ignored", axisWeights: { founder: 1 } }
  });
  const result = computeLiveOpportunityScore(built);
  assert.equal(built.claims.length, 0);
  assert.equal(result.opportunityScore, 50);
  assert.equal(result.coverage.percentage, 0);
});

test("REVIEWED mode excludes every UNREVIEWED source from derived claims and citations", () => {
  const evidence = [
    source("reviewed-a", {
      title: "Battery thermal controller delivery",
      excerpt: "Alex Rivera shipped the battery thermal controller for field monitoring.",
      sourceType: "REPUTABLE_NEWS",
      subject: "STARTUP",
      independenceGroup: "reviewed-host-a",
      reviewState: "REVIEWED"
    }),
    source("reviewed-b", {
      title: "Battery thermal controller deployment",
      excerpt: "Alex Rivera delivered the battery thermal controller for field monitoring.",
      sourceType: "CUSTOMER_PRIMARY",
      subject: "CUSTOMER",
      independenceGroup: "reviewed-host-b",
      reviewState: "VERIFIED"
    }),
    source("unreviewed-c", {
      title: "Battery thermal controller launch",
      excerpt: "Alex Rivera launched the battery thermal controller for field monitoring.",
      sourceType: "REPUTABLE_NEWS",
      subject: "STARTUP",
      independenceGroup: "unreviewed-host-c",
      reviewState: "UNREVIEWED"
    })
  ];
  const built = buildLiveScoreInput({
    opportunityId: "REVIEWED-ISOLATION",
    asOf: AS_OF,
    evidence,
    companyName: "ThermalCo",
    founderNames: ["Alex Rivera"],
    mode: "REVIEWED"
  });
  const delivery = built.claims.find((claim) => claim.criterion === "DELIVERY_RECORD");
  assert.ok(delivery);
  assert.deepEqual(
    delivery.evidenceLinks.map((link) => link.evidenceId),
    ["reviewed-a", "reviewed-b"]
  );

  // Direct callers cannot smuggle an unreviewed link into a reviewed score.
  const contaminated = clone(built);
  contaminated.claims
    .find((claim) => claim.criterion === "DELIVERY_RECORD")
    .evidenceLinks.push({ evidenceId: "unreviewed-c", stance: "SUPPORT" });
  const result = computeLiveOpportunityScore(contaminated);
  assert.ok(
    result.claims.every((claim) =>
      claim.citations.every((citation) => citation.reviewState !== "UNREVIEWED")
    )
  );
  assert.ok(result.citations.every((citation) => citation.reviewState !== "UNREVIEWED"));
  assert.equal(result.evidenceLedger.some((item) => item.reviewState === "UNREVIEWED"), true);
});

test("reviewing provisional evidence cannot make a previously covered criterion disappear", () => {
  const evidence = [
    source("transition-a", {
      title: "Battery thermal delivery",
      excerpt: "Alex Rivera shipped the battery thermal monitoring controller.",
      sourceType: "SEARCH_SNIPPET",
      subject: "STARTUP",
      independenceGroup: "transition-host-a",
      reviewState: "UNREVIEWED"
    }),
    source("transition-b", {
      title: "Battery thermal deployment",
      excerpt: "Alex Rivera delivered the battery thermal monitoring controller.",
      sourceType: "SEARCH_SNIPPET",
      subject: "CUSTOMER",
      independenceGroup: "transition-host-b",
      reviewState: "UNREVIEWED"
    })
  ];
  const build = (items) =>
    buildLiveScoreInput({
      opportunityId: "PROVISIONAL-MONOTONIC",
      asOf: AS_OF,
      evidence: items,
      companyName: "ThermalCo",
      founderNames: ["Alex Rivera"],
      mode: "PROVISIONAL"
    });
  const before = computeLiveOpportunityScore(build(evidence));
  const afterEvidence = clone(evidence);
  afterEvidence[0].reviewState = "REVIEWED";
  const afterInput = build(afterEvidence);
  const after = computeLiveOpportunityScore(afterInput);

  assert.ok(before.claims.some((claim) => claim.criterion === "DELIVERY_RECORD"));
  assert.ok(after.claims.some((claim) => claim.criterion === "DELIVERY_RECORD"));
  assert.equal(
    afterInput.claims.find((claim) => claim.criterion === "DELIVERY_RECORD").evidenceLinks.length,
    2
  );
  assert.ok(after.coverage.percentage >= before.coverage.percentage);
  assert.equal(after.policy.decisionImpact, false);
});

test("founder derivation requires attribution and filters protected, prestige, and popularity evidence", () => {
  const publicity = [
    source("publicity-a", {
      title: "Battery thermal product delivery",
      excerpt: "The company shipped a battery thermal monitoring controller.",
      sourceType: "REPUTABLE_NEWS",
      subject: "STARTUP",
      independenceGroup: "publicity-host-a",
      reviewState: "REVIEWED"
    }),
    source("publicity-b", {
      title: "Battery thermal product deployment",
      excerpt: "The company delivered a battery thermal monitoring controller.",
      sourceType: "CUSTOMER_PRIMARY",
      subject: "CUSTOMER",
      independenceGroup: "publicity-host-b",
      reviewState: "VERIFIED"
    })
  ];
  const build = (evidence, founderNames = []) =>
    buildLiveScoreInput({
      opportunityId: "FOUNDER-ATTRIBUTION",
      asOf: AS_OF,
      evidence,
      companyName: "ThermalCo",
      founderNames,
      mode: "REVIEWED"
    });

  assert.equal(
    build(publicity).claims.some((claim) => claim.dimension === "FOUNDER_EXECUTION"),
    false
  );

  const attributed = clone(publicity);
  attributed[0].excerpt = "Alex Rivera shipped a battery thermal monitoring controller.";
  attributed[1].excerpt = "Alex Rivera delivered a battery thermal monitoring controller.";
  assert.equal(
    build(attributed, ["Alex Rivera"]).claims.some(
      (claim) => claim.criterion === "DELIVERY_RECORD"
    ),
    true
  );

  const founderSources = attributed.map((item) => ({ ...item, subject: "FOUNDER" }));
  assert.equal(
    build(founderSources).claims.some((claim) => claim.criterion === "DELIVERY_RECORD"),
    true
  );

  for (const policyText of [
    "The founder's gender was reported while Alex Rivera shipped the battery thermal controller.",
    "Alex Rivera attended an elite university and shipped the battery thermal controller.",
    "Alex Rivera has many followers and shipped the battery thermal controller."
  ]) {
    const tainted = clone(founderSources);
    tainted[0].excerpt = policyText;
    assert.equal(
      build(tainted).claims.some((claim) => claim.criterion === "DELIVERY_RECORD"),
      false
    );
  }

  const directLeak = baseInput();
  directLeak.evidence.find((item) => item.id === "startup").excerpt +=
    " The founder has many followers.";
  assert.throws(() => assertLiveScoreInput(directLeak), /social-popularity metric/i);
  assert.doesNotMatch(SCORING_RUBRIC.FOUNDER_EXECUTION.criteria.DELIVERY_RECORD.label, /verified/i);
});

test("independent technical academic evidence yields alignment only, not peer-review or efficacy claims", () => {
  const evidence = [
    source("alignment-startup", {
      title: "Battery thermal monitoring solution",
      excerpt: "The battery thermal monitoring solution reduces pack overheating risk.",
      sourceType: "STARTUP_PRIMARY",
      subject: "STARTUP",
      independenceGroup: "alignment-startup-host",
      reviewState: "REVIEWED"
    }),
    source("alignment-research", {
      title: "Battery thermal monitoring technical study",
      excerpt: "The technical study describes battery thermal monitoring risk as a persistent challenge.",
      sourceType: "INDEPENDENT_TECHNICAL",
      subject: "ACADEMIC",
      independenceGroup: "alignment-research-host",
      reviewState: "REVIEWED"
    })
  ];
  const built = buildLiveScoreInput({
    opportunityId: "ACADEMIC-ALIGNMENT",
    asOf: AS_OF,
    evidence,
    companyName: "ThermalCo",
    founderNames: [],
    mode: "REVIEWED"
  });
  const claim = built.claims.find((item) => item.criterion === "ACADEMIC_ALIGNMENT");
  assert.ok(claim);
  assert.match(claim.rationale, /does not establish peer review, product efficacy, or product adoption/i);
  const result = computeLiveOpportunityScore(built);
  assert.equal(result.comparisons.academicResearch.status, "EVIDENCE_BACKED");
  assert.equal(result.comparisons.academicResearch.evidenceStandard, "RESEARCH_ALIGNMENT_ONLY");
  assert.deepEqual(result.comparisons.academicResearch.comparatorEvidenceIds, ["alignment-research"]);
  assert.deepEqual(
    result.comparisons.academicResearch.citations.map((citation) => citation.evidenceId),
    ["alignment-research", "alignment-startup"]
  );
  assert.deepEqual(result.comparisons.academicResearch.doesNotEstablish, [
    "PEER_REVIEW",
    "PRODUCT_EFFICACY",
    "PRODUCT_ADOPTION"
  ]);
});

test("PROVISIONAL mode can surface two independent unreviewed live signals without upgrading them", () => {
  const liveEvidence = [
    source("live-startup", {
      title: "Battery thermal monitoring launch",
      excerpt: "Alex Rivera shipped the battery thermal monitoring prototype for pack diagnostics.",
      sourceType: "SEARCH_SNIPPET",
      subject: "STARTUP",
      independenceGroup: "search-domain-a",
      reviewState: "UNREVIEWED"
    }),
    source("live-customer", {
      title: "Battery thermal field delivery",
      excerpt: "A pack operator reports Alex Rivera delivered the battery thermal field deployment.",
      sourceType: "SEARCH_SNIPPET",
      subject: "CUSTOMER",
      independenceGroup: "search-domain-b",
      reviewState: "UNREVIEWED"
    })
  ];
  const reviewed = buildLiveScoreInput({
    opportunityId: "LIVE-MODE",
    asOf: AS_OF,
    evidence: liveEvidence,
    companyName: "LiveCo",
    founderNames: ["Alex Rivera"],
    thesis: null
  });
  const provisional = buildLiveScoreInput({
    opportunityId: "LIVE-MODE",
    asOf: AS_OF,
    evidence: liveEvidence,
    companyName: "LiveCo",
    founderNames: ["Alex Rivera"],
    thesis: null,
    mode: "PROVISIONAL"
  });
  assert.equal(reviewed.claims.length, 0);
  assert.ok(provisional.claims.some((claim) => claim.criterion === "DELIVERY_RECORD"));
  assert.ok(provisional.claims.every((claim) => claim.assessmentScore <= 58));
  const result = computeLiveOpportunityScore(provisional);
  assert.equal(result.mode, "PROVISIONAL");
  assert.equal(result.policy.provisional, true);
  assert.equal(result.policy.decisionImpact, false);
  assert.ok(result.opportunityScore <= 74);
  assert.notEqual(result.uncertainty.level, "LOW");
  assert.ok(result.evidenceLedger.every((item) => item.reviewState === "UNREVIEWED"));
  assert.ok(result.evidenceLedger.every((item) => item.quality <= 30));
});

test("PROVISIONAL mode still rejects copied or topically unrelated unreviewed snippets", () => {
  const first = source("p-one", {
    title: "Battery thermal delivery",
    excerpt: "Alex Rivera shipped a battery thermal product for monitoring packs.",
    sourceType: "SEARCH_SNIPPET",
    subject: "STARTUP",
    independenceGroup: "same-search-origin",
    reviewState: "UNREVIEWED"
  });
  const copy = {
    ...clone(first),
    id: "p-copy",
    sourceUrl: "https://copy.example/story"
  };
  const unrelated = source("p-unrelated", {
    title: "Payroll tax delivery",
    excerpt: "Alex Rivera shipped a payroll tax tool for accounting departments.",
    sourceType: "SEARCH_SNIPPET",
    subject: "CUSTOMER",
    independenceGroup: "unrelated-search-origin",
    reviewState: "UNREVIEWED"
  });
  const built = buildLiveScoreInput({
    opportunityId: "PROVISIONAL-ADVERSARIAL",
    asOf: AS_OF,
    evidence: [first, copy, unrelated],
    companyName: "LiveCo",
    founderNames: ["Alex Rivera"],
    thesis: null,
    mode: "PROVISIONAL"
  });
  assert.equal(built.claims.some((claim) => claim.criterion === "DELIVERY_RECORD"), false);
});

test("the provisional composite is hard-capped even when caller-authored reviewed claims are maximal", () => {
  const evidence = fixtureEvidence();
  const links = [
    { evidenceId: "customer", stance: "SUPPORT" },
    { evidenceId: "lab", stance: "SUPPORT" }
  ];
  const claims = [];
  for (const [dimension, dimensionPolicy] of Object.entries(SCORING_RUBRIC)) {
    if (dimension === "EVIDENCE_QUALITY") continue;
    for (const criterion of Object.keys(dimensionPolicy.criteria)) {
      const evidenceLinks =
        criterion === "INCUMBENT_PAIN"
          ? [
              { evidenceId: "startup", stance: "SUPPORT" },
              { evidenceId: "incumbent", stance: "SUPPORT" }
            ]
          : criterion === "ACADEMIC_ALIGNMENT"
            ? [
                { evidenceId: "startup", stance: "SUPPORT" },
                { evidenceId: "paper", stance: "SUPPORT" }
              ]
            : links;
      claims.push({
        id: `MAX-${criterion}`,
        dimension,
        criterion,
        statement: `Direct operational evidence supports ${criterion.toLowerCase().replaceAll("_", " ")}.`,
        assessmentScore: 100,
        rationale: "A maximal adversarial input used to verify the provisional ceiling.",
        evidenceLinks
      });
    }
  }
  const result = computeLiveOpportunityScore({
    opportunityId: "PROVISIONAL-CAP",
    asOf: AS_OF,
    evidence,
    claims,
    contradictions: [],
    mode: "PROVISIONAL"
  });
  assert.equal(result.opportunityScore, 74);
  assert.equal(result.policy.decisionImpact, false);
  assert.ok(result.uncertainty.points >= 18);
  const oneGroup = clone(claims[0]);
  oneGroup.id = "ONE-GROUP";
  oneGroup.evidenceLinks = [{ evidenceId: "customer", stance: "SUPPORT" }];
  const oneGroupResult = computeLiveOpportunityScore({
    opportunityId: "PROVISIONAL-ONE-GROUP",
    asOf: AS_OF,
    evidence,
    claims: [oneGroup],
    contradictions: [],
    mode: "PROVISIONAL"
  });
  assert.equal(oneGroupResult.claims[0].status, "UNSCORED_INSUFFICIENT_INDEPENDENCE");
  assert.equal(oneGroupResult.claims[0].score, null);
  assert.throws(
    () => assertLiveScoreInput({ ...baseInput(), mode: "AUTOMATIC_INVEST" }),
    /mode .* not allowed/i
  );
});
