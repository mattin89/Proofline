import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLiveScoreInput,
  computeLiveOpportunityScore
} from "../src/live-domain.mjs";
import {
  mapSourceType,
  mapSubject,
  normalizeEvidence
} from "../src/live-workspace.mjs";

const AS_OF = "2026-07-19T00:00:00.000Z";
const SUBJECT_CONTEXT = {
  companyName: "Quiet Robotics",
  founderNames: ["Mina Lee"]
};

function rawSource(id, overrides = {}) {
  return {
    id,
    title: `Evidence ${id}`,
    url: `https://${id}.example/story`,
    excerpt: "Public evidence excerpt.",
    sourceType: "THIRD_PARTY",
    queryKind: "ENTITY_AND_FOUNDER",
    captureMethod: "TAVILY_EXTRACT",
    publishedDate: "2026-07-18T00:00:00.000Z",
    relevance: 0.8,
    ...overrides
  };
}

function normalize(items, context = SUBJECT_CONTEXT) {
  return normalizeEvidence(items, AS_OF, context);
}

test("startup-focused third-party articles remain STARTUP regardless of query track", () => {
  const tracks = [
    "ENTITY_AND_FOUNDER",
    "ACADEMIC_VALIDATION",
    "INCUMBENT_PROBLEM_AND_REVENUE"
  ];
  const subjects = tracks.map((queryKind) => {
    const item = rawSource(`target-${queryKind.toLowerCase()}`, {
      queryKind,
      title: "Quiet Robotics launches a soft gripper platform",
      excerpt:
        "Quiet Robotics says its soft gripper platform addresses a manufacturing bottleneck."
    });
    const host = new URL(item.url).hostname;
    return mapSubject(item, mapSourceType(item, host), SUBJECT_CONTEXT);
  });

  assert.deepEqual(subjects, ["STARTUP", "STARTUP", "STARTUP"]);
});

test("ambiguous or context-free query results never become comparator evidence by queryKind alone", () => {
  for (const queryKind of ["ACADEMIC_VALIDATION", "INCUMBENT_PROBLEM_AND_REVENUE"]) {
    const item = rawSource(`ambiguous-${queryKind.toLowerCase()}`, {
      queryKind,
      title: "Automation landscape overview",
      excerpt: "A general overview discusses automation platforms, research, and industry constraints."
    });
    const sourceType = mapSourceType(item, new URL(item.url).hostname);
    const subject = mapSubject(item, sourceType, {});
    assert.equal(
      new Set(["ACADEMIC", "INCUMBENT"]).has(subject),
      false,
      `${queryKind} must not supply semantic subject without entity context`
    );
  }
});

test("genuine research and incumbent operational-pain sources retain their comparator roles", () => {
  const research = rawSource("genuine-research", {
    queryKind: "ACADEMIC_VALIDATION",
    sourceType: "ACADEMIC_RESEARCH",
    title: "Soft robotic gripper safety study",
    excerpt:
      "An independent technical study identifies manufacturing gripper safety risk and an automation bottleneck."
  });
  const incumbent = rawSource("genuine-incumbent", {
    queryKind: "INCUMBENT_PROBLEM_AND_REVENUE",
    title: "Factory operator reports gripper downtime",
    excerpt:
      "A large manufacturer reports manufacturing gripper downtime and safety risk as a costly bottleneck."
  });

  const normalized = normalize([research, incumbent]);
  assert.equal(normalized.find((item) => item.id === "genuine-research").subject, "ACADEMIC");
  assert.equal(
    normalized.find((item) => item.id === "genuine-research").sourceType,
    "INDEPENDENT_TECHNICAL"
  );
  assert.equal(normalized.find((item) => item.id === "genuine-incumbent").subject, "INCUMBENT");
});

test("startup-focused query-track articles cannot create academic or incumbent comparator claims", () => {
  const evidence = normalize([
    rawSource("startup-primary", {
      sourceType: "FIRST_PARTY",
      title: "Quiet Robotics soft gripper platform",
      excerpt:
        "Quiet Robotics offers a soft robotic platform that improves manufacturing gripper operations."
    }),
    rawSource("false-academic", {
      queryKind: "ACADEMIC_VALIDATION",
      title: "Quiet Robotics addresses gripper bottlenecks",
      excerpt:
        "An article about Quiet Robotics says its manufacturing gripper platform addresses a costly bottleneck problem."
    }),
    rawSource("false-incumbent", {
      queryKind: "INCUMBENT_PROBLEM_AND_REVENUE",
      title: "Quiet Robotics targets factory downtime",
      excerpt:
        "An article about Quiet Robotics says its manufacturing gripper platform addresses downtime and safety risk."
    })
  ]);
  const input = buildLiveScoreInput({
    opportunityId: "FALSE-COMPARATORS",
    asOf: AS_OF,
    evidence,
    companyName: SUBJECT_CONTEXT.companyName,
    founderNames: SUBJECT_CONTEXT.founderNames,
    mode: "PROVISIONAL"
  });
  const criteria = new Set(input.claims.map((claim) => claim.criterion));
  assert.equal(criteria.has("ACADEMIC_ALIGNMENT"), false);
  assert.equal(criteria.has("INCUMBENT_PAIN"), false);

  const score = computeLiveOpportunityScore(input);
  assert.equal(score.comparisons.academicResearch.status, "MISSING");
  assert.equal(score.comparisons.academicResearch.score, null);
  assert.equal(score.comparisons.incumbentPain.status, "MISSING");
  assert.equal(score.comparisons.incumbentPain.score, null);
  assert.equal(
    score.dimensions.find((dimension) => dimension.key === "FOUNDER_EXECUTION").coverage,
    0,
    "public comparator-track coverage must not substitute for founder evidence"
  );
});

