import { createHash } from "node:crypto";

export const OPEN_DATA_PROVIDER_VERSION = "proofline.open-data-providers.v1";

export const OPEN_DATA_PROVIDER_LIMITS = Object.freeze({
  maxCompanyNameLength: 160,
  maxFounderNames: 8,
  maxRecordsPerDataset: 20,
  requestTimeoutMs: 7_000,
  externalRequestsPerRun: 5
});

export const OPEN_DATA_DATASET_CATALOG = Object.freeze([
  Object.freeze({
    id: "GLEIF_LEI",
    label: "GLEIF LEI records",
    coverage: "Global legal entities that have an LEI",
    keyValues: Object.freeze(["legal-entity status", "LEI registration status", "jurisdiction", "record freshness"]),
    apiUrl: "https://api.gleif.org/api/v1/lei-records",
    documentationUrl: "https://www.gleif.org/en/lei-data/gleif-api/",
    licenseUrl: "https://www.gleif.org/en/meta/lei-data-terms-of-use",
    access: "No API key; CC0 data",
    independenceFamily: "GLOBAL_LEGAL_ENTITY_IDENTIFIER",
    interpretation: "An exact LEI match strengthens legal-identity resolution. Many startups have no LEI, so no match is unknown rather than adverse."
  }),
  Object.freeze({
    id: "CLINICAL_TRIALS_GOV",
    label: "ClinicalTrials.gov",
    coverage: "Registered clinical studies worldwide",
    keyValues: Object.freeze(["matched studies", "recruiting/active studies", "completed studies", "discontinued studies", "results posted"]),
    apiUrl: "https://clinicaltrials.gov/api/v2/studies",
    documentationUrl: "https://clinicaltrials.gov/data-api/api",
    licenseUrl: "https://clinicaltrials.gov/about-site/terms-conditions",
    access: "No API key",
    independenceFamily: "CLINICAL_TRIAL_REGISTRY",
    interpretation: "Study status is an execution and risk-attention signal only; registration or completion does not establish safety, efficacy, approval, or commercial success."
  }),
  Object.freeze({
    id: "NIH_REPORTER",
    label: "NIH RePORTER",
    coverage: "NIH and participating U.S. federal research awards",
    keyValues: Object.freeze(["active projects", "distinct projects", "reported award amounts", "SBIR/STTR mechanisms", "latest award notice"]),
    apiUrl: "https://api.reporter.nih.gov/v2/projects/search",
    documentationUrl: "https://api.reporter.nih.gov/",
    licenseUrl: "https://www.nih.gov/about-nih/frequently-asked-questions",
    access: "No API key; one request per second recommended",
    independenceFamily: "US_FEDERAL_AWARD",
    interpretation: "A matched award is public evidence of funded work, not revenue, validation, ownership of resulting IP, or future financing."
  }),
  Object.freeze({
    id: "USA_SPENDING",
    label: "USAspending.gov",
    coverage: "U.S. federal prime grants/cooperative agreements and contracts",
    keyValues: Object.freeze(["federal awards", "reported award amount", "active award periods", "grant/contract mix", "awarding agencies"]),
    apiUrl: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    documentationUrl: "https://api.usaspending.gov/docs/endpoints",
    licenseUrl: "https://www.usaspending.gov/about",
    access: "No API key",
    independenceFamily: "US_FEDERAL_AWARD",
    interpretation: "Reported award amounts are public federal-award values, not necessarily cash received, recognized revenue, profit, or recurring demand. NIH and USAspending can describe the same underlying award and are not double-counted as independent evidence."
  }),
  Object.freeze({
    id: "GITHUB_PUBLIC_API",
    label: "GitHub public repository metadata",
    coverage: "Public repositories matched by selected trend terms",
    keyValues: Object.freeze(["stars", "forks", "actual subscribers when reported", "creation date", "recent activity"]),
    apiUrl: "https://api.github.com/search/repositories",
    documentationUrl: "https://docs.github.com/en/rest/search/search#search-repositories",
    licenseUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    access: "Already integrated in trend-grounded discovery; unauthenticated or optional server token",
    independenceFamily: "PUBLIC_OPEN_SOURCE_ACTIVITY",
    interpretation: "Repository popularity does not establish a founder/company relationship, growth, revenue, founder quality, or investability."
  })
]);

