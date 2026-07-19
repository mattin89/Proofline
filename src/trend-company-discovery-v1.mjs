import { TRENDS_SNAPSHOT_V1 } from "./trends-snapshot-v1.mjs";

export const TREND_COMPANY_DISCOVERY_VERSION = "proofline.trend-company-discovery.v1";

export const TREND_COMPANY_DISCOVERY_LIMITS = Object.freeze({
  maxSelectedTrends: 4,
  maxTavilySearches: 4,
  maxGithubSearches: 4,
  maxTavilyResultsPerTrend: 5,
  maxGithubResultsPerTrend: 5,
  maxTavilyQueryCharacters: 380,
  maxGithubQueryCharacters: 220
});

export class TrendCompanyDiscoveryInputError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "TrendCompanyDiscoveryInputError";
    this.code = code;
  }
}

export const TREND_DISCOVERY_REGIONS = Object.freeze([
  Object.freeze({ id: "GLOBAL", label: "Global", searchTerm: "global", queryTerm: "global" }),
  Object.freeze({ id: "EUROPE", label: "Europe", searchTerm: "Europe European", queryTerm: "Europe" }),
  Object.freeze({ id: "NORTH_AMERICA", label: "North America", searchTerm: "United States Canada North America", queryTerm: "North America" }),
  Object.freeze({ id: "ASIA_PACIFIC", label: "Asia-Pacific", searchTerm: "Asia Pacific APAC", queryTerm: "Asia Pacific" }),
  Object.freeze({ id: "LATIN_AMERICA", label: "Latin America", searchTerm: "Latin America LATAM", queryTerm: "Latin America" }),
  Object.freeze({ id: "MIDDLE_EAST_AFRICA", label: "Middle East & Africa", searchTerm: "Middle East Africa", queryTerm: "Middle East Africa" })
]);

export const TREND_DISCOVERY_SECTORS = Object.freeze([
  Object.freeze({ id: "ALL", label: "All sectors", searchTerm: "technology", queryTerm: "technology" }),
  Object.freeze({ id: "ROBOTICS", label: "Robotics", searchTerm: "robotics automation", queryTerm: "robotics" }),
  Object.freeze({ id: "AI_INFRASTRUCTURE", label: "AI infrastructure", searchTerm: "AI infrastructure compute", queryTerm: "AI infra" }),
  Object.freeze({ id: "CYBERSECURITY", label: "Cybersecurity", searchTerm: "cybersecurity resilience", queryTerm: "cybersecurity" }),
  Object.freeze({ id: "NEUROTECHNOLOGY", label: "Neurotechnology", searchTerm: "neurotechnology BCI", queryTerm: "neurotech" }),
  Object.freeze({ id: "GRID_TECH", label: "Grid technology", searchTerm: "electric grid flexibility", queryTerm: "grid tech" }),
  Object.freeze({ id: "ENERGY_STORAGE", label: "Energy storage", searchTerm: "long duration energy storage", queryTerm: "energy storage" }),
  Object.freeze({ id: "WEARABLE_MEDTECH", label: "Wearables & medical technology", searchTerm: "medical wearable technology", queryTerm: "wearable tech" }),
  Object.freeze({ id: "INDUSTRIAL_TECH", label: "Industrial technology", searchTerm: "industrial manufacturing technology", queryTerm: "industry tech" })
]);

