export const TEAM_ACTIVITY_CAPTURED_AT = "2026-07-19T00:00:00.000Z";

// Colleague names, roles, allocations, and workflow actions are explicit demo
// personas. Company names, dated milestones, and links are real public data.
export const TEAM_ACTIVITY = Object.freeze([
  Object.freeze({
    colleague: "Dr. Maya Chen",
    role: "Health partner",
    company: "Neko Health",
    sector: "Preventive medicine",
    stage: "Series C",
    demoAllocation: 125_000,
    currency: "USD",
    action: "Rechecking US-launch execution and prepaid repeat-scan demand before the allocation review.",
    status: "Allocation review",
    sourceDate: "2026-07-15",
    sourceLabel: "Neko Health Series C announcement",
    sourceUrl: "https://www.nekohealth.com/gb/en/press/neko-health-raises-usd700m-series-c-ahead-of-us-launch",
    companyFact: "Neko Health announced a $700M Series C, more than 100,000 completed scans, and a reported 75% same-day prebooking rate for the next annual scan."
  }),
  Object.freeze({
    colleague: "Daniel Okafor",
    role: "Robotics partner",
    company: "ANYbotics",
    sector: "Industrial robotics",
    stage: "Growth",
    demoAllocation: 100_000,
    currency: "USD",
    action: "Preparing customer-reference questions around scaled deployments and the Yokogawa integration.",
    status: "Reference calls",
    sourceDate: "2026-02-10",
    sourceLabel: "ANYbotics-Yokogawa partnership",
    sourceUrl: "https://www.anybotics.com/news/yokogawa-and-anybotics-to-integrate-oprex-robot-management-core-software-with-anymal-robotic-inspection-solutions/",
    companyFact: "ANYbotics and Yokogawa announced an integration partnership for autonomous inspections across oil and gas, power, and metals operations."
  }),
  Object.freeze({
    colleague: "Sofia Rossi",
    role: "AI partner",
    company: "Mistral AI",
    sector: "Enterprise AI",
    stage: "Series C",
    demoAllocation: 150_000,
    currency: "EUR",
    action: "Mapping production workflow adoption and strategic-customer concentration into the IC memo.",
    status: "IC memo",
    sourceDate: "2026-04-27",
    sourceLabel: "Mistral Workflows launch",
    sourceUrl: "https://mistral.ai/news/workflows/",
    companyFact: "Mistral says customers including ASML, ABANCA, CMA CGM, and France Travail are already running its enterprise Workflows product."
  }),
  Object.freeze({
    colleague: "Jonas Weber",
    role: "Climate partner",
    company: "Proxima Fusion",
    sector: "Fusion energy",
    stage: "Growth",
    demoAllocation: 100_000,
    currency: "EUR",
    action: "Reviewing financing terms against Alpha demonstrator, magnet-factory, and industrialization milestones.",
    status: "Milestone review",
    sourceDate: "2026-07-07",
    sourceLabel: "Proxima Fusion financing update",
    sourceUrl: "https://www.proximafusion.com/press-news",
    companyFact: "Proxima Fusion announced a EUR 411M financing round and a EUR 2.4B valuation to advance its commercial stellarator program."
  }),
  Object.freeze({
    colleague: "Priya Nair",
    role: "Frontier-tech partner",
    company: "Isar Aerospace",
    sector: "Space launch",
    stage: "Growth",
    demoAllocation: 75_000,
    currency: "EUR",
    action: "Checking launch-cadence and infrastructure dependencies after the Nova Scotia launch-site agreement.",
    status: "Execution watch",
    sourceDate: "2026-07-07",
    sourceLabel: "Isar Aerospace launch-site agreement",
    sourceUrl: "https://isaraerospace.com/images/Press-release_Isar-and-MLS-sign-contract-07-07-26.pdf",
    companyFact: "Isar Aerospace and Maritime Launch Services announced a contract covering launch-pad infrastructure, engineering, and launch operations in Nova Scotia."
  })
]);
