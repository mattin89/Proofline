const SYNTHETIC_META = Object.freeze({
  synthetic: true,
  decisionUse: "demonstration_only",
  identityNamespace: "SYNTHETIC_V1"
});

function evidence(id, overrides) {
  return {
    id,
    kind: "REPUTABLE_SECONDARY",
    title: "Synthetic evidence",
    sourceUrl: `https://example.invalid/proofline/${id}`,
    excerpt: "Fictional evidence fixture.",
    capturedAt: "2026-07-17T10:00:00.000Z",
    validAt: "2026-07-17T10:00:00.000Z",
    independenceGroup: id,
    entityMatchConfidence: 0.98,
    directness: 0.75,
    temporalFit: 0.95,
    sourceReliability: 0.75,
    recency: 0.98,
    reviewState: "VERIFIED",
    syntheticFixture: true,
    ...overrides
  };
}

function observation(id, dimension, score, quality, overrides = {}) {
  const evidencePrefix = id.split("-")[0];
  return {
    id,
    dimension,
    score,
    evidenceQuality: quality,
    independenceGroup: id,
    observedAt: "2026-07-17T10:00:00.000Z",
    source: "VERIFIED_ARTIFACT",
    description: "Synthetic, task-relevant founder evidence.",
    evidenceIds: [`${evidencePrefix}-E01`],
    ...overrides
  };
}

const thesis = {
  id: "THESIS-001",
  version: 1,
  name: "Frontier systems — first institutional check",
  sectors: ["Neurotechnology", "Soft robotics", "Industrial automation", "Climate technology"],
  stages: ["Pre-seed", "Seed"],
  geographies: ["Europe", "United States"],
  checkSize: { min: 100000, max: 100000, currency: "USD" },
  ownershipMinPct: 0.5,
  ownershipMaxPct: 2,
  riskAppetite: "Bold technical risk; moderate regulatory risk",
  hardExclusions: [
    "Consumer surveillance",
    "Inferred sensitive traits",
    "Unconsented health data"
  ],
  axisRecommendFloors: { FOUNDER: 65, MARKET: 60, IDEA_MARKET: 65 },
  axisRejectFloors: { FOUNDER: 42, MARKET: 40, IDEA_MARKET: 45 },
  decisionHorizonHours: 24
};

