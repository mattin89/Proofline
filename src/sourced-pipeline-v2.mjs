import { SOURCED_PIPELINE_LEADS as V1_LEADS } from "./sourced-pipeline-v1.mjs";

export const SCORED_PIPELINE_CAPTURED_ON = "2026-07-19";
export const SCORED_PIPELINE_VERSION = "proofline.sourced-pipeline.v2";

const SCORE_MEANING = "Automated provisional evidence score, not a probability of success or an investment decision.";
const STAGE_CAVEAT = "Seed stage is the latest public equity stage found as of 2026-07-19; this does not prove that no private or unannounced financing exists.";

function freezeDimensions(rows) {
  const labels = {
    FOUNDER_EXECUTION: "Founder execution evidence",
    MARKET_PROBLEM_PULL: "Market / problem pull",
    PRODUCT_TECHNICAL_FIT: "Product / technical fit",
    EVIDENCE_QUALITY: "Evidence quality",
    REVENUE_PLAUSIBILITY: "Revenue plausibility"
  };
  return Object.freeze(Object.entries(labels).map(([key, label]) => {
    const [score = null, coverage = 0, confidence = 0] = rows[key] || [];
    return Object.freeze({ key, label, score, coverage, confidence });
  }));
}

function freezeComparison(status, score = null) {
  return Object.freeze({ status, score });
}

function scoreSnapshot({
  researchId,
  generatedAt,
  reportedCredits,
  sourceCount,
  opportunityScore,
  coveragePercentage,
  coveredCriteria,
  uncertaintyBand,
  dimensions,
  incumbentPain = ["MISSING", null],
  academicResearch = ["MISSING", null]
}) {
  return Object.freeze({
    schemaVersion: "proofline.live-score.v1",
    researchId,
    provider: "Tavily",
    captureMethod: "PROOFLINE_LIVE_TAVILY_INVESTIGATION",
    generatedAt,
    capturedOn: SCORED_PIPELINE_CAPTURED_ON,
    queryCount: 3,
    sourceCount,
    reportedCredits,
    estimatedCreditsUpperBound: 4,
    exaRequested: false,
    scoreMode: "PROVISIONAL",
    reviewState: "UNREVIEWED",
    scoreMeaning: SCORE_MEANING,
    opportunityScore,
    coveragePercentage,
    coveredCriteria,
    totalCriteria: 16,
    uncertaintyLevel: "HIGH",
    uncertaintyPoints: 40,
    uncertaintyBand: Object.freeze({ low: uncertaintyBand[0], high: uncertaintyBand[1] }),
    uncertaintyDrivers: Object.freeze(["MATERIAL_EVIDENCE_GAPS", "LIMITED_SOURCE_STRENGTH"]),
    dimensions: freezeDimensions(dimensions),
    comparisons: Object.freeze({
      incumbentPain: freezeComparison(...incumbentPain),
      academicResearch: freezeComparison(...academicResearch)
    }),
    comparisonCaveat: "Automated comparator matches are unreviewed and may be irrelevant; inspect citations before relying on them."
  });
}

const FRESH_SNAPSHOTS = Object.freeze({
  "LEAD-MDSIM-2025-SEED": scoreSnapshot({
    researchId: "RES-0eb7be3f8403d8dc",
    generatedAt: "2026-07-19T08:48:09.832Z",
    reportedCredits: 3,
    sourceCount: 11,
    opportunityScore: 47.7,
    coveragePercentage: 5.3,
    coveredCriteria: 1,
    uncertaintyBand: [7.7, 87.7],
    dimensions: {
      PRODUCT_TECHNICAL_FIT: [50.8, 0.2, 0.101],
      EVIDENCE_QUALITY: [32.5, 0.05, 0.016]
    },
    academicResearch: ["EVIDENCE_BACKED", 54]
  }),
  "LEAD-SWARM-2025-SEED": scoreSnapshot({
    researchId: "RES-d27efcfe11a0cf02",
    generatedAt: "2026-07-19T08:48:12.140Z",
    reportedCredits: 3,
    sourceCount: 15,
    opportunityScore: 47.7,
    coveragePercentage: 5.3,
    coveredCriteria: 1,
    uncertaintyBand: [7.7, 87.7],
    dimensions: {
      PRODUCT_TECHNICAL_FIT: [50.7, 0.2, 0.09],
      EVIDENCE_QUALITY: [32.5, 0.05, 0.016]
    },
    academicResearch: ["EVIDENCE_BACKED", 53.5]
  }),
  "LEAD-YUTORI-2025-SEED": scoreSnapshot({
    researchId: "RES-6764f57da110a1f7",
    generatedAt: "2026-07-19T08:48:12.882Z",
    reportedCredits: 4,
    sourceCount: 16,
    opportunityScore: 50,
    coveragePercentage: 0,
    coveredCriteria: 0,
    uncertaintyBand: [10, 90],
    dimensions: {}
  }),
  "LEAD-NASCENT-2025-SEED": scoreSnapshot({
    researchId: "RES-c3841093824aee4b",
    generatedAt: "2026-07-19T08:49:23.790Z",
    reportedCredits: 3,
    sourceCount: 11,
    opportunityScore: 48.2,
    coveragePercentage: 11.9,
    coveredCriteria: 2,
    uncertaintyBand: [8.2, 88.2],
    dimensions: {
      PRODUCT_TECHNICAL_FIT: [51.7, 0.45, 0.214],
      EVIDENCE_QUALITY: [34, 0.113, 0.038]
    },
    academicResearch: ["EVIDENCE_BACKED", 54.1]
  }),
  "LEAD-SPACEDOTS-2025-SEED": scoreSnapshot({
    researchId: "RES-3a5e85e249a2f218",
    generatedAt: "2026-07-19T08:49:29.827Z",
    reportedCredits: 3,
    sourceCount: 10,
    opportunityScore: 47.7,
    coveragePercentage: 6.5,
    coveredCriteria: 1,
    uncertaintyBand: [7.7, 87.7],
    dimensions: {
      FOUNDER_EXECUTION: [51.1, 0.3, 0.134],
      EVIDENCE_QUALITY: [32.5, 0.075, 0.024]
    }
  })
});

