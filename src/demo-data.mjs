import { computeLiveOpportunityScore } from "./live-domain.mjs";

export const EMOVO_DEMO_TEMPLATE = Object.freeze({
  companyName: "Emovo Care",
  founderNames: "Luca Randazzo, Iselin Frøybu",
  links: [
    "https://www.emovocare.com/emovo-clinic",
    "https://www.emovocare.com/about",
    "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256",
    "https://actu.epfl.ch/news/exoskeleton-device-helps-stroke-victims-regain-han/",
    "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000"
  ].join("\n"),
  context: "Swiss medical robotics company commercializing a CE-marked motorized hand orthosis for clinical and domestic rehabilitation. Compare public commercial milestones, rehabilitation workforce constraints, stroke hand-function needs, and peer-reviewed evidence for home-based robotic hand rehabilitation."
});

const AS_OF = "2026-07-19T00:00:00.000Z";

const evidence = [
  {
    id: "DEMO-EMOVO-OFFICIAL-PRODUCT",
    title: "Emovo Clinic - commercially available CE-marked hand orthosis",
    sourceUrl: "https://www.emovocare.com/emovo-clinic",
    excerpt: "Emovo Care states that Emovo Clinic is commercially available today and CE-marked under EU MDR. The motorized hand orthosis provides active opening and closing, can be used by multiple patients, and is designed for clinical and domestic settings.",
    capturedAt: AS_OF,
    sourceType: "STARTUP_PRIMARY",
    subject: "STARTUP",
    independenceGroup: "emovocare.com",
    reviewState: "REVIEWED",
    directness: 0.94,
    entityMatchConfidence: 0.99
  },
  {
    id: "DEMO-EMOVO-OFFICIAL-TEAM",
    title: "Emovo Care team and company purpose",
    sourceUrl: "https://emovocare.com/about",
    excerpt: "Emovo Care identifies Luca Randazzo as co-founder and CEO and Iselin Froybu as co-founder and COO. The page describes a Swiss robotics team building accessible assistive devices and a portable orthosis that actively opens and closes the hand.",
    capturedAt: AS_OF,
    sourceType: "STARTUP_PRIMARY",
    subject: "FOUNDER",
    independenceGroup: "emovocare.com",
    reviewState: "REVIEWED",
    directness: 0.9,
    entityMatchConfidence: 0.99
  },
  {
    id: "DEMO-EMOVO-VENTURELAB",
    title: "Venturelab profile and dated commercial milestone ledger",
    sourceUrl: "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256",
    excerpt: "Venturelab reports that Emovo Care incorporated in 2020, has a certified EU medical device, and is generating revenues. Its milestone ledger lists ISO 13485 certification in 2021, a five-figure sale in 2021, CE marking in October 2025, first batch sales in December 2025, and second batch sales in May 2026.",
    capturedAt: AS_OF,
    sourceType: "INDUSTRY_REPORT",
    subject: "STARTUP",
    independenceGroup: "venturelab.swiss",
    reviewState: "REVIEWED",
    directness: 0.87,
    entityMatchConfidence: 0.98
  },
  {
    id: "DEMO-EMOVO-VENTUREKICK",
    title: "Venture Kick award and product-development evidence",
    sourceUrl: "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000",
    excerpt: "Venture Kick awarded Emovo Care CHF 150,000 in May 2020. It reported patent-protected artificial tendons, a lightweight modular motorized orthosis, and product development informed by more than 150 interviews and tests with clinicians and users.",
    capturedAt: AS_OF,
    publishedAt: "2020-05-14T00:00:00.000Z",
    sourceType: "REPUTABLE_NEWS",
    subject: "STARTUP",
    independenceGroup: "venturekick.ch",
    reviewState: "REVIEWED",
    directness: 0.88,
    entityMatchConfidence: 0.98
  },
  {
    id: "DEMO-EMOVO-EPFL-TECH",
    title: "EPFL reports hospital testing and medical-device certification",
    sourceUrl: "https://actu.epfl.ch/news/exoskeleton-device-helps-stroke-victims-regain-han/",
    excerpt: "EPFL reported that the hand exoskeleton was developed with users and therapists over several years, improved through multiple rounds of testing, successfully tested in hospitals and rehabilitation centers, and certified for marketing as a medical device in Europe.",
    capturedAt: AS_OF,
    publishedAt: "2022-05-11T00:00:00.000Z",
    sourceType: "INDEPENDENT_TECHNICAL",
    subject: "TECHNICAL",
    independenceGroup: "epfl.ch",
    reviewState: "REVIEWED",
    directness: 0.9,
    entityMatchConfidence: 0.98
  },
  {
    id: "DEMO-EMOVO-EPFL-MARKET",
    title: "EPFL describes the stroke-related hand-function need",
    sourceUrl: "https://actu.epfl.ch/news/exoskeleton-device-helps-stroke-victims-regain-han/",
    excerpt: "EPFL reported that nearly 12 million people worldwide survive a stroke each year and about half retain some limitation in hand use. It also described many portable robotic systems as too complex or expensive for daily use.",
    capturedAt: AS_OF,
    publishedAt: "2022-05-11T00:00:00.000Z",
    sourceType: "REPUTABLE_NEWS",
    subject: "MARKET",
    independenceGroup: "epfl.ch",
    reviewState: "REVIEWED",
    directness: 0.85,
    entityMatchConfidence: 0.96
  },
  {
    id: "DEMO-WHO-REHAB",
    title: "WHO rehabilitation need and access constraints",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/rehabilitation",
    excerpt: "WHO estimates that 2.4 billion people live with a condition that may benefit from rehabilitation, that need is increasing, and that access is often limited by long waits, shortages of trained professionals, funding gaps, and lack of assistive technology.",
    capturedAt: AS_OF,
    publishedAt: "2024-04-22T00:00:00.000Z",
    sourceType: "GOVERNMENT_OR_REGULATORY",
    subject: "MARKET",
    independenceGroup: "who.int",
    reviewState: "REVIEWED",
    directness: 0.94,
    entityMatchConfidence: 0.96
  },
  {
    id: "DEMO-NHS-STROKE",
    title: "NHS England stroke program and rehabilitation priorities",
    sourceUrl: "https://www.england.nhs.uk/ourwork/clinical-policy/stroke/",
    excerpt: "NHS England reports about 85,000 strokes per year in England and makes improved post-hospital stroke rehabilitation models, wider recovery reviews, and audit-driven pathway improvement explicit health-system priorities.",
    capturedAt: AS_OF,
    sourceType: "INCUMBENT_PRIMARY",
    subject: "INCUMBENT",
    independenceGroup: "england.nhs.uk",
    reviewState: "REVIEWED",
    directness: 0.91,
    entityMatchConfidence: 0.94
  },
  {
    id: "DEMO-PUBMED-SOFT-GLOVE",
    title: "Home-based soft robotic hand glove pilot study",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/32138780/",
    excerpt: "A 2020 clinical pilot in the Journal of NeuroEngineering and Rehabilitation studied a self-administered home program using a soft robotic hand glove for chronic spinal-cord injury and reported improvement in hand function. DOI: 10.1186/s12984-020-00660-y.",
    capturedAt: AS_OF,
    publishedAt: "2020-03-09T00:00:00.000Z",
    sourceType: "PEER_REVIEWED_RESEARCH",
    subject: "ACADEMIC",
    independenceGroup: "pubmed.ncbi.nlm.nih.gov",
    reviewState: "REVIEWED",
    directness: 0.92,
    entityMatchConfidence: 0.9
  }
];