const TREND_METADATA = Object.freeze({
  "WEB-efe55344eacae6d4": Object.freeze({
    id: "TREND-ROBOTICS-AUTONOMY-2026",
    searchLabel: "AI-enabled robotics and IT/OT convergence",
    keyFeatures: Object.freeze(["autonomous robots", "IT/OT convergence", "robot safety", "humanoid reliability"]),
    sectors: Object.freeze(["ROBOTICS", "AI_INFRASTRUCTURE", "INDUSTRIAL_TECH"]),
    regions: Object.freeze(["GLOBAL"]),
    githubTerms: Object.freeze(["robotics", "autonomy"]),
    commercializationRelevance: 90
  }),
  "WEB-b15e8e60ab7fe218": Object.freeze({
    id: "TREND-DATACENTER-BOTTLENECKS-2026",
    searchLabel: "data-centre energy and supply bottlenecks",
    keyFeatures: Object.freeze(["data-centre power demand", "grid connections", "transformer supply", "flexible compute"]),
    sectors: Object.freeze(["AI_INFRASTRUCTURE", "GRID_TECH", "ENERGY_STORAGE"]),
    regions: Object.freeze(["GLOBAL"]),
    githubTerms: Object.freeze(["datacenter", "energy"]),
    commercializationRelevance: 94
  }),
  "WEB-c19789d7559e0ea1": Object.freeze({
    id: "TREND-INDUSTRIAL-CYBER-RECOVERY-2026",
    searchLabel: "industrial cyber response and recovery",
    keyFeatures: Object.freeze(["industrial-control recovery", "manufacturing resilience", "incident response"]),
    sectors: Object.freeze(["CYBERSECURITY", "INDUSTRIAL_TECH"]),
    regions: Object.freeze(["NORTH_AMERICA", "GLOBAL"]),
    githubTerms: Object.freeze(["industrial", "cybersecurity"]),
    commercializationRelevance: 86
  }),
  "WEB-6d71491eeafec015": Object.freeze({
    id: "TREND-BCI-ADOPTION-CHALLENGES-2025",
    searchLabel: "brain-computer-interface adoption challenges",
    keyFeatures: Object.freeze(["neural-data governance", "implant support", "BCI interoperability", "reimbursement"]),
    sectors: Object.freeze(["NEUROTECHNOLOGY", "WEARABLE_MEDTECH"]),
    regions: Object.freeze(["NORTH_AMERICA", "GLOBAL"]),
    githubTerms: Object.freeze(["brain-computer-interface", "neurotechnology"]),
    commercializationRelevance: 82
  }),
  "WEB-d5f04caee3589082": Object.freeze({
    id: "TREND-EU-GRID-CAPACITY-2026",
    searchLabel: "European grid-capacity constraints",
    keyFeatures: Object.freeze(["grid congestion", "connection delays", "non-wire alternatives", "demand flexibility"]),
    sectors: Object.freeze(["GRID_TECH", "ENERGY_STORAGE"]),
    regions: Object.freeze(["EUROPE"]),
    githubTerms: Object.freeze(["smart-grid", "flexibility"]),
    commercializationRelevance: 92
  }),
  "WEB-8b46bace8ad06d40": Object.freeze({
    id: "TREND-HOME-BCI-USE-2026",
    searchLabel: "long-term independent home BCI use",
    keyFeatures: Object.freeze(["speech BCI", "cursor control", "independent home use", "neural interfaces"]),
    sectors: Object.freeze(["NEUROTECHNOLOGY", "WEARABLE_MEDTECH"]),
    regions: Object.freeze(["GLOBAL"]),
    githubTerms: Object.freeze(["BCI", "assistive"]),
    commercializationRelevance: 78
  }),
  "WEB-6f93af3640a1e3c1": Object.freeze({
    id: "TREND-LONG-DURATION-STORAGE-2026",
    searchLabel: "long-duration storage for renewable droughts",
    keyFeatures: Object.freeze(["long-duration storage", "renewable drought", "power-system optimization"]),
    sectors: Object.freeze(["ENERGY_STORAGE", "GRID_TECH"]),
    regions: Object.freeze(["EUROPE", "GLOBAL"]),
    githubTerms: Object.freeze(["energy-storage", "optimization"]),
    commercializationRelevance: 84
  }),
  "WEB-5d95d9d09cb6b44c": Object.freeze({
    id: "TREND-GRID-INTERACTIVE-AI-2025",
    searchLabel: "grid-interactive AI data centres",
    keyFeatures: Object.freeze(["workload scheduling", "flexible demand", "grid-responsive compute", "service quality"]),
    sectors: Object.freeze(["AI_INFRASTRUCTURE", "GRID_TECH"]),
    regions: Object.freeze(["GLOBAL"]),
    githubTerms: Object.freeze(["workload-scheduling", "energy"]),
    commercializationRelevance: 91
  }),
  "WEB-dbf1e08c60d4672c": Object.freeze({
    id: "TREND-SOFT-WEARABLES-2025",
    searchLabel: "personalized sustainable soft wearables",
    keyFeatures: Object.freeze(["soft actuation", "wearable sensing", "personalized control", "sustainable materials"]),
    sectors: Object.freeze(["ROBOTICS", "WEARABLE_MEDTECH"]),
    regions: Object.freeze(["GLOBAL"]),
    githubTerms: Object.freeze(["soft-robotics", "wearable"]),
    commercializationRelevance: 80
  })
});