const FACT_UPDATES = Object.freeze({
  "LEAD-MDSIM-2025-SEED": Object.freeze({
    productCaveat: "MDsim's current site says SPINEsim is not a medical device and is not intended for clinical use.",
    additionalLinks: Object.freeze(["https://mdsim.health/company/"]),
    additionalEvidence: Object.freeze([
      Object.freeze({
        id: "VERIFY-MDSIM-COMPANY-2026",
        title: "MDsim company and founder profile",
        url: "https://mdsim.health/company/",
        publishedAt: null,
        provider: "Primary-source verification",
        captureMethod: "PRIMARY_SOURCE_WEB_VERIFICATION"
      })
    ])
  }),
  "LEAD-SWARM-2025-SEED": Object.freeze({
    founderNames: Object.freeze(["Jörg Lamprecht", "Moritz Strube", "Stefan Wilhelm", "Jan P. Schween", "Marc Schöne"]),
    additionalFounderEvidenceIds: Object.freeze(["VERIFY-SWARM-POSSIBLE-2026"]),
    additionalLinks: Object.freeze(["https://www.possible.ventures/companies/swarm-bio"]),
    additionalEvidence: Object.freeze([
      Object.freeze({
        id: "VERIFY-SWARM-POSSIBLE-2026",
        title: "Possible Ventures portfolio profile listing SWARM's five founders",
        url: "https://www.possible.ventures/companies/swarm-bio",
        publishedAt: null,
        provider: "Primary-source verification",
        captureMethod: "PRIMARY_SOURCE_WEB_VERIFICATION"
      })
    ])
  }),
  "LEAD-SPACEDOTS-2025-SEED": Object.freeze({
    nonEquitySupportAsReported: "Nearly £190K (€225K) ESA project funding plus up to €150K in support vouchers",
    additionalLinks: Object.freeze([
      "https://commercialisation.esa.int/2025/12/esa-phi-lab-uk-funding-awarded-to-address-sustainable-agriculture-and-space-environmental-challenges-with-ai/",
      "https://femalefoundersfund.com/press/space-dots-raises-1-5m-seed-round-to-provide-insights-on-orbital-threats/"
    ]),
    additionalEvidence: Object.freeze([
      Object.freeze({
        id: "VERIFY-SPACEDOTS-ESA-2025",
        title: "ESA Phi-Lab UK project funding award",
        url: "https://commercialisation.esa.int/2025/12/esa-phi-lab-uk-funding-awarded-to-address-sustainable-agriculture-and-space-environmental-challenges-with-ai/",
        publishedAt: "2025-12-04",
        provider: "Primary-source verification",
        captureMethod: "PRIMARY_SOURCE_WEB_VERIFICATION"
      }),
      Object.freeze({
        id: "VERIFY-SPACEDOTS-FFF-2025",
        title: "Female Founders Fund seed-round announcement",
        url: "https://femalefoundersfund.com/press/space-dots-raises-1-5m-seed-round-to-provide-insights-on-orbital-threats/",
        publishedAt: "2025-09-18",
        provider: "Primary-source verification",
        captureMethod: "PRIMARY_SOURCE_WEB_VERIFICATION"
      })
    ])
  })
});

export const SCORED_PIPELINE_LEADS = Object.freeze(V1_LEADS.map((lead) => {
  const snapshot = FRESH_SNAPSHOTS[lead.id];
  if (!snapshot) throw new Error(`Missing fresh engine snapshot for ${lead.id}.`);
  const update = FACT_UPDATES[lead.id] || {};
  const additionalLinks = update.additionalLinks || [];
  const additionalEvidence = update.additionalEvidence || [];
  return Object.freeze({
    ...lead,
    ...update,
    id: lead.id,
    recordType: "SCORED_PUBLIC_LEAD",
    founderNames: update.founderNames || lead.founderNames,
    founderEvidenceIds: Object.freeze([...lead.founderEvidenceIds, ...(update.additionalFounderEvidenceIds || [])]),
    links: Object.freeze([...new Set([...lead.links, ...additionalLinks])]),
    evidence: Object.freeze([...lead.evidence, ...additionalEvidence]),
    verificationStatus: "PRIMARY_SOURCES_RETRIEVED_SCORE_UNREVIEWED",
    currentVerification: Object.freeze({
      asOf: SCORED_PIPELINE_CAPTURED_ON,
      latestPublicEquityStageFound: "SEED",
      caveat: STAGE_CAVEAT
    }),
    engineSnapshot: snapshot
  });
}));

export const SCORED_PIPELINE_TOTAL_REPORTED_CREDITS = SCORED_PIPELINE_LEADS.reduce(
  (total, lead) => total + lead.engineSnapshot.reportedCredits,
  0
);

export function findScoredPipelineLead(id) {
  return SCORED_PIPELINE_LEADS.find((lead) => lead.id === id) || null;
}