function support(...evidenceIds) {
  return evidenceIds.map((evidenceId) => ({ evidenceId, stance: "SUPPORT" }));
}

const claims = [
  ["DELIVERY_RECORD", "FOUNDER_EXECUTION", 76, "The team moved from development into a certified, commercially available product and completed two reported batches of sales.", "Dated product and milestone sources show delivery beyond a prototype.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-VENTURELAB"]],
  ["LEARNING_VELOCITY", "FOUNDER_EXECUTION", 70, "The product was iterated through extensive stakeholder interviews and multiple rounds of testing.", "Two independent ecosystem sources describe a multi-cycle user and clinician feedback process.", ["DEMO-EMOVO-VENTUREKICK", "DEMO-EMOVO-EPFL-TECH"]],
  ["EVIDENCE_DISCIPLINE", "FOUNDER_EXECUTION", 71, "The public record contains dated certifications, testing milestones, and commercial milestones.", "The evidence is specific enough to request primary certificates and invoices in full diligence.", ["DEMO-EMOVO-VENTURELAB", "DEMO-EMOVO-EPFL-TECH"]],
  ["DOMAIN_EXECUTION", "FOUNDER_EXECUTION", 75, "The team executed in regulated hardware through quality certification, EU medical-device certification, and commercial batches.", "These are observable domain milestones, not pedigree or popularity proxies.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-VENTURELAB"]],
  ["PROBLEM_SEVERITY", "MARKET_PROBLEM_PULL", 76, "Stroke-related hand impairment sits within a large and materially underserved rehabilitation need.", "WHO access constraints and EPFL's stroke-specific figures independently establish severity.", ["DEMO-WHO-REHAB", "DEMO-EMOVO-EPFL-MARKET"]],
  ["BUYER_URGENCY", "MARKET_PROBLEM_PULL", 68, "Health systems explicitly prioritize post-hospital stroke rehabilitation while workforce and access constraints persist.", "The evidence supports urgency at the system level, but not a specific open procurement process.", ["DEMO-WHO-REHAB", "DEMO-NHS-STROKE"]],
  ["MARKET_TIMING", "MARKET_PROBLEM_PULL", 70, "Rising rehabilitation demand and explicit stroke-pathway improvement priorities create a timely adoption context.", "Public health-system and global-health sources describe the transition; they do not prove adoption of this product.", ["DEMO-WHO-REHAB", "DEMO-NHS-STROKE"]],
  ["INCUMBENT_PAIN", "MARKET_PROBLEM_PULL", 69, "Emovo's at-home and clinical use proposition overlaps an incumbent health-system priority to improve post-hospital stroke rehabilitation.", "The startup and incumbent sources are independent and topically aligned.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-NHS-STROKE"]],
  ["TECHNICAL_FEASIBILITY", "PRODUCT_TECHNICAL_FIT", 76, "A motorized hand orthosis has advanced through hospital testing into a CE-marked commercial device.", "Independent testing history and current product status support feasibility.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-EPFL-TECH"]],
  ["DIFFERENTIATION", "PRODUCT_TECHNICAL_FIT", 72, "Patent-protected artificial-tendon architecture and a lightweight modular form factor provide a defensible technical basis.", "The sources support a differentiated mechanism; patent scope still requires claim-level legal review.", ["DEMO-EMOVO-VENTUREKICK", "DEMO-EMOVO-EPFL-TECH"]],
  ["VALIDATION", "PRODUCT_TECHNICAL_FIT", 76, "Independent hospital testing and EU medical-device certification validate implementation milestones.", "Certification and testing do not substitute for product-specific clinical-outcomes evidence.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-EPFL-TECH"]],
  ["ACADEMIC_ALIGNMENT", "PRODUCT_TECHNICAL_FIT", 68, "Peer-reviewed research supports the feasibility of home-based soft robotic hand assistance in a related population.", "The study aligns with the mechanism and delivery setting but does not establish efficacy for Emovo Clinic.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-PUBMED-SOFT-GLOVE"]],
  ["WILLINGNESS_TO_PAY", "REVENUE_PLAUSIBILITY", 70, "A current commercial product page and Venturelab's dated revenue and batch-sales milestones indicate observed willingness to pay.", "The public record supports sales, while amount, recurrence, and customer concentration remain undisclosed.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-VENTURELAB"]],
  ["SALES_PATH", "REVENUE_PLAUSIBILITY", 65, "The product is sold directly for clinical and domestic use, with earlier public plans to supply clinics and research institutions.", "This supports a direct institutional sales path, but sales-cycle and channel efficiency remain unknown.", ["DEMO-EMOVO-OFFICIAL-PRODUCT", "DEMO-EMOVO-EPFL-TECH"]],
  ["MARKET_SCALE", "REVENUE_PLAUSIBILITY", 69, "Public-health and stroke-specific figures establish a large addressable-need pool.", "Need prevalence is not revenue; pricing, reimbursement, reachable accounts, and penetration are still required for a forecast.", ["DEMO-WHO-REHAB", "DEMO-EMOVO-EPFL-MARKET"]]
].map(([criterion, dimension, assessmentScore, statement, rationale, evidenceIds]) => ({
  id: `DEMO-CLAIM-${criterion}`,
  dimension,
  criterion,
  statement,
  assessmentScore,
  rationale,
  evidenceLinks: support(...evidenceIds)
}));