const SOURCE_AUTHORITY_BY_ROLE = Object.freeze({
  INDUSTRY_BODY: 82,
  INTERGOVERNMENTAL_AGENCY: 94,
  GOVERNMENT_TECHNICAL_GUIDANCE: 92,
  GOVERNMENT_ACCOUNTABILITY_REVIEW: 90,
  EU_INSTITUTIONAL_ANALYSIS: 91,
  PEER_REVIEWED_STUDY: 94,
  PEER_REVIEWED_MODELING_STUDY: 90,
  PEER_REVIEWED_REVIEW: 92
});

function optionalWholeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validDate(value) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function freshnessIndicator(publishedDate, capturedAt) {
  const published = Date.parse(publishedDate || "");
  const captured = Date.parse(capturedAt || "");
  if (!Number.isFinite(published) || !Number.isFinite(captured)) return 50;
  const days = Math.max(0, (captured - published) / 86_400_000);
  if (days <= 180) return 100;
  if (days <= 365) return 80;
  if (days <= 730) return 60;
  return 35;
}

function trendSignalScore(evidence, metadata) {
  const sourceAuthority = SOURCE_AUTHORITY_BY_ROLE[evidence.sourceRole] || 70;
  const freshness = freshnessIndicator(evidence.publishedDate, TRENDS_SNAPSHOT_V1.generatedAt);
  const commercializationRelevance = metadata.commercializationRelevance;
  const value = Math.round(sourceAuthority * 0.4 + freshness * 0.25 + commercializationRelevance * 0.35);
  return Object.freeze({
    value,
    label: value >= 85 ? "High-priority signal" : value >= 70 ? "Watch closely" : "Monitor",
    components: Object.freeze({ sourceAuthority, freshness, commercializationRelevance }),
    formula: "40% source authority + 25% publication freshness + 35% editorial commercialization relevance",
    purpose: "Dashboard prioritization of trend signals only",
    canAffectInvestmentScore: false
  });
}

function createCatalog() {
  const catalog = TRENDS_SNAPSHOT_V1.evidence.map((evidence) => {
    const metadata = TREND_METADATA[evidence.id];
    if (!metadata) throw new Error(`Missing trend-discovery metadata for ${evidence.id}.`);
    return Object.freeze({
      id: metadata.id,
      evidenceId: evidence.id,
      title: evidence.title,
      searchLabel: metadata.searchLabel,
      summary: evidence.excerpt,
      sourceUrl: evidence.url,
      sourceHost: new URL(evidence.url).hostname.toLowerCase().replace(/^www\./, ""),
      sourceRole: evidence.sourceRole,
      publishedDate: evidence.publishedDate,
      queryKind: evidence.queryKind,
      keyFeatures: metadata.keyFeatures,
      sectors: metadata.sectors,
      regions: metadata.regions,
      githubTerms: metadata.githubTerms,
      signalScore: trendSignalScore(evidence, metadata),
      verificationStatus: evidence.verificationStatus
    });
  });
  return Object.freeze(catalog);
}