const DATASET_BY_ID = new Map(OPEN_DATA_DATASET_CATALOG.map((item) => [item.id, item]));
const LEGAL_SUFFIXES = new Set([
  "ab", "ag", "bv", "co", "company", "corp", "corporation", "gmbh", "inc", "incorporated",
  "limited", "llc", "llp", "ltd", "oy", "plc", "pte", "pty", "sa", "sas", "sarl", "spa"
]);
const CLINICAL_ACTIVE = new Set(["ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION", "NOT_YET_RECRUITING", "RECRUITING"]);
const CLINICAL_DISCONTINUED = new Set(["SUSPENDED", "TERMINATED", "WITHDRAWN"]);
const USA_GRANT_CODES = Object.freeze(["02", "03", "04", "05", "F001", "F002"]);
const USA_CONTRACT_CODES = Object.freeze(["A", "B", "C", "D"]);

function compactText(value, max = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanCompanyName(value) {
  const name = compactText(value, OPEN_DATA_PROVIDER_LIMITS.maxCompanyNameLength);
  if (name.length < 2) throw new TypeError("companyName must contain at least two characters.");
  return name;
}

export function normalizedLegalName(value) {
  const words = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1))) words.pop();
  return words.join(" ");
}

function exactEntityMatch(expected, candidate) {
  const expectedKey = normalizedLegalName(expected);
  const candidateKey = normalizedLegalName(candidate);
  return expectedKey.length >= 2 && expectedKey === candidateKey;
}

function stableId(...parts) {
  return `OD-${createHash("sha256").update(parts.map(String).join("\u001f")).digest("hex").slice(0, 16)}`;
}

function isoTime(value, fallback = null) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function source(datasetId, title, url, accessedAt) {
  return Object.freeze({
    datasetId,
    title: compactText(title, 280),
    url: String(url),
    publisher: DATASET_BY_ID.get(datasetId)?.label || datasetId,
    accessedAt
  });
}