test("genuine comparator pairs remain evidence-backed with exact, disjoint role traces", () => {
  const evidence = normalize([
    rawSource("startup-solution", {
      sourceType: "FIRST_PARTY",
      title: "Quiet Robotics soft gripper platform",
      excerpt:
        "Quiet Robotics offers a soft robotic platform that improves manufacturing gripper safety and reduces downtime."
    }),
    rawSource("academic-problem", {
      sourceType: "ACADEMIC_RESEARCH",
      queryKind: "ACADEMIC_VALIDATION",
      title: "Soft robotic gripper safety study",
      excerpt:
        "An independent technical study identifies manufacturing gripper safety risk and an automation bottleneck."
    }),
    rawSource("incumbent-problem", {
      queryKind: "INCUMBENT_PROBLEM_AND_REVENUE",
      title: "Factory operator reports gripper downtime",
      excerpt:
        "A large manufacturer reports manufacturing gripper downtime and safety risk as a costly bottleneck."
    })
  ]);
  const input = buildLiveScoreInput({
    opportunityId: "GENUINE-COMPARATORS",
    asOf: AS_OF,
    evidence,
    companyName: SUBJECT_CONTEXT.companyName,
    founderNames: SUBJECT_CONTEXT.founderNames,
    mode: "PROVISIONAL"
  });
  const score = computeLiveOpportunityScore(input);

  assert.equal(score.comparisons.academicResearch.status, "EVIDENCE_BACKED");
  assert.deepEqual(score.comparisons.academicResearch.startupEvidenceIds, ["startup-solution"]);
  assert.deepEqual(score.comparisons.academicResearch.comparatorEvidenceIds, ["academic-problem"]);
  assert.equal(score.comparisons.academicResearch.evidenceStandard, "RESEARCH_ALIGNMENT_ONLY");
  assert.deepEqual(score.comparisons.academicResearch.doesNotEstablish, [
    "PEER_REVIEW",
    "PRODUCT_EFFICACY",
    "PRODUCT_ADOPTION"
  ]);

  assert.equal(score.comparisons.incumbentPain.status, "EVIDENCE_BACKED");
  assert.deepEqual(score.comparisons.incumbentPain.startupEvidenceIds, ["startup-solution"]);
  assert.deepEqual(score.comparisons.incumbentPain.comparatorEvidenceIds, ["incumbent-problem"]);

  for (const comparison of [
    score.comparisons.academicResearch,
    score.comparisons.incumbentPain
  ]) {
    const startupIds = new Set(comparison.startupEvidenceIds);
    assert.ok(comparison.comparatorEvidenceIds.every((id) => !startupIds.has(id)));
    const tracedIds = comparison.citations.map((citation) => citation.evidenceId).sort();
    const expectedIds = [...comparison.startupEvidenceIds, ...comparison.comparatorEvidenceIds].sort();
    assert.deepEqual(tracedIds, expectedIds);
  }
});

test("real-like orthosis and impairment language can establish research alignment without claiming efficacy", () => {
  const evidence = normalize([
    rawSource("orthosis-startup", {
      sourceType: "FIRST_PARTY",
      title: "Motorized hand orthosis for stroke rehabilitation",
      excerpt: "A wearable soft robotic hand exoskeleton device supports finger flexion and extension during rehabilitation."
    }),
    rawSource("orthosis-research", {
      sourceType: "ACADEMIC_RESEARCH",
      queryKind: "ACADEMIC_VALIDATION",
      title: "Soft robotic glove clinical trial",
      excerpt: "A clinical trial studies stroke patients with impaired and limited hand function using a soft robotic glove."
    })
  ]);
  const input = buildLiveScoreInput({
    opportunityId: "REAL-LIKE-ALIGNMENT",
    asOf: AS_OF,
    evidence,
    companyName: SUBJECT_CONTEXT.companyName,
    founderNames: SUBJECT_CONTEXT.founderNames,
    mode: "PROVISIONAL"
  });
  const score = computeLiveOpportunityScore(input);

  assert.equal(score.comparisons.academicResearch.status, "EVIDENCE_BACKED");
  assert.equal(score.comparisons.academicResearch.evidenceStandard, "RESEARCH_ALIGNMENT_ONLY");
  assert.deepEqual(score.comparisons.academicResearch.doesNotEstablish, [
    "PEER_REVIEW",
    "PRODUCT_EFFICACY",
    "PRODUCT_ADOPTION"
  ]);
});

test("an unrelated annual report cannot pair on one generic financial term", () => {
  const evidence = normalize([
    rawSource("robot-startup", {
      sourceType: "FIRST_PARTY",
      title: "Robotic hand exoskeleton",
      excerpt: "A robotic rehabilitation device supports stroke therapy, backed by financial support for product development."
    }),
    rawSource("energy-report", {
      queryKind: "INCUMBENT_PROBLEM_AND_REVENUE",
      title: "Annual consolidated financial statements",
      excerpt: "The company reports energy inflation costs, financial risk, borrowings, and operational performance."
    })
  ]);
  const input = buildLiveScoreInput({
    opportunityId: "UNRELATED-ANNUAL-REPORT",
    asOf: AS_OF,
    evidence,
    companyName: SUBJECT_CONTEXT.companyName,
    founderNames: SUBJECT_CONTEXT.founderNames,
    mode: "PROVISIONAL"
  });
  const score = computeLiveOpportunityScore(input);

  assert.equal(score.comparisons.incumbentPain.status, "MISSING");
  assert.equal(score.comparisons.incumbentPain.score, null);
  assert.equal(input.claims.some((claim) => claim.criterion === "INCUMBENT_PAIN"), false);
});