const nuraFlex = {
  ...SYNTHETIC_META,
  id: "SYN-C001",
  founderId: "SYN-F-CEDAR",
  founderName: "Elena Rossi",
  companyName: "NuraFlex",
  oneLiner: "A variable-stiffness neurorehabilitation glove for repeatable hand therapy.",
  direction: "OUTBOUND",
  sourceChannel: "CH-OPEN-RESEARCH",
  sourceLabel: "Open research + repository",
  discoveryReason:
    "A university poster on compliant actuation and a small controller contribution matched the thesis before a company profile or fundraise existed.",
  companyStage: "Pre-seed",
  geography: "Europe",
  sectors: ["Neurotechnology", "Soft robotics"],
  pipelineStage: "PROOF_REQUESTED",
  identityState: "CONFIRMED",
  elapsedMinutes: 312,
  profileCoverage: {
    publicCode: "observed_relevant_artifact",
    professionalProfile: "not_observed",
    priorFunding: "not_observed",
    publications: "observed_relevant_artifact",
    followers: "not_collected",
    educationPrestige: "not_collected"
  },
  auditOnlyPrestige: {
    warmIntroduction: false,
    eliteSchool: null,
    followers: null,
    acceleratorBadge: null,
    decisionAccess: "blocked"
  },
  evidence: [
    evidence("NUR-E01", {
      kind: "SELF_REPORT",
      title: "Founder application",
      excerpt:
        "The current prototype actively modulates cable tension. It has no paid pilots and has not been tested with patients.",
      independenceGroup: "nura-founder",
      directness: 0.78,
      sourceReliability: 0.48
    }),
    evidence("NUR-E02", {
      kind: "OFFICIAL_PRIMARY",
      title: "University laboratory poster — prior prototype",
      excerpt: "The glove uses passive elastic elements to assist finger extension.",
      capturedAt: "2026-06-21T09:20:00.000Z",
      validAt: "2026-03-04T00:00:00.000Z",
      independenceGroup: "nura-lab-poster",
      directness: 0.9,
      sourceReliability: 0.9,
      recency: 0.72
    }),
    evidence("NUR-E03", {
      kind: "PUBLIC_WORK",
      title: "Controller repository history",
      excerpt: "Recent commits add closed-loop cable-tension control and a stiffness calibration routine.",
      independenceGroup: "nura-repository",
      directness: 0.82,
      sourceReliability: 0.74
    }),
    evidence("NUR-E04", {
      kind: "VERIFIED_ARTIFACT",
      title: "Three consented clinic interviews",
      excerpt:
        "Therapists described time-consuming manual fit adjustment and inconsistent assistance across sessions; no clinic committed to purchase.",
      independenceGroup: "nura-clinic-interviews",
      directness: 0.9,
      sourceReliability: 0.82
    }),
    evidence("NUR-E05", {
      kind: "OFFICIAL_PRIMARY",
      title: "European rehabilitation procurement brief",
      excerpt:
        "Outpatient rehabilitation providers report staffing pressure and demand for measurable, repeatable therapy workflows.",
      independenceGroup: "nura-procurement-brief",
      directness: 0.78,
      sourceReliability: 0.88
    }),
    evidence("NUR-E06", {
      kind: "OFFICIAL_PRIMARY",
      title: "Laboratory contribution record",
      excerpt:
        "Elena Rossi authored the controller module and calibration protocol; hardware design was shared across the lab team.",
      independenceGroup: "nura-lab-record",
      directness: 0.9,
      sourceReliability: 0.88
    })
  ],
  claims: [
    {
      id: "NUR-C01",
      statement: "The current NuraFlex prototype actively modulates joint stiffness under load.",
      type: "FOUNDER_STATEMENT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-17T09:12:00.000Z",
      evidenceLinks: [
        { evidenceId: "NUR-E01", stance: "support" },
        { evidenceId: "NUR-E03", stance: "support" },
        { evidenceId: "NUR-E02", stance: "oppose" }
      ]
    },
    {
      id: "NUR-C02",
      statement: "Elena led the controller and calibration work, but not the entire glove hardware design.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "FOUNDER",
      observedAt: "2026-07-17T10:14:00.000Z",
      evidenceLinks: [
        { evidenceId: "NUR-E03", stance: "support" },
        { evidenceId: "NUR-E06", stance: "support" }
      ]
    },
    {
      id: "NUR-C03",
      statement: "Rehabilitation clinics experience a costly fit-adjustment and repeatability problem.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "MARKET",
      observedAt: "2026-07-17T18:10:00.000Z",
      evidenceLinks: [
        { evidenceId: "NUR-E04", stance: "support" },
        { evidenceId: "NUR-E05", stance: "support" }
      ]
    },
    {
      id: "NUR-C04",
      statement: "NuraFlex currently has no paid pilots and no patient-test evidence.",
      type: "FOUNDER_STATEMENT",
      materiality: "MEDIUM",
      decisionCritical: false,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-17T09:12:00.000Z",
      evidenceLinks: [{ evidenceId: "NUR-E01", stance: "support" }]
    }
  ],
  contradictions: [
    {
      id: "NUR-X01",
      claimIds: ["NUR-C01"],
      evidenceIds: ["NUR-E01", "NUR-E02", "NUR-E03"],
      severity: "HIGH",
      status: "OPEN",
      title: "Active versus passive actuator architecture",
      note: "The source dates suggest different prototype generations, but the distinction is not yet verified."
    }
  ],
  founderObservations: [
    observation("NUR-O01", "DOMAIN_DEPTH", 74, 0.76, {
      description: "Relevant actuation research and calibration work were verified."
    }),
    observation("NUR-O02", "DOMAIN_DEPTH", 68, 0.62, {
      description: "Application accurately scoped the founder's technical contribution."
    }),
    observation("NUR-O03", "EXECUTION", 58, 0.62, {
      description: "Built and documented a functioning laboratory prototype."
    }),
    observation("NUR-O04", "EXECUTION", 54, 0.56, {
      description: "Repository history shows sustained implementation work."
    }),
    observation("NUR-O05", "EVIDENCE_DISCIPLINE", 64, 0.68, {
      description: "Explicitly disclosed the absence of patient tests and paid pilots."
    }),
    observation("NUR-O06", "EVIDENCE_DISCIPLINE", 58, 0.58, {
      description: "Distinguished controller ownership from shared hardware work."
    }),
    observation("NUR-O07", "LEARNING", 56, 0.58, {
      description: "Revised the product hypothesis after clinic interviews."
    }),
    observation("NUR-O08", "LEARNING", 60, 0.58, {
      description: "Retained unfavorable workflow evidence in the interview summary."
    })
  ],
  axisInputs: {
    FOUNDER: {
      label: "Founder",
      trend: "FLAT",
      dimensions: [
        { key: "persistent_evidence", label: "Persistent evidence", useFounderScore: true, weight: 0.4 },
        {
          key: "current_execution",
          label: "Current execution",
          value: 58,
          confidence: 0.64,
          weight: 0.25,
          claimIds: ["NUR-C02"]
        },
        {
          key: "domain_relevance",
          label: "Domain relevance",
          value: 78,
          confidence: 0.76,
          weight: 0.2,
          claimIds: ["NUR-C02"]
        },
        { key: "team_coverage", label: "Team coverage", value: 68, confidence: 0.62, weight: 0.15 }
      ]
    },
    MARKET: {
      label: "Market",
      trend: "UP",
      dimensions: [
        { key: "pain", label: "Pain intensity", value: 76, confidence: 0.78, weight: 0.3, claimIds: ["NUR-C03"] },
        { key: "urgency", label: "Urgency", value: 70, confidence: 0.72, weight: 0.25, claimIds: ["NUR-C03"] },
        { key: "reach", label: "Reachable market", value: 65, confidence: 0.68, weight: 0.25, claimIds: ["NUR-C03"] },
        { key: "tailwind", label: "Structural tailwind", value: 74, confidence: 0.74, weight: 0.2, claimIds: ["NUR-C03"] }
      ]
    },
    IDEA_MARKET: {
      label: "Idea vs. market",
      trend: "UNKNOWN",
      dimensions: [
        { key: "problem_solution", label: "Problem-solution fit", value: 68, confidence: 0.7, weight: 0.3, claimIds: ["NUR-C03"] },
        { key: "feasibility", label: "Technical feasibility", value: 42, confidence: 0.44, weight: 0.3, claimIds: ["NUR-C01"] },
        { key: "differentiation", label: "Differentiation", value: 72, confidence: 0.64, weight: 0.2, claimIds: ["NUR-C01"] },
        { key: "validation", label: "Controlled validation", value: null, confidence: 0, weight: 0.2, claimIds: ["NUR-C01"] }
      ]
    }
  },
  evidenceContracts: [
    {
      id: "NUR-EC01",
      title: "Active stiffness verification",
      status: "PROPOSED",
      triggerClaimIds: ["NUR-C01"],
      question: "Can the current prototype measurably change stiffness under the same external load?",
      requestedArtifact:
        "Unedited bench-test video, force-displacement CSV for three load cycles, test protocol, and a passive-control run.",
      successCriteria: [
        "Test conditions and prototype version are disclosed",
        "Active and passive runs use the same fixture",
        "Raw cycles and failures are retained",
        "An independent reviewer can reproduce the stiffness calculation"
      ],
      timeBudgetMinutes: 90,
      privacyRisk: "Low",
      expectedDecisionImpact: "High",
      allowedInference:
        "Whether this prototype supports the narrow active-stiffness claim and whether the founder followed the evidence protocol.",
      prohibitedInference:
        "Personality, resilience, integrity, intelligence, or probability of venture success.",
      alternativeEvidence:
        "Existing timestamped force-displacement data using a comparable fixture is acceptable.",
      noncompletionSemantics: "The claim remains unresolved; the Founder Score does not decrease.",
      appealPath: "Founder may correct the prototype version, submit equivalent evidence, or request human review.",
      rulesetVersion: "DCEC-1.0"
    }
  ],
  openQuestions: [
    "Does the current prototype actively modulate stiffness, or is the effect passive?",
    "Can clinic pain translate into a budgeted pilot before patient testing?",
    "Which team member owns hardware design and clinical quality systems?"
  ],
  memoDraft: {
    snapshot:
      "NuraFlex is a fictional pre-seed neurorehabilitation system surfaced before fundraising from a laboratory poster and controller contribution.",
    hypotheses: [
      "Active stiffness control could improve therapy repeatability without replacing clinician judgment.",
      "A narrow outpatient-clinic wedge may be testable before a broader medical-device program."
    ],
    strengths: ["Relevant technical evidence", "Explicit disclosure of missing traction", "Observable clinic pain"],
    weaknesses: ["Architecture conflict", "No patient tests", "No paid pilots"],
    opportunities: ["Staffing pressure", "Measurable therapy workflows", "Research-to-clinic translation"],
    threats: ["Regulatory pathway", "Hardware reliability", "Procurement cycles"],
    problemProduct:
      "Therapists manually adjust assistance across sessions. NuraFlex proposes a glove whose cable tension can be calibrated and modulated during therapy.",
    tractionKpis:
      "No paid traction. Three synthetic clinic interviews support the workflow problem; technical performance remains under proof review."
  },
  timeline: [
    { occurredAt: "2026-07-17T08:48:00.000Z", type: "SOURCE_SIGNAL", label: "Thesis-matched weak signal surfaced" },
    { occurredAt: "2026-07-17T09:12:00.000Z", type: "APPLICATION", label: "Founder accepted invitation and supplied a scoped application" },
    { occurredAt: "2026-07-17T10:30:00.000Z", type: "CONTRADICTION", label: "Active/passive architecture conflict preserved" },
    { occurredAt: "2026-07-17T11:05:00.000Z", type: "PROOF_OFFERED", label: "Bounded evidence request proposed" }
  ],
  liveResearchQuery:
    "2026 Europe neurorehabilitation robotic glove outpatient clinic adoption reimbursement procurement evidence"
};

