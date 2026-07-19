import { replayEvents } from "../src/domain.mjs";
import { buildAssessment } from "../src/live-workspace.mjs";
import { SEED_EVENTS } from "../src/seed.mjs";
import { SOURCED_PIPELINE_LEADS } from "../src/sourced-pipeline-v1.mjs";

const summaryOnly = process.argv.includes("--summary");
const requested = new Set(process.argv.slice(2).filter((value) => value !== "--summary"));
const leads = requested.size
  ? SOURCED_PIPELINE_LEADS.filter((lead) => requested.has(lead.id) || requested.has(lead.companyName))
  : SOURCED_PIPELINE_LEADS;

if (!leads.length) throw new Error("Pass at least one sourced lead ID or exact company name.");

const thesis = replayEvents(structuredClone(SEED_EVENTS)).thesis;
const baseUrl = process.env.PROOFLINE_BASE_URL || "http://127.0.0.1:4173";

function compactAssessment(lead, assessment) {
  const score = assessment.provisionalScore;
  return {
    leadId: lead.id,
    companyName: assessment.companyName,
    founderNames: assessment.founderNames,
    sector: lead.sector,
    stage: lead.stage,
    fundingAsReported: lead.fundingAsReported,
    sourceDate: lead.sourceDate,
    summary: lead.summary,
    context: lead.context,
    links: lead.links,
    unknowns: lead.unknowns,
    research: {
      researchId: assessment.research.researchId,
      provider: assessment.research.provider,
      generatedAt: assessment.research.generatedAt,
      usage: assessment.research.usage,
      queryCount: assessment.research.queries?.length || 0,
      sourceCount: assessment.evidence.length
    },
    score: {
      mode: score.mode,
      opportunityScore: score.opportunityScore,
      coverage: score.coverage,
      uncertainty: score.uncertainty,
      dimensions: score.dimensions.map(({ key, label, score: value, coverage, confidence }) => ({
        key,
        label,
        score: value,
        coverage,
        confidence
      })),
      comparisons: score.comparisons,
      coveredClaims: score.claims.filter((claim) => claim.score != null).map(({ id, dimension, criterionLabel, score: value, confidence, status, rationale, citations }) => ({
        id,
        dimension,
        criterionLabel,
        score: value,
        confidence,
        status,
        rationale,
        citations
      }))
    },
    evidence: assessment.evidence.map(({ id, title, sourceUrl, excerpt, capturedAt, publishedAt, sourceType, subject, independenceGroup, reviewState, directness, entityMatchConfidence }) => ({
      id,
      title,
      sourceUrl,
      excerpt: excerpt.slice(0, 500),
      capturedAt,
      ...(publishedAt ? { publishedAt } : {}),
      sourceType,
      subject,
      independenceGroup,
      reviewState,
      directness,
      entityMatchConfidence
    }))
  };
}

function summaryAssessment(lead, assessment) {
  const score = assessment.provisionalScore;
  return {
    leadId: lead.id,
    companyName: assessment.companyName,
    founderNames: assessment.founderNames,
    research: {
      researchId: assessment.research.researchId,
      provider: assessment.research.provider,
      generatedAt: assessment.research.generatedAt,
      usage: assessment.research.usage,
      sourceCount: assessment.evidence.length
    },
    score: {
      mode: score.mode,
      opportunityScore: score.opportunityScore,
      coverage: score.coverage,
      uncertainty: score.uncertainty,
      dimensions: score.dimensions.map(({ key, label, score: value, coverage, confidence }) => ({
        key,
        label,
        score: value,
        coverage,
        confidence
      })),
      comparisons: Object.fromEntries(Object.entries(score.comparisons || {}).map(([key, value]) => [key, {
        status: value.status,
        score: value.score,
        startupEvidenceIds: value.startupEvidenceIds || [],
        comparatorEvidenceIds: value.comparatorEvidenceIds || []
      }]))
    },
    evidence: assessment.evidence.map(({ id, title, sourceUrl, sourceType, subject, independenceGroup, reviewState }) => ({
      id,
      title,
      sourceUrl,
      sourceType,
      subject,
      independenceGroup,
      reviewState
    }))
  };
}

const output = [];
for (const lead of leads) {
  const response = await fetch(`${baseUrl}/api/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: lead.companyName,
      founderNames: lead.founderNames,
      links: lead.links,
      context: lead.context,
      crossValidateWithExa: false
    })
  });
  const research = await response.json();
  if (!response.ok) throw new Error(`${lead.companyName}: ${research.error || response.status}`);
  const assessment = buildAssessment({
    research,
    companyName: lead.companyName,
    founderNames: lead.founderNames,
    thesis
  });
  output.push(summaryOnly ? summaryAssessment(lead, assessment) : compactAssessment(lead, assessment));
}

console.log(JSON.stringify(output, null, 2));