async function fetchJson(url, { fetchImpl, timeoutMs, method = "GET", body = null, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { Accept: "application/json", ...headers },
      ...(body == null ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal
    });
    if (!response?.ok) {
      const error = new Error(`Official dataset request failed with HTTP ${response?.status ?? "unknown"}.`);
      error.status = response?.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function unavailableDataset(id, error) {
  const dataset = DATASET_BY_ID.get(id);
  return Object.freeze({
    ...dataset,
    status: "UNAVAILABLE",
    matchedRecords: 0,
    summary: null,
    records: Object.freeze([]),
    warnings: Object.freeze([compactText(error instanceof Error ? error.message : error, 320) || "The official dataset was unavailable."]),
    absenceIsNegative: false,
    canAffectOpportunityScore: false
  });
}

function completedDataset(id, records, summary, warnings = []) {
  const dataset = DATASET_BY_ID.get(id);
  return Object.freeze({
    ...dataset,
    status: records.length ? "MATCHED" : "NO_EXACT_ENTITY_MATCH",
    matchedRecords: records.length,
    summary: Object.freeze(summary),
    records: Object.freeze(records.map(Object.freeze)),
    warnings: Object.freeze(warnings),
    absenceIsNegative: false,
    canAffectOpportunityScore: false
  });
}

async function queryGleif(companyName, context) {
  const datasetId = "GLEIF_LEI";
  const params = new URLSearchParams({ "filter[entity.legalName]": companyName, "page[size]": "10" });
  const requestUrl = `${DATASET_BY_ID.get(datasetId).apiUrl}?${params}`;
  const payload = await fetchJson(requestUrl, context);
  const candidates = Array.isArray(payload?.data) ? payload.data : [];
  const records = candidates
    .filter((item) => exactEntityMatch(companyName, item?.attributes?.entity?.legalName?.name))
    .slice(0, OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset)
    .map((item) => {
      const entity = item.attributes?.entity || {};
      const registration = item.attributes?.registration || {};
      const legalStatus = compactText(entity.status, 50) || "NOT_REPORTED";
      const registrationStatus = compactText(registration.status, 50) || "NOT_REPORTED";
      return {
        id: stableId(datasetId, item.id),
        subjectType: "STARTUP",
        subjectName: companyName,
        matchedEntityName: compactText(entity.legalName?.name, 200),
        entityMatch: { method: "NORMALIZED_EXACT_LEGAL_NAME", confidence: 0.97 },
        signalType: "LEGAL_IDENTITY",
        direction: legalStatus === "INACTIVE" || ["LAPSED", "MERGED", "RETIRED"].includes(registrationStatus) ? "RISK_ATTENTION" : "IDENTITY_EVIDENCE",
        values: {
          lei: compactText(item.id, 40),
          legalEntityStatus: legalStatus,
          registrationStatus,
          jurisdiction: compactText(entity.jurisdiction, 40) || null,
          legalForm: compactText(entity.legalForm?.id, 80) || null,
          lastUpdateDate: isoTime(registration.lastUpdateDate),
          nextRenewalDate: isoTime(registration.nextRenewalDate)
        },
        observedAt: context.accessedAt,
        source: source(datasetId, `${entity.legalName?.name || companyName} — LEI ${item.id}`, `${DATASET_BY_ID.get(datasetId).apiUrl}/${encodeURIComponent(item.id)}`, context.accessedAt),
        interpretation: "This is an exact normalized legal-name match in GLEIF. LEI registration status is not a solvency, compliance, or startup-quality rating."
      };
    });
  const active = records.filter((item) => item.values.legalEntityStatus === "ACTIVE").length;
  const attention = records.filter((item) => item.direction === "RISK_ATTENTION").length;
  return completedDataset(datasetId, records, {
    exactLegalNameMatches: records.length,
    activeLegalEntities: active,
    riskAttentionRecords: attention,
    candidateRecordsRejectedByExactMatch: Math.max(0, candidates.length - records.length)
  });
}

function clinicalSponsorMatches(companyName, study) {
  const sponsors = study?.protocolSection?.sponsorCollaboratorsModule || {};
  const values = [
    sponsors.leadSponsor?.name,
    ...(Array.isArray(sponsors.collaborators) ? sponsors.collaborators.map((item) => item?.name) : [])
  ].filter(Boolean);
  return values.find((name) => exactEntityMatch(companyName, name)) || null;
}

async function queryClinicalTrials(companyName, context) {
  const datasetId = "CLINICAL_TRIALS_GOV";
  const params = new URLSearchParams({
    "query.spons": companyName,
    format: "json",
    pageSize: String(OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset),
    countTotal: "true"
  });
  const payload = await fetchJson(`${DATASET_BY_ID.get(datasetId).apiUrl}?${params}`, context);
  const candidates = Array.isArray(payload?.studies) ? payload.studies : [];
  const records = candidates.flatMap((study) => {
    const matchedSponsor = clinicalSponsorMatches(companyName, study);
    if (!matchedSponsor) return [];
    const protocol = study.protocolSection || {};
    const identity = protocol.identificationModule || {};
    const statusModule = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const status = compactText(statusModule.overallStatus, 60) || "NOT_REPORTED";
    const nctId = compactText(identity.nctId, 40);
    const direction = CLINICAL_DISCONTINUED.has(status)
      ? "RISK_ATTENTION"
      : CLINICAL_ACTIVE.has(status)
        ? "EXECUTION_SIGNAL"
        : status === "COMPLETED" ? "MILESTONE_SIGNAL" : "NEUTRAL_CONTEXT";
    return [{
      id: stableId(datasetId, nctId),
      subjectType: "STARTUP",
      subjectName: companyName,
      matchedEntityName: compactText(matchedSponsor, 200),
      entityMatch: { method: "NORMALIZED_EXACT_SPONSOR_OR_COLLABORATOR_NAME", confidence: 0.94 },
      signalType: "CLINICAL_EXECUTION",
      direction,
      values: {
        nctId,
        title: compactText(identity.briefTitle || identity.officialTitle, 320),
        overallStatus: status,
        studyType: compactText(design.studyType, 60) || null,
        phases: Array.isArray(design.phases) ? design.phases.map((item) => compactText(item, 40)).filter(Boolean) : [],
        enrollment: finiteNumber(design.enrollmentInfo?.count),
        startDate: isoTime(statusModule.startDateStruct?.date),
        completionDate: isoTime(statusModule.completionDateStruct?.date),
        lastUpdateDate: isoTime(statusModule.lastUpdatePostDateStruct?.date) || isoTime(statusModule.studyFirstPostDateStruct?.date),
        hasResults: study.hasResults === true
      },
      observedAt: context.accessedAt,
      source: source(datasetId, `${nctId} — ${identity.briefTitle || identity.officialTitle || "Clinical study"}`, `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`, context.accessedAt),
      interpretation: "A matched registry record describes disclosed study activity. Status and results-posted flags do not establish safety, efficacy, regulatory approval, or commercial traction."
    }];
  }).slice(0, OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset);
  const statusCount = (set) => records.filter((item) => set.has(item.values.overallStatus)).length;
  return completedDataset(datasetId, records, {
    exactSponsorMatches: records.length,
    activeOrRecruitingStudies: statusCount(CLINICAL_ACTIVE),
    completedStudies: records.filter((item) => item.values.overallStatus === "COMPLETED").length,
    discontinuedStudies: statusCount(CLINICAL_DISCONTINUED),
    studiesWithResultsPosted: records.filter((item) => item.values.hasResults).length,
    broadQueryTotal: finiteNumber(payload?.totalCount),
    broadCandidatesRejectedByExactMatch: Math.max(0, candidates.length - records.length)
  });
}

async function queryNihReporter(companyName, context) {
  const datasetId = "NIH_REPORTER";
  const payload = await fetchJson(DATASET_BY_ID.get(datasetId).apiUrl, {
    ...context,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      criteria: { org_names: [companyName] },
      offset: 0,
      limit: OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset,
      sort_field: "award_notice_date",
      sort_order: "desc"
    }
  });
  const candidates = Array.isArray(payload?.results) ? payload.results : [];
  const records = candidates
    .filter((item) => exactEntityMatch(companyName, item?.organization?.org_name))
    .slice(0, OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset)
    .map((item) => {
      const projectUrl = item.project_detail_url || `https://reporter.nih.gov/project-details/${encodeURIComponent(item.appl_id)}`;
      return {
        id: stableId(datasetId, item.appl_id),
        subjectType: "STARTUP",
        subjectName: companyName,
        matchedEntityName: compactText(item.organization?.org_name, 200),
        entityMatch: { method: "NORMALIZED_EXACT_AWARDEE_NAME", confidence: 0.97 },
        signalType: "PUBLIC_RESEARCH_AWARD",
        direction: item.is_active === true ? "NON_DILUTIVE_FUNDING_SIGNAL" : "HISTORICAL_MILESTONE",
        values: {
          applicationId: finiteNumber(item.appl_id),
          projectNumber: compactText(item.project_num, 80),
          coreProjectNumber: compactText(item.core_project_num, 80) || null,
          projectTitle: compactText(item.project_title, 360),
          fiscalYear: finiteNumber(item.fiscal_year),
          awardAmountUsd: finiteNumber(item.award_amount),
          active: item.is_active === true,
          fundingMechanism: compactText(item.funding_mechanism, 100) || null,
          activityCode: compactText(item.activity_code, 40) || null,
          agency: compactText(item.agency_ic_admin?.name || item.agency_code, 180) || null,
          projectStartDate: isoTime(item.project_start_date),
          projectEndDate: isoTime(item.project_end_date),
          awardNoticeDate: isoTime(item.award_notice_date),
          principalInvestigators: Array.isArray(item.principal_investigators)
            ? item.principal_investigators.map((pi) => compactText(pi.full_name, 160)).filter(Boolean).slice(0, 8)
            : []
        },
        observedAt: context.accessedAt,
        source: source(datasetId, `${item.project_num || "NIH award"} — ${item.project_title || companyName}`, projectUrl, context.accessedAt),
        interpretation: "The award amount and project status come from NIH RePORTER. They are funded-work evidence, not revenue, product validation, or an ownership determination."
      };
    });
  const distinctProjects = new Set(records.map((item) => item.values.coreProjectNumber || item.values.projectNumber).filter(Boolean));
  const totalAwardAmount = records.reduce((sum, item) => sum + (item.values.awardAmountUsd || 0), 0);
  return completedDataset(datasetId, records, {
    exactAwardeeMatches: records.length,
    distinctProjects: distinctProjects.size,
    activeApplications: records.filter((item) => item.values.active).length,
    reportedApplicationAwardsUsd: totalAwardAmount,
    sbirOrSttrApplications: records.filter((item) => /SBIR|STTR/i.test(item.values.fundingMechanism || "")).length,
    broadQueryTotal: finiteNumber(payload?.meta?.total),
    broadCandidatesRejectedByExactMatch: Math.max(0, candidates.length - records.length)
  });
}

function usaSpendingBody(companyName, awardTypeCodes, startDate, endDate) {
  return {
    filters: {
      recipient_search_text: [companyName],
      award_type_codes: awardTypeCodes,
      time_period: [{ start_date: startDate, end_date: endDate }]
    },
    fields: ["Award ID", "Recipient Name", "Start Date", "End Date", "Award Amount", "Awarding Agency", "Award Type"],
    page: 1,
    limit: 12,
    sort: "Award Amount",
    order: "desc",
    subawards: false
  };
}

async function queryUsaSpending(companyName, context) {
  const datasetId = "USA_SPENDING";
  const now = new Date(context.accessedAt);
  const endDate = context.accessedAt.slice(0, 10);
  const startDate = `${now.getUTCFullYear() - 6}-01-01`;
  const queryGroup = async (awardTypeCodes) => fetchJson(DATASET_BY_ID.get(datasetId).apiUrl, {
    ...context,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: usaSpendingBody(companyName, awardTypeCodes, startDate, endDate)
  });
  const settled = await Promise.allSettled([queryGroup(USA_GRANT_CODES), queryGroup(USA_CONTRACT_CODES)]);
  const warnings = settled.filter((item) => item.status === "rejected").map((item) => compactText(item.reason?.message || item.reason, 240));
  if (settled.every((item) => item.status === "rejected")) throw new Error(warnings.join(" ") || "USAspending queries were unavailable.");
  const candidates = settled.flatMap((item) => item.status === "fulfilled" && Array.isArray(item.value?.results) ? item.value.results : []);
  const seen = new Set();
  const records = candidates.flatMap((item) => {
    if (!exactEntityMatch(companyName, item?.["Recipient Name"])) return [];
    const unique = compactText(item.generated_internal_id || `${item["Award ID"]}:${item["Award Type"]}`, 180);
    if (seen.has(unique)) return [];
    seen.add(unique);
    const end = isoTime(item["End Date"]);
    const active = Boolean(end && Date.parse(end) >= Date.parse(context.accessedAt));
    const awardId = compactText(item["Award ID"], 100);
    return [{
      id: stableId(datasetId, unique),
      subjectType: "STARTUP",
      subjectName: companyName,
      matchedEntityName: compactText(item["Recipient Name"], 200),
      entityMatch: { method: "NORMALIZED_EXACT_RECIPIENT_NAME", confidence: 0.95 },
      signalType: "US_FEDERAL_AWARD",
      direction: active ? "GOVERNMENT_AWARD_SIGNAL" : "HISTORICAL_MILESTONE",
      values: {
        awardId,
        awardType: compactText(item["Award Type"], 120),
        awardAmountUsd: finiteNumber(item["Award Amount"]),
        awardingAgency: compactText(item["Awarding Agency"], 180) || null,
        startDate: isoTime(item["Start Date"]),
        endDate: end,
        activeAwardPeriod: active,
        generatedInternalId: compactText(item.generated_internal_id, 220) || null
      },
      observedAt: context.accessedAt,
      source: source(datasetId, `${awardId || "Federal award"} — ${item["Recipient Name"] || companyName}`, item.generated_internal_id ? `https://www.usaspending.gov/award/${encodeURIComponent(item.generated_internal_id)}/` : "https://www.usaspending.gov/search", context.accessedAt),
      interpretation: "USAspending reports a federal prime award. The displayed award amount is not necessarily cash received, revenue recognized, profit, or recurring commercial demand."
    }];
  }).slice(0, OPEN_DATA_PROVIDER_LIMITS.maxRecordsPerDataset);
  const totalAwardAmount = records.reduce((sum, item) => sum + (item.values.awardAmountUsd || 0), 0);
  return completedDataset(datasetId, records, {
    exactRecipientMatches: records.length,
    activeAwardPeriods: records.filter((item) => item.values.activeAwardPeriod).length,
    reportedAwardAmountUsd: totalAwardAmount,
    grantOrCooperativeAwards: records.filter((item) => /GRANT|COOPERATIVE/i.test(item.values.awardType || "")).length,
    contractAwards: records.filter((item) => /CONTRACT|ORDER|CALL/i.test(item.values.awardType || "")).length,
    broadCandidatesRejectedByExactMatch: Math.max(0, candidates.length - records.length)
  }, warnings);
}

export async function collectOfficialOpenData({
  companyName,
  founderNames = [],
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = OPEN_DATA_PROVIDER_LIMITS.requestTimeoutMs
} = {}) {
  const company = cleanCompanyName(companyName);
  if (!Array.isArray(founderNames) || founderNames.length > OPEN_DATA_PROVIDER_LIMITS.maxFounderNames) {
    throw new TypeError(`founderNames must be an array with at most ${OPEN_DATA_PROVIDER_LIMITS.maxFounderNames} values.`);
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
  const timestamp = typeof now === "function" ? now() : now;
  if (!Number.isFinite(Number(timestamp))) throw new TypeError("now must produce a finite timestamp.");
  const accessedAt = new Date(Number(timestamp)).toISOString();
  const context = { fetchImpl, timeoutMs: Math.max(1_000, Math.min(15_000, Number(timeoutMs) || OPEN_DATA_PROVIDER_LIMITS.requestTimeoutMs)), accessedAt };
  const jobs = [
    ["GLEIF_LEI", queryGleif(company, context)],
    ["CLINICAL_TRIALS_GOV", queryClinicalTrials(company, context)],
    ["NIH_REPORTER", queryNihReporter(company, context)],
    ["USA_SPENDING", queryUsaSpending(company, context)]
  ];
  const settled = await Promise.allSettled(jobs.map(([, promise]) => promise));
  const datasets = settled.map((result, index) => result.status === "fulfilled" ? result.value : unavailableDataset(jobs[index][0], result.reason));
  const matchedDatasets = datasets.filter((item) => item.status === "MATCHED").length;
  const completedDatasets = datasets.filter((item) => item.status !== "UNAVAILABLE").length;
  return Object.freeze({
    version: OPEN_DATA_PROVIDER_VERSION,
    entity: Object.freeze({ companyName: company, founderNames: Object.freeze(founderNames.map((name) => compactText(name, 120)).filter(Boolean)) }),
    generatedAt: accessedAt,
    datasets: Object.freeze(datasets),
    catalog: OPEN_DATA_DATASET_CATALOG,
    coverage: Object.freeze({
      queriedDatasets: 4,
      completedDatasets,
      matchedDatasets,
      matchedRecords: datasets.reduce((sum, item) => sum + item.matchedRecords, 0),
      unavailableDatasets: datasets.length - completedDatasets
    }),
    usage: Object.freeze({
      credentialsRequired: false,
      providerCreditsUsed: 0,
      externalRequestsUpperBound: OPEN_DATA_PROVIDER_LIMITS.externalRequestsPerRun,
      queryIsEntityScoped: true
    }),
    boundaries: Object.freeze({
      canAffectOpportunityScore: false,
      producesSuccessProbability: false,
      producesRevenueForecast: false,
      absenceIsNegative: false,
      exactNormalizedEntityMatchRequired: true,
      sameUnderlyingFederalAwardCountsOnce: true,
      humanReviewRequired: true
    }),
    interpretation: "Official open-data observations are a separate, unreviewed growth-and-risk context layer. They do not change the Proofline Opportunity score until a future published policy explicitly validates a dataset, entity link, feature definition, and calibration."
  });
}