export const TREND_COMPANY_DISCOVERY_CATALOG = createCatalog();

const CATALOG_BY_ID = new Map(TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => [trend.id, trend]));
const REGION_BY_ID = new Map(TREND_DISCOVERY_REGIONS.map((region) => [region.id, region]));
const SECTOR_BY_ID = new Map(TREND_DISCOVERY_SECTORS.map((sector) => [sector.id, sector]));

function compactText(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function exactEnum(value, fallback, definitions, label, code) {
  const candidate = value === undefined || value === null || value === "" ? fallback : value;
  if (typeof candidate !== "string" || !definitions.has(candidate)) {
    throw new TrendCompanyDiscoveryInputError(`${label} must be one of: ${[...definitions.keys()].join(", ")}.`, code);
  }
  return definitions.get(candidate);
}

export function validateTrendCompanyDiscoveryInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TrendCompanyDiscoveryInputError("Trend discovery request must be an object.", "INVALID_SHAPE");
  }
  const allowed = new Set(["selectedTrendIds", "region", "sector"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) {
    throw new TrendCompanyDiscoveryInputError(
      `Trend discovery request contains unsupported field \"${compactText(unknown, 80)}\".`,
      "UNKNOWN_FIELD"
    );
  }
  if (
    !Array.isArray(body.selectedTrendIds) ||
    body.selectedTrendIds.length < 1 ||
    body.selectedTrendIds.length > TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends
  ) {
    throw new TrendCompanyDiscoveryInputError(
      `selectedTrendIds must contain between 1 and ${TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends} trend IDs.`,
      "INVALID_TREND_SELECTION"
    );
  }
  const selectedTrendIds = body.selectedTrendIds.map((id, index) => {
    if (typeof id !== "string" || id.length > 80) {
      throw new TrendCompanyDiscoveryInputError(`selectedTrendIds[${index}] is invalid.`, "INVALID_TREND_ID");
    }
    if (!CATALOG_BY_ID.has(id)) {
      throw new TrendCompanyDiscoveryInputError(`selectedTrendIds[${index}] is not a server-known frozen trend ID.`, "UNKNOWN_TREND_ID");
    }
    return id;
  });
  if (new Set(selectedTrendIds).size !== selectedTrendIds.length) {
    throw new TrendCompanyDiscoveryInputError("selectedTrendIds cannot contain duplicates.", "DUPLICATE_TREND_ID");
  }
  const region = exactEnum(body.region, "GLOBAL", REGION_BY_ID, "region", "INVALID_REGION_FILTER");
  const sector = exactEnum(body.sector, "ALL", SECTOR_BY_ID, "sector", "INVALID_SECTOR_FILTER");
  return Object.freeze({
    selectedTrendIds: Object.freeze(selectedTrendIds),
    selectedTrends: Object.freeze(selectedTrendIds.map((id) => CATALOG_BY_ID.get(id))),
    region,
    sector
  });
}

function tavilyQueryForTrend(trend, filters, year) {
  const requiredSegments = [
    filters.region.searchTerm,
    "pre-seed seed",
    filters.sector.searchTerm,
    "startup founder funding raised launched",
    `${year - 1} ${year}`,
    trend.keyFeatures.join(" ")
  ];
  const query = compactText(requiredSegments.join(" "), 10_000);
  if (
    query.length > TREND_COMPANY_DISCOVERY_LIMITS.maxTavilyQueryCharacters ||
    requiredSegments.some((segment) => !query.includes(segment)) ||
    query.includes(trend.sourceUrl)
  ) {
    throw new TrendCompanyDiscoveryInputError(
      `Server-known trend ${trend.id} cannot fit the bounded company-discovery query.`,
      "TREND_QUERY_PLAN_OVERFLOW"
    );
  }
  return query;
}