const helioLedger = {
  ...SYNTHETIC_META,
  id: "SYN-C002",
  founderId: "SYN-F-QUARTZ",
  founderName: "Adrian Keller",
  companyName: "HelioLedger",
  oneLiner: "Energy-accounting software for industrial heat and power systems.",
  direction: "INBOUND",
  sourceChannel: "CH-ACCELERATOR-INBOUND",
  sourceLabel: "Inbound accelerator deck",
  discoveryReason: "A polished inbound application matched the industrial climate thesis.",
  companyStage: "Seed",
  geography: "Europe",
  sectors: ["Climate technology"],
  pipelineStage: "PROOF_REQUESTED",
  identityState: "CONFIRMED",
  elapsedMinutes: 438,
  profileCoverage: {
    publicCode: "not_applicable",
    professionalProfile: "observed",
    priorFunding: "observed",
    publications: "not_observed",
    followers: "not_collected",
    educationPrestige: "not_collected"
  },
  auditOnlyPrestige: {
    warmIntroduction: true,
    eliteSchool: true,
    priorEmployerBrand: true,
    followers: 48000,
    acceleratorBadge: true,
    decisionAccess: "blocked"
  },
  evidence: [
    evidence("HEL-E01", {
      kind: "SELF_REPORT",
      title: "Founder deck",
      excerpt: "Twelve paid pilots and $240K ARR.",
      independenceGroup: "helio-founder-marketing",
      sourceReliability: 0.5
    }),
    evidence("HEL-E02", {
      kind: "SELF_REPORT",
      title: "Company website",
      excerpt: "Trusted by twelve design partners.",
      independenceGroup: "helio-founder-marketing",
      sourceReliability: 0.48
    }),
    evidence("HEL-E03", {
      kind: "VERIFIED_ARTIFACT",
      title: "Invoice export",
      excerpt: "Three paying accounts; $36K annualized contracted revenue.",
      independenceGroup: "helio-invoices",
      directness: 0.96,
      sourceReliability: 0.94
    }),
    evidence("HEL-E04", {
      kind: "VERIFIED_ARTIFACT",
      title: "CRM export",
      excerpt: "Nine unpaid design partners and $204K weighted pipeline.",
      independenceGroup: "helio-crm",
      directness: 0.93,
      sourceReliability: 0.9
    }),
    evidence("HEL-E05", {
      kind: "OFFICIAL_PRIMARY",
      title: "Industrial energy reporting brief",
      excerpt: "Industrial operators face rising measurement and reporting requirements.",
      independenceGroup: "helio-market-brief",
      sourceReliability: 0.9
    })
  ],
  claims: [
    {
      id: "HEL-C01",
      statement: "HelioLedger has twelve paid pilots.",
      type: "FOUNDER_STATEMENT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-16T09:00:00.000Z",
      evidenceLinks: [
        { evidenceId: "HEL-E01", stance: "support" },
        { evidenceId: "HEL-E02", stance: "support" },
        { evidenceId: "HEL-E03", stance: "oppose" },
        { evidenceId: "HEL-E04", stance: "oppose" }
      ]
    },
    {
      id: "HEL-C02",
      statement: "HelioLedger has $240K in annual recurring revenue.",
      type: "FOUNDER_STATEMENT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-16T09:00:00.000Z",
      evidenceLinks: [
        { evidenceId: "HEL-E01", stance: "support" },
        { evidenceId: "HEL-E03", stance: "oppose" },
        { evidenceId: "HEL-E04", stance: "oppose" }
      ]
    },
    {
      id: "HEL-C03",
      statement: "Industrial energy accounting is a large and increasingly urgent market problem.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "MARKET",
      observedAt: "2026-07-17T14:00:00.000Z",
      evidenceLinks: [{ evidenceId: "HEL-E05", stance: "support" }]
    }
  ],
  contradictions: [
    {
      id: "HEL-X01",
      claimIds: ["HEL-C01", "HEL-C02"],
      evidenceIds: ["HEL-E01", "HEL-E03", "HEL-E04"],
      severity: "HIGH",
      status: "OPEN",
      title: "Paid traction and pipeline are conflated",
      note: "Invoice and CRM exports directly contradict the deck language."
    }
  ],
  founderObservations: [
    observation("HEL-O01", "EXECUTION", 72, 0.84),
    observation("HEL-O02", "EXECUTION", 68, 0.76),
    observation("HEL-O03", "LEARNING", 62, 0.7),
    observation("HEL-O04", "LEARNING", 66, 0.68),
    observation("HEL-O05", "EVIDENCE_DISCIPLINE", 45, 0.88),
    observation("HEL-O06", "EVIDENCE_DISCIPLINE", 58, 0.7),
    observation("HEL-O07", "DOMAIN_DEPTH", 70, 0.78),
    observation("HEL-O08", "DOMAIN_DEPTH", 66, 0.72)
  ],
  axisInputs: {
    FOUNDER: {
      label: "Founder",
      trend: "DOWN",
      dimensions: [
        { key: "persistent_evidence", label: "Persistent evidence", useFounderScore: true, weight: 0.4 },
        { key: "current_execution", label: "Current execution", value: 68, confidence: 0.78, weight: 0.25 },
        { key: "domain_relevance", label: "Domain relevance", value: 72, confidence: 0.72, weight: 0.2 },
        { key: "team_coverage", label: "Team coverage", value: 76, confidence: 0.7, weight: 0.15 }
      ]
    },
    MARKET: {
      label: "Market",
      trend: "UP",
      dimensions: [
        { key: "pain", label: "Pain intensity", value: 82, confidence: 0.78, weight: 0.3, claimIds: ["HEL-C03"] },
        { key: "urgency", label: "Urgency", value: 78, confidence: 0.74, weight: 0.25, claimIds: ["HEL-C03"] },
        { key: "reach", label: "Reachable market", value: 72, confidence: 0.68, weight: 0.25, claimIds: ["HEL-C03"] },
        { key: "tailwind", label: "Structural tailwind", value: 84, confidence: 0.76, weight: 0.2, claimIds: ["HEL-C03"] }
      ]
    },
    IDEA_MARKET: {
      label: "Idea vs. market",
      trend: "DOWN",
      dimensions: [
        { key: "problem_solution", label: "Problem-solution fit", value: 66, confidence: 0.64, weight: 0.3, claimIds: ["HEL-C03"] },
        { key: "feasibility", label: "Technical feasibility", value: 72, confidence: 0.66, weight: 0.25 },
        { key: "differentiation", label: "Differentiation", value: 61, confidence: 0.6, weight: 0.2 },
        { key: "validation", label: "Commercial validation", value: 34, confidence: 0.9, weight: 0.25, claimIds: ["HEL-C01", "HEL-C02"] }
      ]
    }
  },
  evidenceContracts: [
    {
      id: "HEL-EC01",
      title: "Revenue reconciliation",
      status: "PROPOSED",
      triggerClaimIds: ["HEL-C01", "HEL-C02"],
      question: "What is paid, contracted revenue versus unpaid design partnership and pipeline?",
      requestedArtifact: "Invoice-level evidence and a corrected terminology table.",
      successCriteria: ["Paid pilot, design partner, ARR, and pipeline are separately defined", "Every total reconciles to source rows"],
      timeBudgetMinutes: 45,
      privacyRisk: "Moderate",
      expectedDecisionImpact: "High",
      allowedInference: "Accuracy and correction of the current commercial claims.",
      prohibitedInference: "Honesty, integrity, personality, or moral character.",
      alternativeEvidence: "A redacted accountant-certified schedule is acceptable.",
      noncompletionSemantics: "The traction claims remain contested; commercial weakness is not a founder-character judgment.",
      appealPath: "Founder may correct definitions and submit redacted support.",
      rulesetVersion: "DCEC-1.0"
    }
  ],
  openQuestions: ["Why were unpaid design partners described as paid pilots?", "What is attributable product adoption?"],
  memoDraft: {
    snapshot: "HelioLedger is a fictional seed-stage industrial energy-accounting company entering through an accelerator deck.",
    hypotheses: ["Reporting pressure creates urgency", "Existing design partners could convert after terminology is corrected"],
    strengths: ["Large visible market", "Prior product-delivery evidence"],
    weaknesses: ["Material traction contradiction", "Adoption evidence is weak"],
    opportunities: ["Energy measurement requirements"],
    threats: ["Incumbent platforms", "Long integration cycles"],
    problemProduct: "Industrial operators need auditable energy accounting across heterogeneous assets.",
    tractionKpis: "Deck claims are contested by invoice and CRM exports."
  },
  timeline: [
    { occurredAt: "2026-07-16T09:00:00.000Z", type: "APPLICATION", label: "Inbound accelerator deck received" },
    { occurredAt: "2026-07-17T10:05:00.000Z", type: "CONTRADICTION", label: "Invoice and CRM exports contradicted traction claims" }
  ],
  liveResearchQuery: "2026 industrial energy accounting reporting software market regulation Europe"
};

