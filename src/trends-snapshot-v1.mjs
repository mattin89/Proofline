export const TRENDS_SNAPSHOT_VERSION = "proofline.trends.v1";
export const TRENDS_SNAPSHOT_CAPTURED_AT = "2026-07-19T09:30:15.618Z";

// Frozen from a real POST /api/trends response. The three server-side Tavily
// Extract batches returned all nine fixed authoritative anchors and reported
// two credits. The long provider extracts were compacted into source-grounded
// editorial summaries for the demo dashboard; every summary remains
// UNREVIEWED until a human opens the linked primary document or publisher
// record and checks its context.
export const TRENDS_SNAPSHOT_V1 = Object.freeze({
  schemaVersion: TRENDS_SNAPSHOT_VERSION,
  snapshotId: "RES-c9639928df5ef5c6",
  generatedAt: TRENDS_SNAPSHOT_CAPTURED_AT,
  provider: "Tavily",
  mode: "TREND_RADAR",
  contentTreatment: "EDITORIAL_SUMMARY_OF_TAVILY_EXTRACT",
  focus: "Curated cross-sector radar: AI infrastructure, medical technology, robotics, neurotechnology, energy storage, industrial resilience, and space systems",
  usage: {
    reportedCredits: 2,
    estimatedCreditsUpperBound: 3,
    estimateBasis: "Three fixed server-side Tavily Extract batches, one for each dashboard pillar. Provider-reported usage takes precedence.",
    exa: {
      requested: false,
      reportedCostDollars: null,
      estimatedCostUpperBoundDollars: 0,
      estimateBasis: "Exa is not called by the trends radar."
    }
  },
  sourceCount: 9,
  queries: [
    {
      kind: "CURRENT_INTERNET_TRENDS",
      method: "TAVILY_EXTRACT",
      anchorCount: 2,
      anchorUrls: [
        "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026",
        "https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions"
      ],
      includeAnswer: false,
      requestId: "732eaed9-c0d5-4f95-8aba-6abc3bcb81ca"
    },
    {
      kind: "COMPANY_OPERATING_CHALLENGES",
      method: "TAVILY_EXTRACT",
      anchorCount: 3,
      anchorUrls: [
        "https://www.nist.gov/news-events/news/2026/05/now-available-nist-sp-1800-41-responding-and-recovering-cyber-attack",
        "https://www.gao.gov/products/gao-25-106952",
        "https://managenergy.ec.europa.eu/publications/crossed-wires-grid-capacity-could-block-eu-energy-security_en"
      ],
      includeAnswer: false,
      requestId: "d09edddc-85d6-4f4d-9b71-1efd3c0cf837"
    },
    {
      kind: "RESEARCH_FRONTIERS",
      method: "TAVILY_EXTRACT",
      anchorCount: 4,
      anchorUrls: [
        "https://www.nature.com/articles/s41591-026-04414-6",
        "https://www.nature.com/articles/s44222-025-00359-6",
        "https://www.nature.com/articles/s41560-025-01927-1",
        "https://www.nature.com/articles/s41467-026-72681-5"
      ],
      includeAnswer: false,
      requestId: "05349ff6-bec3-45e3-ae75-d6951f90a4f0"
    }
  ],
  sections: [
    {
      id: "INTERNET_TRENDS",
      title: "Current internet trends",
      queryKind: "CURRENT_INTERNET_TRENDS",
      description: "Observed public signals about technology adoption, deployment, and investment attention.",
      evidenceIds: ["WEB-efe55344eacae6d4", "WEB-b15e8e60ab7fe218"],
      sourceCount: 2,
      hostCount: 2
    },
    {
      id: "COMPANY_CHALLENGES",
      title: "Company challenges",
      queryKind: "COMPANY_OPERATING_CHALLENGES",
      description: "Named operating constraints and business challenges reported by companies or institutional surveys.",
      evidenceIds: ["WEB-c19789d7559e0ea1", "WEB-6d71491eeafec015", "WEB-d5f04caee3589082"],
      sourceCount: 3,
      hostCount: 3
    },
    {
      id: "RESEARCH_FRONTIERS",
      title: "Research frontiers",
      queryKind: "RESEARCH_FRONTIERS",
      description: "Current technical and academic directions; alignment does not establish product efficacy or commercial adoption.",
      evidenceIds: ["WEB-8b46bace8ad06d40", "WEB-6f93af3640a1e3c1", "WEB-5d95d9d09cb6b44c", "WEB-dbf1e08c60d4672c"],
      sourceCount: 4,
      hostCount: 1
    }
  ],
  evidence: [
    {
      id: "WEB-efe55344eacae6d4",
      title: "Top 5 Global Robotics Trends 2026",
      url: "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026",
      excerpt: "The International Federation of Robotics reports increasing use of AI-enabled autonomy, growing IT/OT convergence, pressure for humanoids to prove reliability and efficiency, and rising safety, security, certification and workforce requirements. It reports the global market value of industrial robot installations at an all-time high of US$16.7 billion.",
      relevance: null,
      publishedDate: "2026-01-08",
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "CURRENT_INTERNET_TRENDS",
      sourceType: "PUBLIC_WEB",
      sourceRole: "INDUSTRY_BODY",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-b15e8e60ab7fe218",
      title: "Data centre electricity use surged in 2025, even with tightening bottlenecks",
      url: "https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions",
      excerpt: "The IEA reports data-centre electricity demand rose 17% in 2025 and says expansion is increasingly constrained by gas-turbine, transformer, advanced-chip and IT-component supply chains, planning systems, grid connections and approvals. It also reports that technology companies represented around 40% of corporate renewable-power purchase agreements signed in 2025.",
      relevance: null,
      publishedDate: "2026-04-16",
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "CURRENT_INTERNET_TRENDS",
      sourceType: "PUBLIC_WEB",
      sourceRole: "INTERGOVERNMENTAL_AGENCY",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-c19789d7559e0ea1",
      title: "NIST SP 1800-41: Responding to and Recovering from a Cyber Attack",
      url: "https://www.nist.gov/news-events/news/2026/05/now-available-nist-sp-1800-41-responding-and-recovering-cyber-attack",
      excerpt: "NIST's National Cybersecurity Center of Excellence released an initial public draft covering response and recovery in manufacturing industrial-control-system environments. The guidance frames operational resilience and recovery from cyber incidents as a current manufacturing challenge; it remains a draft, not a finalized standard.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "COMPANY_OPERATING_CHALLENGES",
      sourceType: "PUBLIC_WEB",
      sourceRole: "GOVERNMENT_TECHNICAL_GUIDANCE",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-6d71491eeafec015",
      title: "Brain-Computer Interfaces: Applications, Challenges, and Policy Options",
      url: "https://www.gao.gov/products/gao-25-106952",
      excerpt: "The U.S. Government Accountability Office reviews brain-computer-interface applications and policy challenges, including neural-data governance, long-term support for implanted devices, interoperability and reimbursement. These issues are adoption constraints, not evidence against any specific company or product.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "COMPANY_OPERATING_CHALLENGES",
      sourceType: "PUBLIC_WEB",
      sourceRole: "GOVERNMENT_ACCOUNTABILITY_REVIEW",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-d5f04caee3589082",
      title: "Crossed Wires: Grid Capacity Could Block EU Energy Security",
      url: "https://managenergy.ec.europa.eu/publications/crossed-wires-grid-capacity-could-block-eu-energy-security_en",
      excerpt: "An EU institutional analysis says limited grid capacity is becoming a barrier to renewable deployment, electrification and industrial development. It reports at least 120 GW of planned renewable capacity at risk and points to connection delays, administrative bottlenecks, improved grid management and flexible non-wire solutions.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "COMPANY_OPERATING_CHALLENGES",
      sourceType: "PUBLIC_WEB",
      sourceRole: "EU_INSTITUTIONAL_ANALYSIS",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-8b46bace8ad06d40",
      title: "Long-term independent use of an intracortical brain-computer interface for speech and cursor control",
      url: "https://www.nature.com/articles/s41591-026-04414-6",
      excerpt: "A Nature Medicine study reports long-term independent home use of an intracortical brain-computer interface for speech and cursor control. The record supports practical-use research while retaining important limits: the study involved one participant, independent-use ground truth was not always available, and conversational accuracy was less consistent than structured tasks.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "RESEARCH_FRONTIERS",
      sourceType: "ACADEMIC_RESEARCH",
      sourceRole: "PEER_REVIEWED_STUDY",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-6f93af3640a1e3c1",
      title: "Long-duration electricity storage needs for coping with Dunkelflaute events in Europe",
      url: "https://www.nature.com/articles/s41467-026-72681-5",
      excerpt: "A Nature Communications modeling study examines long-duration storage needs under European renewable-energy droughts using many historical weather years and hourly power-system optimization. The result is model evidence about extreme scenarios, not an observed market-demand forecast.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "RESEARCH_FRONTIERS",
      sourceType: "ACADEMIC_RESEARCH",
      sourceRole: "PEER_REVIEWED_MODELING_STUDY",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-5d95d9d09cb6b44c",
      title: "AI data centres as grid-interactive assets",
      url: "https://www.nature.com/articles/s41560-025-01927-1",
      excerpt: "A Nature Energy field demonstration studies whether coordinated AI workloads can make data centres more grid-responsive. The reported demonstration reduced power use while maintaining specified service quality, providing experimental evidence for flexible demand rather than a general guarantee for every data-centre workload.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "RESEARCH_FRONTIERS",
      sourceType: "ACADEMIC_RESEARCH",
      sourceRole: "PEER_REVIEWED_STUDY",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    },
    {
      id: "WEB-dbf1e08c60d4672c",
      title: "Soft robotics for personalized and sustainable wearables",
      url: "https://www.nature.com/articles/s44222-025-00359-6",
      excerpt: "A Nature Reviews Bioengineering review surveys soft robotics for personalized and sustainable wearable systems, including actuation, sensing, energy efficiency, durability, recyclability, personalized control and machine-learning adaptation. It is a peer-reviewed review of the field, not a new product-specific efficacy experiment.",
      relevance: null,
      publishedDate: null,
      query: "Curated current-radar anchor refreshed through Tavily Extract.",
      queryKind: "RESEARCH_FRONTIERS",
      sourceType: "ACADEMIC_RESEARCH",
      sourceRole: "PEER_REVIEWED_REVIEW",
      captureMethod: "TAVILY_EXTRACT",
      provider: "Tavily",
      verificationStatus: "UNREVIEWED",
      assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD",
      origin: "EXTERNAL_LIVE_RESEARCH",
      syntheticFixture: false,
      observedBy: ["Tavily"]
    }
  ],
  linkInspection: {
    requested: 9,
    extracted: 9,
    failures: [],
    fallbackSearchUsed: false
  },
  caveats: [
    "The radar is a curated cross-sector source set, not an exhaustive scan of the internet.",
    "Tavily extraction can fail or omit content; missing coverage is not evidence that a trend or challenge does not exist.",
    "Every retained excerpt remains UNREVIEWED until a human opens the source and checks its context."
  ],
  boundaries: {
    canAffectStartupScore: false,
    producesProbabilityForecast: false,
    infersTrendDirection: false,
    humanReviewRequired: true
  },
  interpretation: "These are unreviewed public-web signals grouped by query track. They do not create a market score, forecast, or investment decision.",
  refreshCostUpperBound: 3
});
