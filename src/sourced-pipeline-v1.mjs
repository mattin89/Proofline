export const SOURCED_PIPELINE_CAPTURED_ON = "2026-07-19";

// Frozen public-source leads retrieved through Proofline's Tavily investigation
// endpoint on 19 Jul 2026. These records preserve retrieval provenance and
// reported round facts, but intentionally contain no score. A score appears
// only after a user runs a current assessment and adds it to the Queue.
export const SOURCED_PIPELINE_LEADS = Object.freeze([
  Object.freeze({
    id: "LEAD-MDSIM-2025-SEED",
    recordType: "SOURCED_PUBLIC_LEAD",
    companyName: "MDsim",
    founderNames: Object.freeze(["Roger Assaker", "Richard Assaker", "Dany Assaker"]),
    sector: "Medical digital twins",
    stage: "SEED",
    fundingAsReported: "€2.3M seed",
    summary: "Patient-specific biomechanical spine models for surgical planning and degeneration prevention.",
    context: "Luxembourg seed-stage medtech developing spine digital twins and surgery-planning software; verify founders, seed stage, funding and current product and regulatory boundaries.",
    links: Object.freeze([
      "https://mdsim.health/2025/06/03/mdsim-closes-2-3-million-seed-round-to-launch-spinesim/",
      "https://mdsim.health/2024/10/23/mdsim-transforming-spine-surgery-through-simulation-technology/"
    ]),
    sourceDate: "2025-06-03",
    verificationStatus: "PRIMARY_SOURCE_RETRIEVED",
    unknowns: Object.freeze(["Valuation", "Revenue and customer counts", "Regulatory clearance and current clinical-use status"]),
    engineSnapshot: Object.freeze({
      researchId: "RES-b928c1987d961445",
      provider: "Tavily",
      reportedCredits: 3,
      sourceCount: 14,
      capturedOn: SOURCED_PIPELINE_CAPTURED_ON
    }),
    evidence: Object.freeze([
      Object.freeze({
        id: "EXT-e0128543b1ec6d32",
        title: "MDsim closes €2.3 million seed round",
        url: "https://mdsim.health/2025/06/03/mdsim-closes-2-3-million-seed-round-to-launch-spinesim/",
        publishedAt: "2025-06-03",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      }),
      Object.freeze({
        id: "EXT-0f2da3246ce1b046",
        title: "MDsim founders and simulation technology",
        url: "https://mdsim.health/2024/10/23/mdsim-transforming-spine-surgery-through-simulation-technology/",
        publishedAt: "2024-10-23",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      })
    ]),
    founderEvidenceIds: Object.freeze(["EXT-0f2da3246ce1b046"]),
    stageEvidenceIds: Object.freeze(["EXT-e0128543b1ec6d32"]),
    publicActivity: Object.freeze({
      actor: "Kadmos Capital",
      actorRole: "Lead investor",
      label: "Led the reported €2.3M seed round",
      sourceDate: "2025-06-03",
      evidenceIds: Object.freeze(["EXT-e0128543b1ec6d32"])
    })
  }),
  Object.freeze({
    id: "LEAD-SWARM-2025-SEED",
    recordType: "SOURCED_PUBLIC_LEAD",
    companyName: "SWARM Biotactics",
    founderNames: Object.freeze(["Moritz Strube", "Stefan Wilhelm"]),
    sector: "Bio-robotics",
    stage: "SEED",
    fundingAsReported: "€10M seed · €13M total",
    summary: "Controllable insect-based sensing systems for dangerous and inaccessible environments.",
    context: "German seed-stage bio-robotics company using controllable insects for sensing; verify founders, seed stage, funding, investors and operational claims.",
    links: Object.freeze([
      "https://www.swarm-biotactics.com/pressreleases/euro-13m-raised-swarm-biotactics-advances-bio-robotics-from-lab-to-field/"
    ]),
    sourceDate: "2025-06-24",
    verificationStatus: "PRIMARY_SOURCE_RETRIEVED",
    unknowns: Object.freeze(["Valuation", "Revenue or contract values", "Independent field-performance results"]),
    engineSnapshot: Object.freeze({
      researchId: "RES-e6d04c63911ac5d8",
      provider: "Tavily",
      reportedCredits: 4,
      sourceCount: 15,
      capturedOn: SOURCED_PIPELINE_CAPTURED_ON
    }),
    evidence: Object.freeze([
      Object.freeze({
        id: "EXT-c012d2c9c96d075f",
        title: "SWARM Biotactics reports €10M seed financing",
        url: "https://www.swarm-biotactics.com/pressreleases/euro-13m-raised-swarm-biotactics-advances-bio-robotics-from-lab-to-field/",
        publishedAt: "2025-06-24",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      })
    ]),
    founderEvidenceIds: Object.freeze(["EXT-c012d2c9c96d075f"]),
    stageEvidenceIds: Object.freeze(["EXT-c012d2c9c96d075f"]),
    publicActivity: Object.freeze({
      actor: "Vertex Ventures US, Possible Ventures & Capnamic",
      actorRole: "Reported investors",
      label: "Backed the reported €10M seed round; Capnamic was identified as the first pre-seed investor",
      sourceDate: "2025-06-24",
      evidenceIds: Object.freeze(["EXT-c012d2c9c96d075f"])
    })
  }),
  Object.freeze({
    id: "LEAD-YUTORI-2025-SEED",
    recordType: "SOURCED_PUBLIC_LEAD",
    companyName: "Yutori",
    founderNames: Object.freeze(["Devi Parikh", "Dhruv Batra", "Abhishek Das"]),
    sector: "AI web agents",
    stage: "SEED",
    fundingAsReported: "$15M seed",
    summary: "AI assistants designed to research and execute multi-step tasks across the web.",
    context: "Seed-stage AI company building web agents; verify founders, seed funding, lead investor and current product activity.",
    links: Object.freeze([
      "https://yutori.com/blog/announcing-mission-and-seed-round",
      "https://radical.vc/portfolio/yutori/"
    ]),
    sourceDate: "2025-03-27",
    verificationStatus: "PRIMARY_SOURCES_RETRIEVED",
    unknowns: Object.freeze(["Valuation", "Revenue and customer counts", "Independent benchmark validation"]),
    engineSnapshot: Object.freeze({
      researchId: "RES-dd98a2fcc73c791c",
      provider: "Tavily",
      reportedCredits: 3,
      sourceCount: 16,
      capturedOn: SOURCED_PIPELINE_CAPTURED_ON
    }),
    evidence: Object.freeze([
      Object.freeze({
        id: "EXT-aef50805cd86c4f2",
        title: "Yutori announces mission and $15M seed round",
        url: "https://yutori.com/blog/announcing-mission-and-seed-round",
        publishedAt: "2025-03-27",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      }),
      Object.freeze({
        id: "EXT-7750b38ed8be41c0",
        title: "Radical Ventures portfolio profile for Yutori",
        url: "https://radical.vc/portfolio/yutori/",
        publishedAt: "2025-03-27",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      })
    ]),
    founderEvidenceIds: Object.freeze(["EXT-aef50805cd86c4f2", "EXT-7750b38ed8be41c0"]),
    stageEvidenceIds: Object.freeze(["EXT-aef50805cd86c4f2"]),
    publicActivity: Object.freeze({
      actor: "Radical Ventures",
      actorRole: "Lead investor",
      label: "Led the reported $15M seed round",
      sourceDate: "2025-03-27",
      evidenceIds: Object.freeze(["EXT-aef50805cd86c4f2", "EXT-7750b38ed8be41c0"])
    })
  }),
  Object.freeze({
    id: "LEAD-NASCENT-2025-SEED",
    recordType: "SOURCED_PUBLIC_LEAD",
    companyName: "Nascent Materials",
    founderNames: Object.freeze(["Chaitanya Sharma"]),
    sector: "Battery materials",
    stage: "SEED",
    fundingAsReported: "$2.3M seed",
    summary: "Flexible cathode-material manufacturing intended to reduce cost, energy use, and supply concentration.",
    context: "Seed-stage battery cathode materials company; verify founder, seed funding, lead investor, NJEDA co-investment and commercialization evidence.",
    links: Object.freeze([
      "https://www.nascentmaterials.com/news/nascent-raises-2-3m-seed-funding/",
      "https://www.njeda.gov/njeda-closes-on-two-new-nj-innovation-evergreen-fund-investments/"
    ]),
    sourceDate: "2025-06-25",
    verificationStatus: "PRIMARY_SOURCES_RETRIEVED",
    unknowns: Object.freeze(["Valuation and revenue", "Customer qualification outcomes", "Scaled yield and unit economics"]),
    engineSnapshot: Object.freeze({
      researchId: "RES-eeee86981fed8adc",
      provider: "Tavily",
      reportedCredits: 3,
      sourceCount: 11,
      generatedAt: "2026-07-19T08:07:34.010Z"
    }),
    evidence: Object.freeze([
      Object.freeze({
        id: "EXT-ca9d58f38595b3f5",
        title: "Nascent Materials reports $2.3M seed financing",
        url: "https://www.nascentmaterials.com/news/nascent-raises-2-3m-seed-funding/",
        publishedAt: "2025-06-25",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      }),
      Object.freeze({
        id: "EXT-016e0c8ce5fe33a8",
        title: "NJEDA closes $750K Nascent Materials co-investment",
        url: "https://www.njeda.gov/njeda-closes-on-two-new-nj-innovation-evergreen-fund-investments/",
        publishedAt: "2025-07-31",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      })
    ]),
    founderEvidenceIds: Object.freeze(["EXT-ca9d58f38595b3f5"]),
    stageEvidenceIds: Object.freeze(["EXT-ca9d58f38595b3f5", "EXT-016e0c8ce5fe33a8"]),
    publicActivity: Object.freeze({
      actor: "SOSV & NJEDA",
      actorRole: "Lead investor and public co-investor",
      label: "SOSV led the reported $2.3M seed round; NJEDA later reported closing its $750K co-investment",
      sourceDate: "2025-07-31",
      evidenceIds: Object.freeze(["EXT-ca9d58f38595b3f5", "EXT-016e0c8ce5fe33a8"])
    })
  }),
  Object.freeze({
    id: "LEAD-SPACEDOTS-2025-SEED",
    recordType: "SOURCED_PUBLIC_LEAD",
    companyName: "Space DOTS",
    founderNames: Object.freeze(["Bianca Cefalo"]),
    sector: "Space intelligence",
    stage: "SEED",
    fundingAsReported: "$1.5M seed · $3.2M total",
    summary: "In-orbit sensors and analytics for spacecraft environmental intelligence and anomaly attribution.",
    context: "Seed-stage space environmental intelligence company; verify founder, seed funding, lead investor, product deployment and current stage.",
    links: Object.freeze([
      "https://www.space-dots.com/news/space-dots-r-secures-1-5m-seed-funding-to-advance-orbital-environmental-intelligence"
    ]),
    sourceDate: "2025-09-18",
    verificationStatus: "PRIMARY_SOURCE_RETRIEVED",
    unknowns: Object.freeze(["Valuation and revenue", "Customer and contract details", "Independent sensor and platform performance"]),
    engineSnapshot: Object.freeze({
      researchId: "RES-c31630f22022d6c2",
      provider: "Tavily",
      reportedCredits: 4,
      sourceCount: 11,
      generatedAt: "2026-07-19T08:07:41.559Z"
    }),
    evidence: Object.freeze([
      Object.freeze({
        id: "EXT-f1e2ac64787da9b8",
        title: "Space DOTS reports $1.5M seed financing",
        url: "https://www.space-dots.com/news/space-dots-r-secures-1-5m-seed-funding-to-advance-orbital-environmental-intelligence",
        publishedAt: "2025-09-18",
        provider: "Tavily",
        captureMethod: "TAVILY_EXTRACT"
      })
    ]),
    founderEvidenceIds: Object.freeze(["EXT-f1e2ac64787da9b8"]),
    stageEvidenceIds: Object.freeze(["EXT-f1e2ac64787da9b8"]),
    publicActivity: Object.freeze({
      actor: "Female Founders Fund",
      actorRole: "Lead investor",
      label: "Led the reported $1.5M seed round",
      sourceDate: "2025-09-18",
      evidenceIds: Object.freeze(["EXT-f1e2ac64787da9b8"])
    })
  })
]);

export const PUBLIC_INVESTOR_ACTIVITY = Object.freeze(SOURCED_PIPELINE_LEADS.map((lead) => {
  const evidenceIds = new Set(lead.publicActivity.evidenceIds);
  return Object.freeze({
    id: `ACTIVITY-${lead.id}`,
    companyName: lead.companyName,
    founderNames: lead.founderNames,
    sector: lead.sector,
    stage: lead.stage,
    fundingAsReported: lead.fundingAsReported,
    ...lead.publicActivity,
    evidence: Object.freeze(lead.evidence.filter((item) => evidenceIds.has(item.id)))
  });
}));