const mycoTrace = {
  ...SYNTHETIC_META,
  id: "SYN-C003",
  founderId: "SYN-F-VALE",
  founderName: "Noor Vale",
  companyName: "MycoTrace",
  oneLiner: "Fungal-contamination sensing for controlled food-production environments.",
  direction: "OUTBOUND",
  sourceChannel: "CH-PAPER-PATENT",
  sourceLabel: "Paper + patent signal",
  discoveryReason: "A paper and patent matched the biosensing thesis before an active fundraising process.",
  companyStage: "Pre-seed",
  geography: "United States",
  sectors: ["Industrial automation"],
  pipelineStage: "DECISION_READY",
  identityState: "CONFIRMED",
  elapsedMinutes: 980,
  profileCoverage: {
    publicCode: "not_applicable",
    professionalProfile: "observed",
    priorFunding: "observed_relevant_history",
    publications: "observed",
    followers: "not_collected",
    educationPrestige: "not_collected"
  },
  auditOnlyPrestige: { decisionAccess: "blocked" },
  evidence: [
    evidence("MYC-E01", {
      kind: "OFFICIAL_PRIMARY",
      title: "Controlled-humidity performance paper",
      excerpt: "The sensor reaches 94% sensitivity under controlled humidity.",
      independenceGroup: "myco-paper",
      directness: 0.94,
      sourceReliability: 0.92
    }),
    evidence("MYC-E02", {
      kind: "SELF_REPORT",
      title: "Founder deck",
      excerpt: "Field-ready at 95% sensitivity.",
      independenceGroup: "myco-founder",
      sourceReliability: 0.48
    }),
    evidence("MYC-E03", {
      kind: "VERIFIED_ARTIFACT",
      title: "Independent boundary stress test",
      excerpt: "Sensitivity fell to 61–64% under variable humidity.",
      independenceGroup: "myco-stress-test",
      directness: 0.96,
      sourceReliability: 0.95
    }),
    evidence("MYC-E04", {
      kind: "VERIFIED_ARTIFACT",
      title: "Re-scoped indoor benchmark",
      excerpt: "The revised controlled-environment deployment reached 93% sensitivity.",
      independenceGroup: "myco-rescope",
      directness: 0.96,
      sourceReliability: 0.94
    }),
    evidence("MYC-E05", {
      kind: "REPUTABLE_SECONDARY",
      title: "Food-production quality survey",
      excerpt: "Controlled-production operators report costly contamination detection delays.",
      independenceGroup: "myco-market",
      sourceReliability: 0.86
    })
  ],
  claims: [
    {
      id: "MYC-C01",
      statement: "MycoTrace is field-ready at approximately 95% sensitivity across variable humidity.",
      type: "FOUNDER_STATEMENT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-17T09:00:00.000Z",
      evidenceLinks: [
        { evidenceId: "MYC-E02", stance: "context" },
        { evidenceId: "MYC-E03", stance: "oppose" }
      ]
    },
    {
      id: "MYC-C02",
      statement: "The sensor performs near 94% in controlled-humidity environments.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: false,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-18T07:45:00.000Z",
      evidenceLinks: [
        { evidenceId: "MYC-E01", stance: "support" },
        { evidenceId: "MYC-E04", stance: "support" }
      ]
    },
    {
      id: "MYC-C03",
      statement: "Controlled-production operators experience a costly detection delay.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "MARKET",
      observedAt: "2026-07-17T15:00:00.000Z",
      evidenceLinks: [{ evidenceId: "MYC-E05", stance: "support" }]
    }
  ],
  contradictions: [
    {
      id: "MYC-X01",
      claimIds: ["MYC-C01"],
      evidenceIds: ["MYC-E02", "MYC-E03"],
      severity: "HIGH",
      status: "HUMAN_RESOLVED",
      title: "Field performance failed at the stated boundary",
      note: "The founder withdrew the field-ready claim; the current thesis is evaluated as failed."
    }
  ],
  founderObservations: [
    observation("MYC-O01", "EXECUTION", 82, 0.9),
    observation("MYC-O02", "EXECUTION", 78, 0.84),
    observation("MYC-O03", "LEARNING", 88, 0.92, { description: "Withdrew the broad claim and proposed a narrower deployment after a failed test." }),
    observation("MYC-O04", "LEARNING", 80, 0.8),
    observation("MYC-O05", "EVIDENCE_DISCIPLINE", 86, 0.88),
    observation("MYC-O06", "EVIDENCE_DISCIPLINE", 78, 0.8),
    observation("MYC-O07", "DOMAIN_DEPTH", 84, 0.9),
    observation("MYC-O08", "DOMAIN_DEPTH", 80, 0.84)
  ],
  axisInputs: {
    FOUNDER: {
      label: "Founder",
      trend: "UP",
      dimensions: [
        { key: "persistent_evidence", label: "Persistent evidence", useFounderScore: true, weight: 0.4 },
        { key: "current_execution", label: "Current execution", value: 80, confidence: 0.88, weight: 0.25 },
        { key: "domain_relevance", label: "Domain relevance", value: 84, confidence: 0.88, weight: 0.2 },
        { key: "team_coverage", label: "Team coverage", value: 72, confidence: 0.7, weight: 0.15 }
      ]
    },
    MARKET: {
      label: "Market",
      trend: "FLAT",
      dimensions: [
        { key: "pain", label: "Pain intensity", value: 74, confidence: 0.72, weight: 0.3, claimIds: ["MYC-C03"] },
        { key: "urgency", label: "Urgency", value: 66, confidence: 0.66, weight: 0.25, claimIds: ["MYC-C03"] },
        { key: "reach", label: "Reachable market", value: 58, confidence: 0.62, weight: 0.25, claimIds: ["MYC-C03"] },
        { key: "tailwind", label: "Structural tailwind", value: 65, confidence: 0.64, weight: 0.2, claimIds: ["MYC-C03"] }
      ]
    },
    IDEA_MARKET: {
      label: "Idea vs. market",
      trend: "DOWN",
      dimensions: [
        { key: "problem_solution", label: "Problem-solution fit", value: 64, confidence: 0.68, weight: 0.3, claimIds: ["MYC-C03"] },
        { key: "feasibility", label: "Technical feasibility", value: 22, confidence: 0.9, weight: 0.3, claimIds: ["MYC-C01"] },
        { key: "differentiation", label: "Differentiation", value: 58, confidence: 0.64, weight: 0.2 },
        { key: "validation", label: "Deployment validation", value: 18, confidence: 0.92, weight: 0.2, claimIds: ["MYC-C01"] }
      ]
    }
  },
  evidenceContracts: [
    {
      id: "MYC-EC01",
      title: "Boundary stress test",
      status: "VERIFIED",
      triggerClaimIds: ["MYC-C01"],
      question: "Does sensitivity hold at the claimed deployment boundary?",
      requestedArtifact: "Independent variable-humidity stress test.",
      successCriteria: ["Humidity boundary is varied", "All failures are retained"],
      timeBudgetMinutes: 120,
      privacyRisk: "Low",
      expectedDecisionImpact: "High",
      allowedInference: "Current deployment feasibility only.",
      prohibitedInference: "Founder character from a failed technical result.",
      alternativeEvidence: "Independent laboratory report.",
      noncompletionSemantics: "The field-readiness claim remains unresolved.",
      appealPath: "Submit a revised boundary and evidence.",
      rulesetVersion: "DCEC-1.0",
      result: { outcome: "INCONCLUSIVE_FOR_ORIGINAL_THESIS", note: "The original field-ready claim failed." }
    }
  ],
  openQuestions: ["Can the controlled-environment wedge support venture-scale economics?"],
  memoDraft: {
    snapshot: "MycoTrace is a fictional biosensing company surfaced through paper and patent signals.",
    hypotheses: ["A controlled-environment wedge may remain viable"],
    strengths: ["Strong founder evidence", "Responsive thesis revision"],
    weaknesses: ["Original field claim failed"],
    opportunities: ["Controlled food production"],
    threats: ["Environmental sensitivity", "Calibration burden"],
    problemProduct: "Contamination detection is delayed; the proposed sensor works only under narrower conditions than claimed.",
    tractionKpis: "Independent stress testing invalidated the original field-deployment claim."
  },
  timeline: [
    { occurredAt: "2026-07-17T16:00:00.000Z", type: "PROOF_VERIFIED", label: "Boundary stress test failed the original deployment claim" },
    { occurredAt: "2026-07-17T18:30:00.000Z", type: "REVISION", label: "Founder withdrew and re-scoped the claim" }
  ],
  liveResearchQuery: "controlled environment fungal contamination sensor market food production 2026"
};