function score(mode) {
  return computeLiveOpportunityScore({
    opportunityId: "DEMO-EMOVO-2026-07-19",
    asOf: AS_OF,
    evidence: structuredClone(evidence),
    claims: structuredClone(claims),
    contradictions: [],
    mode
  });
}

export function createEmovoDemoAssessment() {
  return {
    id: "DEMO-EMOVO-2026-07-19",
    companyName: "Emovo Care",
    founderNames: ["Luca Randazzo", "Iselin Frøybu"],
    sector: "Medical rehabilitation robotics",
    stage: "STAGE_NOT_ESTABLISHED",
    fundingAsReported: "CHF 150K Venture Kick award; current equity stage not established",
    context: EMOVO_DEMO_TEMPLATE.context,
    identityConfirmed: true,
    thesisMatch: true,
    complianceHold: false,
    demoSnapshot: {
      recordType: "NON_BINDING_POLICY_SCREEN",
      capturedAt: AS_OF,
      sourceType: "FROZEN_PUBLIC_SOURCE_SNAPSHOT",
      companyAuthored: false,
      deterministic: true,
      disclaimer: "Frozen public-source demo, not a live-web guarantee, investment commitment, or company-authored plan."
    },
    research: {
      researchId: "DEMO-EMOVO-2026-07-19",
      generatedAt: AS_OF,
      provider: "Frozen cited public-source snapshot",
      summary: "Reviewed public sources document a CE-marked commercial device, revenue and batch-sales milestones, a material rehabilitation need, health-system priorities, and related peer-reviewed research.",
      queries: [],
      evidence: [],
      sourceCount: evidence.length,
      usage: {
        reportedCredits: 0,
        estimatedCreditsUpperBound: 0,
        estimateBasis: "No provider call: deterministic frozen source pack."
      },
      crossValidation: {
        requested: false,
        provider: "Exa",
        status: "NOT_RUN_FOR_FROZEN_DEMO",
        note: "Use the live button to rerun current Tavily plus optional Exa retrieval; results may differ."
      },
      privacy: { fullDocumentSentToResearchProvider: false },
      caveats: [
        "The snapshot is non-binding and does not reserve or transfer capital.",
        "Public revenue milestones do not disclose unit economics, valuation, customer concentration, or recurring revenue."
      ]
    },
    evidence: structuredClone(evidence),
    reviewEvents: evidence.map((item, index) => ({
      id: `DEMO-REVIEW-${index + 1}`,
      type: "SOURCE_REVIEW_ATTESTED",
      evidenceId: item.id,
      occurredAt: AS_OF,
      actor: "PROOFLINE_CURATED_PUBLIC_DEMO",
      attestation: "SOURCE_OPENED_ENTITY_MATCH_AND_EXCERPT_RELEVANCE"
    })),
    previousAxisScores: null,
    provisionalScore: score("PROVISIONAL"),
    reviewedScore: score("REVIEWED")
  };
}