function githubQueryForTrend(trend, filters, year, requiredRelevanceTerms) {
  const requiredSegments = [
    ...requiredRelevanceTerms,
    "in:name,description,topics",
    `created:>=${year - 2}-01-01`,
    `pushed:>=${year - 1}-01-01`,
    "is:public",
    "archived:false",
    "mirror:false",
    "template:false"
  ];
  const query = compactText(requiredSegments.join(" "), 10_000);
  if (
    query.length > TREND_COMPANY_DISCOVERY_LIMITS.maxGithubQueryCharacters ||
    requiredSegments.some((segment) => !query.includes(segment))
  ) {
    throw new TrendCompanyDiscoveryInputError(
      `Server-known trend ${trend.id} cannot fit the bounded GitHub query.`,
      "GITHUB_QUERY_PLAN_OVERFLOW"
    );
  }
  return query;
}

export function buildTrendCompanyDiscoveryPlan(validatedInput, now = Date.now) {
  const timestamp = typeof now === "function" ? now() : now;
  const year = new Date(timestamp).getUTCFullYear();
  if (!Number.isInteger(year) || year < 2020 || year > 2200) {
    throw new TrendCompanyDiscoveryInputError("Discovery time is invalid.", "INVALID_DISCOVERY_TIME");
  }
  const filters = { region: validatedInput.region, sector: validatedInput.sector };
  const tavilyQueries = validatedInput.selectedTrends.map((trend) => {
    const sourceContext = Object.freeze({
      title: trend.title,
      searchLabel: trend.searchLabel,
      url: trend.sourceUrl,
      host: trend.sourceHost,
      keyFeatures: trend.keyFeatures,
      treatment: "FROZEN_TREND_CONTEXT_NOT_SEARCH_TARGET"
    });
    return Object.freeze({
      trendId: trend.id,
      kind: "SELECTED_TREND_COMPANY_DISCOVERY",
      query: tavilyQueryForTrend(trend, filters, year),
      includeAnswer: false,
      topic: "news",
      queryPurpose: "ENTITY_FUNDING_PRODUCT_DISCOVERY",
      startDate: `${year - 1}-01-01`,
      excludeDomains: Object.freeze([trend.sourceHost]),
      sourceAnchor: Object.freeze({ title: trend.title, url: trend.sourceUrl }),
      sourceContext,
      keyFeatures: trend.keyFeatures
    });
  });
  const githubQueries = validatedInput.selectedTrends.map((trend) => {
    const requiredRelevanceTerms = Object.freeze([
      ...trend.githubTerms,
      ...(filters.sector.id === "ALL" ? [] : [filters.sector.queryTerm])
    ]);
    const query = githubQueryForTrend(trend, filters, year, requiredRelevanceTerms);
    const apiUrl = new URL("https://api.github.com/search/repositories");
    apiUrl.searchParams.set("q", query);
    apiUrl.searchParams.set("sort", "stars");
    apiUrl.searchParams.set("order", "desc");
    apiUrl.searchParams.set("per_page", String(TREND_COMPANY_DISCOVERY_LIMITS.maxGithubResultsPerTrend));
    apiUrl.searchParams.set("page", "1");
    return Object.freeze({
      trendId: trend.id,
      method: "GITHUB_REPOSITORY_SEARCH",
      query,
      apiUrl: apiUrl.toString(),
      sourceAnchor: Object.freeze({ title: trend.title, url: trend.sourceUrl }),
      keyFeatures: trend.keyFeatures,
      requiredRelevanceTerms
    });
  });
  return Object.freeze({
    schemaVersion: TREND_COMPANY_DISCOVERY_VERSION,
    selectedTrends: validatedInput.selectedTrends,
    filters: Object.freeze({
      region: Object.freeze({
        id: validatedInput.region.id,
        label: validatedInput.region.label,
        appliesTo: Object.freeze(["TAVILY_COMPANY_DISCOVERY"]),
        caveat: "GitHub Repository Search has no reliable repository-owner geography qualifier."
      }),
      sector: Object.freeze({
        id: validatedInput.sector.id,
        label: validatedInput.sector.label,
        appliesTo: Object.freeze(["TAVILY_COMPANY_DISCOVERY", "GITHUB_TOPIC_SEARCH"])
      })
    }),
    tavilyQueries: Object.freeze(tavilyQueries),
    githubQueries: Object.freeze(githubQueries),
    providerCaps: Object.freeze({
      tavilySearches: tavilyQueries.length,
      githubApiRequests: githubQueries.length,
      tavilyCreditsUpperBound: tavilyQueries.length
    })
  });
}