const routeWeft = {
  ...SYNTHETIC_META,
  id: "SYN-C004",
  founderId: "SYN-F-RIVER",
  founderName: "Samir Okafor",
  companyName: "RouteWeft",
  oneLiner: "Routing optimization for mixed industrial delivery fleets.",
  direction: "OUTBOUND",
  sourceChannel: "CH-OPEN-SOURCE",
  sourceLabel: "Repository release",
  discoveryReason: "A domain-specific benchmark and reproducible code matched the industrial automation thesis; popularity metrics were removed.",
  companyStage: "Pre-seed",
  geography: "United States",
  sectors: ["Industrial automation"],
  pipelineStage: "DECISION_READY",
  identityState: "CONFIRMED",
  elapsedMinutes: 1160,
  profileCoverage: {
    publicCode: "observed_relevant_artifact",
    professionalProfile: "not_observed",
    priorFunding: "not_observed",
    publications: "not_observed",
    followers: "not_collected",
    educationPrestige: "not_collected"
  },
  auditOnlyPrestige: { repositoryStars: "stripped", followers: "stripped", decisionAccess: "blocked" },
  evidence: [
    evidence("ROU-E01", {
      kind: "PUBLIC_WORK",
      title: "Repository benchmark",
      excerpt: "README reports an 18% cost reduction on a synthetic benchmark.",
      independenceGroup: "route-repository",
      sourceReliability: 0.68
    }),
    evidence("ROU-E02", {
      kind: "VERIFIED_ARTIFACT",
      title: "Blinded independent replay",
      excerpt: "Frozen code achieved a 9.1% improvement on held-out operational data.",
      independenceGroup: "route-replay",
      directness: 0.98,
      sourceReliability: 0.96
    }),
    evidence("ROU-E03", {
      kind: "OFFICIAL_PRIMARY",
      title: "Buyer workflow evidence",
      excerpt: "Fleet operators confirmed route-cost pressure and budget ownership.",
      independenceGroup: "route-buyer",
      directness: 0.88,
      sourceReliability: 0.88
    })
  ],
  claims: [
    {
      id: "ROU-C01",
      statement: "RouteWeft improves route cost by approximately 7–10% on held-out operational data.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "IDEA_MARKET",
      observedAt: "2026-07-17T17:15:00.000Z",
      evidenceLinks: [{ evidenceId: "ROU-E02", stance: "support" }]
    },
    {
      id: "ROU-C02",
      statement: "Target fleet operators experience a budgeted route-cost problem.",
      type: "FACT",
      materiality: "HIGH",
      decisionCritical: true,
      axis: "MARKET",
      observedAt: "2026-07-18T06:30:00.000Z",
      evidenceLinks: [{ evidenceId: "ROU-E03", stance: "support" }]
    }
  ],
  contradictions: [],
  founderObservations: [
    observation("ROU-O01", "EXECUTION", 78, 0.9),
    observation("ROU-O02", "EXECUTION", 74, 0.82),
    observation("ROU-O03", "LEARNING", 72, 0.78),
    observation("ROU-O04", "LEARNING", 76, 0.8),
    observation("ROU-O05", "EVIDENCE_DISCIPLINE", 84, 0.9),
    observation("ROU-O06", "EVIDENCE_DISCIPLINE", 78, 0.82),
    observation("ROU-O07", "DOMAIN_DEPTH", 74, 0.8),
    observation("ROU-O08", "DOMAIN_DEPTH", 70, 0.76)
  ],
  axisInputs: {
    FOUNDER: {
      label: "Founder",
      trend: "UP",
      dimensions: [
        { key: "persistent_evidence", label: "Persistent evidence", useFounderScore: true, weight: 0.4 },
        { key: "current_execution", label: "Current execution", value: 76, confidence: 0.84, weight: 0.25 },
        { key: "domain_relevance", label: "Domain relevance", value: 72, confidence: 0.76, weight: 0.2 },
        { key: "team_coverage", label: "Team coverage", value: 70, confidence: 0.7, weight: 0.15 }
      ]
    },
    MARKET: {
      label: "Market",
      trend: "UP",
      dimensions: [
        { key: "pain", label: "Pain intensity", value: 78, confidence: 0.8, weight: 0.3, claimIds: ["ROU-C02"] },
        { key: "urgency", label: "Urgency", value: 70, confidence: 0.72, weight: 0.25, claimIds: ["ROU-C02"] },
        { key: "reach", label: "Reachable market", value: 68, confidence: 0.68, weight: 0.25, claimIds: ["ROU-C02"] },
        { key: "tailwind", label: "Structural tailwind", value: 72, confidence: 0.7, weight: 0.2, claimIds: ["ROU-C02"] }
      ]
    },
    IDEA_MARKET: {
      label: "Idea vs. market",
      trend: "UP",
      dimensions: [
        { key: "problem_solution", label: "Problem-solution fit", value: 76, confidence: 0.8, weight: 0.3, claimIds: ["ROU-C01", "ROU-C02"] },
        { key: "feasibility", label: "Technical feasibility", value: 78, confidence: 0.88, weight: 0.3, claimIds: ["ROU-C01"] },
        { key: "differentiation", label: "Differentiation", value: 70, confidence: 0.7, weight: 0.2, claimIds: ["ROU-C01"] },
        { key: "validation", label: "Controlled validation", value: 82, confidence: 0.9, weight: 0.2, claimIds: ["ROU-C01"] }
      ]
    }
  },
  evidenceContracts: [
    {
      id: "ROU-EC01",
      title: "Blinded replay",
      status: "VERIFIED",
      triggerClaimIds: ["ROU-C01"],
      question: "Does frozen code improve route cost on held-out operational data?",
      requestedArtifact: "Environment manifest, output, runtime, and failure cases.",
      successCriteria: ["Labels remain hidden until output submission", "Failures are retained"],
      timeBudgetMinutes: 75,
      privacyRisk: "Low",
      expectedDecisionImpact: "High",
      allowedInference: "Narrow benchmark performance and protocol execution.",
      prohibitedInference: "Founder merit from stars, followers, or network visibility.",
      alternativeEvidence: "Independent reproduction on a comparable frozen dataset.",
      noncompletionSemantics: "Benchmark claim remains unresolved.",
      appealPath: "Submit a reproducible alternative test.",
      rulesetVersion: "DCEC-1.0",
      result: { outcome: "VERIFIED", note: "9.1% improvement on held-out data." }
    }
  ],
  openQuestions: ["Can the wedge convert without high-touch integration?"],
  memoDraft: {
    snapshot: "RouteWeft is a fictional pre-seed routing system surfaced from open-source work with popularity stripped out.",
    hypotheses: ["Reproducible cost improvement can support a narrow fleet-operations wedge"],
    strengths: ["Independent replay", "Scoped claims", "Buyer pain"],
    weaknesses: ["Integration burden", "Limited deployment history"],
    opportunities: ["Mixed-fleet complexity"],
    threats: ["Incumbent routing suites"],
    problemProduct: "Mixed fleets incur avoidable route cost; RouteWeft optimizes dispatch under operational constraints.",
    tractionKpis: "A blinded replay demonstrated a 9.1% held-out operational improvement; no revenue is claimed."
  },
  timeline: [
    { occurredAt: "2026-07-02T10:00:00.000Z", type: "SOURCE_SIGNAL", label: "Repository benchmark surfaced" },
    { occurredAt: "2026-07-17T17:15:00.000Z", type: "PROOF_VERIFIED", label: "Blinded replay independently verified" }
  ],
  liveResearchQuery: "fleet routing optimization industrial delivery software buyer budget 2026"
};

export const SOURCE_CHANNELS = [
  {
    id: "CH-OPEN-RESEARCH",
    name: "Open research",
    eligible: 42,
    exposed: 31,
    surfaced: 7,
    reviewed: 4,
    proofComplete: 1,
    advanced: 1,
    adjustedObservation: "Positive signal · high uncertainty",
    note: "One large verified evidence gain; sample remains insufficient."
  },
  {
    id: "CH-ACCELERATOR-INBOUND",
    name: "Accelerator inbound",
    eligible: 18,
    exposed: 18,
    surfaced: 12,
    reviewed: 5,
    proofComplete: 0,
    advanced: 0,
    adjustedObservation: "Mixed signal · high uncertainty",
    note: "Visibility was high; one material claim conflict remains open."
  },
  {
    id: "CH-PAPER-PATENT",
    name: "Papers + patents",
    eligible: 63,
    exposed: 38,
    surfaced: 5,
    reviewed: 3,
    proofComplete: 1,
    advanced: 0,
    adjustedObservation: "Founder signal positive; idea outcome neutral",
    note: "A strong founder was found, while the current deployment thesis failed."
  },
  {
    id: "CH-OPEN-SOURCE",
    name: "Open-source scouting",
    eligible: 55,
    exposed: 44,
    surfaced: 8,
    reviewed: 4,
    proofComplete: 1,
    advanced: 1,
    adjustedObservation: "Positive signal · high uncertainty",
    note: "Popularity was excluded; one held-out replay validated a narrower claim."
  }
];