function safeGithubName(value, maxLength) {
  const text = compactText(value, maxLength + 1);
  return text.length <= maxLength && /^[A-Za-z0-9_.-]+$/.test(text) ? text : null;
}

function githubTimestamp(value, capturedAt) {
  const normalized = validDate(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  // Allow a small amount of upstream clock skew, but never turn a future
  // timestamp into a zero-day-old/recent project signal.
  return timestamp <= capturedAt + 5 * 60_000 ? normalized : null;
}

function normalizedGithubSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[-_.]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchedGithubRelevanceTerms(item, queryPlan) {
  if (!Array.isArray(queryPlan?.requiredRelevanceTerms) || !queryPlan.requiredRelevanceTerms.length) {
    throw new Error("GitHub query plan is missing controlled relevance terms.");
  }
  const safeTopics = Array.isArray(item.topics)
    ? item.topics.map((topic) => typeof topic === "string" ? topic : "")
    : [];
  const haystack = normalizedGithubSearchText([
    typeof item.name === "string" ? item.name : "",
    typeof item.description === "string" ? item.description : "",
    ...safeTopics
  ].join(" "));
  return [...new Set(queryPlan.requiredRelevanceTerms
    .map((term) => normalizedGithubSearchText(term))
    .filter(Boolean)
    .filter((term) => new RegExp(`(?:^| )${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(?=$| )`).test(haystack))
  )];
}

export function githubSignalsFromSearchPayload(payload, queryPlan, capturedAt) {
  githubCoverageFromSearchPayload(payload);
  const now = Date.parse(capturedAt);
  if (!Number.isFinite(now)) throw new Error("GitHub capture time is invalid.");
  const signals = [];
  for (const [index, item] of payload.items.slice(0, TREND_COMPANY_DISCOVERY_LIMITS.maxGithubResultsPerTrend).entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    if (
      item.private !== false ||
      item.visibility !== "public" ||
      item.fork !== false ||
      item.archived !== false ||
      item.is_template !== false ||
      item.mirror_url !== null
    ) continue;
    const ownerLogin = safeGithubName(item.owner?.login, 39);
    const repositoryName = safeGithubName(item.name, 100);
    const fullName = compactText(item.full_name, 140);
    if (!ownerLogin || !repositoryName || fullName.toLowerCase() !== `${ownerLogin}/${repositoryName}`.toLowerCase()) continue;
    const matchedRelevanceTerms = matchedGithubRelevanceTerms(item, queryPlan);
    if (!matchedRelevanceTerms.length) continue;
    const createdAt = githubTimestamp(item.created_at, now);
    const pushedAt = githubTimestamp(item.pushed_at, now);
    const updatedAt = githubTimestamp(item.updated_at, now);
    const stars = optionalWholeNumber(item.stargazers_count);
    const forks = optionalWholeNumber(item.forks_count);
    const subscribers = optionalWholeNumber(item.subscribers_count);
    const openIssues = optionalWholeNumber(item.open_issues_count);
    const repositoryUrl = `https://github.com/${ownerLogin}/${repositoryName}`;
    const ownerProfileUrl = `https://github.com/${ownerLogin}`;
    const createdAgeDays = createdAt ? Math.floor((now - Date.parse(createdAt)) / 86_400_000) : null;
    const pushedAgeDays = pushedAt ? Math.floor((now - Date.parse(pushedAt)) / 86_400_000) : null;
    signals.push({
      id: `GITHUB-${queryPlan.trendId}-${ownerLogin}-${repositoryName}`,
      selectedTrendIds: [queryPlan.trendId],
      repositoryName,
      fullName: `${ownerLogin}/${repositoryName}`,
      repositoryUrl,
      description: compactText(item.description, 500) || null,
      owner: {
        login: ownerLogin,
        profileUrl: ownerProfileUrl,
        accountType: item.owner?.type === "Organization" ? "Organization" : item.owner?.type === "User" ? "User" : "Unknown",
        founderOrStartupStatus: "NOT_ESTABLISHED"
      },
      language: compactText(item.language, 80) || null,
      topics: Array.isArray(item.topics)
        ? [...new Set(item.topics.map((topic) => compactText(topic, 50)).filter((topic) => /^[a-z0-9_.-]+$/i.test(topic)))].slice(0, 10)
        : [],
      matchedRelevanceTerms,
      popularity: {
        rankWithinTrendQuery: index + 1,
        stars,
        forks,
        subscribers,
        openIssues
      },
      activity: {
        createdAt,
        updatedAt,
        pushedAt,
        timestampCoverage: {
          createdAt: item.created_at && !createdAt ? "INVALID_OR_FUTURE" : createdAt ? "REPORTED" : "NOT_REPORTED",
          updatedAt: item.updated_at && !updatedAt ? "INVALID_OR_FUTURE" : updatedAt ? "REPORTED" : "NOT_REPORTED",
          pushedAt: item.pushed_at && !pushedAt ? "INVALID_OR_FUTURE" : pushedAt ? "REPORTED" : "NOT_REPORTED"
        },
        recentlyCreatedProject: createdAgeDays !== null && createdAgeDays <= 730,
        recentlyActiveProject: pushedAgeDays !== null && pushedAgeDays <= 180,
        basis: "Repository creation and push timestamps only; this does not infer a builder's biological age."
      },
      source: {
        provider: "GitHub",
        api: "Public Repository Search API",
        url: repositoryUrl,
        capturedAt,
        verificationStatus: "UNREVIEWED_PUBLIC_METADATA"
      },
      interpretation: "Repository metadata overlaps a controlled selected-trend term. This does not establish a company, founder relationship, traction, or investability."
    });
  }
  return signals;
}

export function githubCoverageFromSearchPayload(payload) {
  const totalCount = payload?.total_count;
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !Array.isArray(payload.items) ||
    typeof payload.incomplete_results !== "boolean" ||
    !Number.isSafeInteger(totalCount) ||
    totalCount < 0
  ) {
    throw new Error("GitHub returned an invalid repository-search response.");
  }
  return {
    totalCount,
    incompleteResults: payload.incomplete_results
  };
}

export function mergeGithubSignals(signalGroups) {
  const merged = new Map();
  for (const signal of signalGroups.flat()) {
    const key = signal.fullName.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...signal, selectedTrendIds: [...signal.selectedTrendIds] });
      continue;
    }
    existing.selectedTrendIds = [...new Set([...existing.selectedTrendIds, ...signal.selectedTrendIds])];
    existing.popularity.rankWithinTrendQuery = Math.min(
      existing.popularity.rankWithinTrendQuery,
      signal.popularity.rankWithinTrendQuery
    );
  }
  return [...merged.values()];
}

export const TREND_COMPANY_DISCOVERY_BOUNDARIES = Object.freeze({
  canAffectStartupScore: false,
  producesInvestmentDecision: false,
  producesProbabilityForecast: false,
  trendSignalScoreIsInvestmentScore: false,
  githubPopularityIsInvestmentEvidence: false,
  infersFounderAge: false,
  usesBiologicalAge: false,
  humanReviewRequired: true
});