export const SEED_DATASET = {
  datasetVersion: "SYNTHETIC_V1",
  synthetic: true,
  watermark: "Fictional data — does not represent a real person or company",
  thesis,
  opportunities: [nuraFlex, helioLedger, mycoTrace, routeWeft],
  sourceChannels: SOURCE_CHANNELS,
  decisions: [],
  appliedEvents: []
};

export const SEED_EVENTS = [
  {
    eventId: "EVT-SEED-001",
    seq: 1,
    type: "DATASET_INITIALIZED",
    occurredAt: "2026-07-18T08:00:00.000Z",
    actor: { kind: "SYSTEM", id: "proofline-seed" },
    schemaVersion: 1,
    payload: { dataset: SEED_DATASET }
  }
];

export const DEMO_TRANSITIONS = {
  "SYN-C001": {
    submit: {
      opportunityId: "SYN-C001",
      contractId: "NUR-EC01"
    },
    verify: {
      opportunityId: "SYN-C001",
      contractId: "NUR-EC01",
      pipelineStage: "DECISION_READY",
      result: {
        outcome: "VERIFIED",
        summary:
          "Three active runs produced a repeatable stiffness shift relative to the passive control. The poster described an earlier prototype generation.",
        artifacts: ["force-displacement.csv", "protocol.pdf", "unedited-test.mp4"],
        criteriaPassed: 4,
        criteriaTotal: 4,
        validator: "Deterministic calculation + named human artifact review",
        affectedAxes: ["Founder", "Idea vs. market"],
        unchangedAxes: ["Market"]
      },
      evidence: [
        evidence("NUR-E07", {
          kind: "VERIFIED_ARTIFACT",
          title: "Raw force-displacement benchmark",
          excerpt:
            "Three active runs show a 31–34% slope change relative to the passive control using the same fixture; all cycles and one calibration retry are retained.",
          capturedAt: "2026-07-18T12:12:00.000Z",
          validAt: "2026-07-18T11:40:00.000Z",
          independenceGroup: "nura-bench-artifact",
          directness: 0.99,
          sourceReliability: 0.96,
          recency: 1
        }),
        evidence("NUR-E08", {
          kind: "OFFICIAL_PRIMARY",
          title: "Independent rubric review",
          excerpt:
            "The calculation is reproducible; active and passive fixtures match. Repository and protocol authorship confirm Elena's controller contribution, not sole hardware ownership.",
          capturedAt: "2026-07-18T12:42:00.000Z",
          validAt: "2026-07-18T12:42:00.000Z",
          independenceGroup: "nura-independent-review",
          directness: 0.96,
          sourceReliability: 0.94,
          recency: 1
        })
      ],
      claimLinks: [
        { claimId: "NUR-C01", evidenceId: "NUR-E07", stance: "support" },
        { claimId: "NUR-C01", evidenceId: "NUR-E08", stance: "support" },
        { claimId: "NUR-C02", evidenceId: "NUR-E08", stance: "support" }
      ],
      claimLinkUpdates: [{ claimId: "NUR-C01", evidenceId: "NUR-E02", stance: "context" }],
      contradictionResolutions: [
        {
          contradictionId: "NUR-X01",
          status: "TEMPORALLY_RECONCILED",
          note: "The poster documents a passive predecessor; the verified benchmark and repository document the current active prototype."
        }
      ],
      founderObservations: [
        observation("NUR-O09", "EXECUTION", 86, 0.96, {
          independenceGroup: "nura-bench-artifact",
          description: "Delivered the predeclared raw benchmark and retained a calibration retry.",
          evidenceIds: ["NUR-E07"]
        }),
        observation("NUR-O10", "EVIDENCE_DISCIPLINE", 90, 0.94, {
          independenceGroup: "nura-independent-review",
          description: "Distinguished the earlier passive prototype from the current active system using timestamped evidence.",
          evidenceIds: ["NUR-E08"]
        }),
        observation("NUR-O11", "LEARNING", 82, 0.9, {
          independenceGroup: "nura-bench-reconciliation",
          description: "Reconciled a conflicting source without removing unfavorable or earlier evidence.",
          evidenceIds: ["NUR-E07", "NUR-E08"]
        })
      ],
      axisDimensionUpdates: [
        { axis: "FOUNDER", key: "current_execution", value: 82, confidence: 0.9, trend: "UP" },
        { axis: "IDEA_MARKET", key: "feasibility", value: 83, confidence: 0.92, trend: "UP" },
        { axis: "IDEA_MARKET", key: "validation", value: 79, confidence: 0.88, trend: "UP" }
      ],
      openQuestions: [
        "Can clinic pain translate into a budgeted pilot before patient testing?",
        "Which team member owns hardware design and clinical quality systems?"
      ],
      memoUpdates: {
        weaknesses: ["No patient tests", "No paid pilots", "Clinical and hardware reliability remain unvalidated"],
        tractionKpis:
          "No paid traction. Three synthetic clinic interviews support the workflow problem; the controlled bench test verified active stiffness for the current prototype."
      }
    }
  }
};

export function createPrestigeTwin(opportunity = nuraFlex) {
  const twin = JSON.parse(JSON.stringify(opportunity));
  twin.id = `${opportunity.id}-PRESTIGE-TWIN`;
  twin.auditOnlyPrestige = {
    warmIntroduction: true,
    eliteSchool: true,
    priorEmployerBrand: true,
    followers: 48000,
    acceleratorBadge: true,
    decisionAccess: "blocked"
  };
  return twin;
}
