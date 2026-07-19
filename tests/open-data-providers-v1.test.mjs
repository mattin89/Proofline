import assert from "node:assert/strict";
import test from "node:test";

import {
  OPEN_DATA_PROVIDER_LIMITS,
  OPEN_DATA_PROVIDER_VERSION,
  collectOfficialOpenData,
  normalizedLegalName
} from "../src/open-data-providers-v1.mjs";

const COMPANY_NAME = "Acme Robotics, Inc.";
const FIXED_TIME = "2026-07-19T12:00:00.000Z";
const FIXED_NOW = Date.parse(FIXED_TIME);

const OFFICIAL_FIXTURES = Object.freeze({
  gleif: {
    data: [
      {
        id: "529900ACMEROBOTICS01",
        attributes: {
          entity: {
            legalName: { name: "ACME ROBOTICS LTD" },
            status: "INACTIVE",
            jurisdiction: "US-DE",
            legalForm: { id: "HZEH" }
          },
          registration: {
            status: "LAPSED",
            lastUpdateDate: "2026-01-02",
            nextRenewalDate: "2026-12-31"
          }
        }
      },
      {
        id: "529900ACMEROBOTICSLABS",
        attributes: {
          entity: {
            legalName: { name: "Acme Robotics Labs, Inc." },
            status: "ACTIVE",
            jurisdiction: "US-CA"
          },
          registration: { status: "ISSUED", lastUpdateDate: "2026-06-01" }
        }
      }
    ]
  },
  clinicalTrials: {
    totalCount: 4,
    studies: [
      {
        hasResults: true,
        protocolSection: {
          identificationModule: { nctId: "NCT00000001", briefTitle: "Active exact-sponsor study" },
          sponsorCollaboratorsModule: { leadSponsor: { name: "ACME ROBOTICS LIMITED" }, collaborators: [] },
          statusModule: {
            overallStatus: "RECRUITING",
            startDateStruct: { date: "2025-01-15" },
            completionDateStruct: { date: "2027-06" },
            studyFirstPostDateStruct: { date: "2025-02-01" },
            lastUpdatePostDateStruct: { date: "2026-07-01" }
          },
          designModule: {
            studyType: "INTERVENTIONAL",
            phases: ["PHASE2"],
            enrollmentInfo: { count: 120 }
          }
        }
      },
      {
        hasResults: false,
        protocolSection: {
          identificationModule: { nctId: "NCT00000002", briefTitle: "Discontinued collaborator study" },
          sponsorCollaboratorsModule: {
            leadSponsor: { name: "Example University" },
            collaborators: [{ name: "Acme Robotics LLC" }]
          },
          statusModule: {
            overallStatus: "TERMINATED",
            startDateStruct: { date: "2024-04-10" },
            completionDateStruct: { date: "2025-02-20" },
            lastUpdatePostDateStruct: { date: "2025-03-01" }
          },
          designModule: { studyType: "INTERVENTIONAL", phases: ["EARLY_PHASE1"], enrollmentInfo: { count: 14 } }
        }
      },
      {
        hasResults: true,
        protocolSection: {
          identificationModule: { nctId: "NCT00000003", briefTitle: "Completed exact-sponsor study" },
          sponsorCollaboratorsModule: { leadSponsor: { name: "Acme Robotics Corp." } },
          statusModule: {
            overallStatus: "COMPLETED",
            startDateStruct: { date: "2022-01-01" },
            completionDateStruct: { date: "2024-12-31" },
            lastUpdatePostDateStruct: { date: "2025-05-05" }
          },
          designModule: { studyType: "OBSERVATIONAL", enrollmentInfo: { count: 80 } }
        }
      },
      {
        hasResults: true,
        protocolSection: {
          identificationModule: { nctId: "NCT00000004", briefTitle: "Near-name study that must be rejected" },
          sponsorCollaboratorsModule: { leadSponsor: { name: "Acme Robotics Labs Inc." } },
          statusModule: { overallStatus: "RECRUITING" },
          designModule: { studyType: "INTERVENTIONAL" }
        }
      }
    ]
  },
  nih: {
    meta: { total: 3 },
    results: [
      {
        appl_id: 101,
        project_num: "1R43NS000001-01",
        core_project_num: "R43NS000001",
        project_title: "Assistive robotics feasibility",
        fiscal_year: 2026,
        award_amount: 250_000,
        is_active: true,
        funding_mechanism: "SBIR",
        activity_code: "R43",
        agency_ic_admin: { name: "National Institute of Neurological Disorders and Stroke" },
        project_start_date: "2026-01-01",
        project_end_date: "2026-12-31",
        award_notice_date: "2025-12-15",
        project_detail_url: "https://reporter.nih.gov/project-details/101",
        organization: { org_name: "Acme Robotics LLC" },
        principal_investigators: [{ full_name: "Alice Founder" }]
      },
      {
        appl_id: 102,
        project_num: "2R42NS000002-02",
        core_project_num: "R42NS000002",
        project_title: "Robotic rehabilitation trial platform",
        fiscal_year: 2025,
        award_amount: "750000",
        is_active: false,
        funding_mechanism: "STTR",
        activity_code: "R42",
        agency_code: "NICHD",
        project_start_date: "2023-07-01",
        project_end_date: "2025-06-30",
        award_notice_date: "2024-10-20",
        organization: { org_name: "ACME ROBOTICS LIMITED" },
        principal_investigators: [{ full_name: "Alice Founder" }, { full_name: "Bob Scientist" }]
      },
      {
        appl_id: 103,
        project_num: "1R44NS999999-01",
        core_project_num: "R44NS999999",
        project_title: "Different legal entity",
        fiscal_year: 2026,
        award_amount: 900_000,
        is_active: true,
        funding_mechanism: "SBIR",
        organization: { org_name: "Acme Robotics Labs, Inc." }
      }
    ]
  },
  usaGrant: {
    results: [
      {
        generated_internal_id: "ASST_NON_ACME_GRANT_1",
        "Award ID": "GRANT-1",
        "Recipient Name": "ACME ROBOTICS CORP",
        "Start Date": "2026-01-01",
        "End Date": "2027-12-31",
        "Award Amount": 400_000,
        "Awarding Agency": "Department of Health and Human Services",
        "Award Type": "PROJECT GRANT"
      },
      {
        generated_internal_id: "ASST_NON_ACME_LABS_GRANT",
        "Award ID": "GRANT-LABS",
        "Recipient Name": "Acme Robotics Labs Inc.",
        "Start Date": "2026-01-01",
        "End Date": "2027-12-31",
        "Award Amount": 999_999,
        "Awarding Agency": "National Science Foundation",
        "Award Type": "PROJECT GRANT"
      }
    ]
  },
  usaContract: {
    results: [
      {
        generated_internal_id: "CONT_AWARD_ACME_CONTRACT_1",
        "Award ID": "CONTRACT-1",
        "Recipient Name": "Acme Robotics, Ltd.",
        "Start Date": "2022-01-01",
        "End Date": "2025-12-31",
        "Award Amount": "600000",
        "Awarding Agency": "Department of Defense",
        "Award Type": "DEFINITIVE CONTRACT"
      },
      {
        generated_internal_id: "CONT_AWARD_ACME_LABS_CONTRACT",
        "Award ID": "CONTRACT-LABS",
        "Recipient Name": "Acme Robotics Labs, LLC",
        "Start Date": "2025-01-01",
        "End Date": "2026-12-31",
        "Award Amount": 888_888,
        "Awarding Agency": "Department of Energy",
        "Award Type": "DEFINITIVE CONTRACT"
      }
    ]
  }
});

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return structuredClone(payload);
    }
  };
}

function createOfficialApiMock({ failingDataset = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const requestUrl = String(url);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: requestUrl, method, body, headers: options.headers });

    if (requestUrl.startsWith("https://api.gleif.org/")) {
      if (failingDataset === "GLEIF_LEI") return jsonResponse({}, { ok: false, status: 503 });
      return jsonResponse(OFFICIAL_FIXTURES.gleif);
    }
    if (requestUrl.startsWith("https://clinicaltrials.gov/")) {
      if (failingDataset === "CLINICAL_TRIALS_GOV") return jsonResponse({}, { ok: false, status: 503 });
      return jsonResponse(OFFICIAL_FIXTURES.clinicalTrials);
    }
    if (requestUrl.startsWith("https://api.reporter.nih.gov/")) {
      if (failingDataset === "NIH_REPORTER") return jsonResponse({}, { ok: false, status: 503 });
      return jsonResponse(OFFICIAL_FIXTURES.nih);
    }
    if (requestUrl.startsWith("https://api.usaspending.gov/")) {
      if (failingDataset === "USA_SPENDING") return jsonResponse({}, { ok: false, status: 503 });
      const codes = body?.filters?.award_type_codes || [];
      return jsonResponse(codes.includes("A") ? OFFICIAL_FIXTURES.usaContract : OFFICIAL_FIXTURES.usaGrant);
    }
    throw new Error(`Unexpected external request: ${method} ${requestUrl}`);
  };
  return { fetchImpl, calls };
}

function dataset(result, id) {
  const match = result.datasets.find((item) => item.id === id);
  assert.ok(match, `Expected dataset ${id}`);
  return match;
}

async function collectMatched(options = {}) {
  const api = createOfficialApiMock(options);
  const result = await collectOfficialOpenData({
    companyName: COMPANY_NAME,
    founderNames: [" Alice Founder "],
    fetchImpl: api.fetchImpl,
    now: () => FIXED_NOW
  });
  return { result, calls: api.calls };
}

test("normalized legal-name matching accepts only suffix/case variants and rejects near entities", async () => {
  assert.equal(normalizedLegalName("  ACME Robotics, Incorporated "), "acme robotics");
  assert.equal(normalizedLegalName("Acme Robotics LLC"), "acme robotics");
  assert.notEqual(normalizedLegalName("Acme Robotics Labs, Inc."), normalizedLegalName(COMPANY_NAME));

  const { result } = await collectMatched();
  assert.deepEqual(result.entity, { companyName: COMPANY_NAME, founderNames: ["Alice Founder"] });

  const gleif = dataset(result, "GLEIF_LEI");
  assert.equal(gleif.matchedRecords, 1);
  assert.equal(gleif.summary.candidateRecordsRejectedByExactMatch, 1);
  assert.equal(gleif.records[0].matchedEntityName, "ACME ROBOTICS LTD");

  const clinical = dataset(result, "CLINICAL_TRIALS_GOV");
  assert.equal(clinical.matchedRecords, 3);
  assert.equal(clinical.summary.broadCandidatesRejectedByExactMatch, 1);
  assert.equal(clinical.records.some((item) => item.matchedEntityName.includes("Labs")), false);

  const nih = dataset(result, "NIH_REPORTER");
  assert.equal(nih.matchedRecords, 2);
  assert.equal(nih.summary.broadCandidatesRejectedByExactMatch, 1);

  const spending = dataset(result, "USA_SPENDING");
  assert.equal(spending.matchedRecords, 2);
  assert.equal(spending.summary.broadCandidatesRejectedByExactMatch, 2);
});

test("GLEIF inactivity is risk attention while ClinicalTrials statuses and results are counted separately", async () => {
  const { result } = await collectMatched();
  const gleif = dataset(result, "GLEIF_LEI");
  assert.equal(gleif.status, "MATCHED");
  assert.deepEqual(gleif.summary, {
    exactLegalNameMatches: 1,
    activeLegalEntities: 0,
    riskAttentionRecords: 1,
    candidateRecordsRejectedByExactMatch: 1
  });
  assert.equal(gleif.records[0].direction, "RISK_ATTENTION");
  assert.equal(gleif.records[0].values.legalEntityStatus, "INACTIVE");
  assert.equal(gleif.records[0].values.registrationStatus, "LAPSED");

  const clinical = dataset(result, "CLINICAL_TRIALS_GOV");
  assert.deepEqual(clinical.summary, {
    exactSponsorMatches: 3,
    activeOrRecruitingStudies: 1,
    completedStudies: 1,
    discontinuedStudies: 1,
    studiesWithResultsPosted: 2,
    broadQueryTotal: 4,
    broadCandidatesRejectedByExactMatch: 1
  });
  assert.equal(clinical.records.find((item) => item.values.nctId === "NCT00000001").direction, "EXECUTION_SIGNAL");
  assert.equal(clinical.records.find((item) => item.values.nctId === "NCT00000002").direction, "RISK_ATTENTION");
  assert.equal(clinical.records.find((item) => item.values.nctId === "NCT00000003").direction, "MILESTONE_SIGNAL");
});

test("NIH exact awardees and USAspending grant/contract records aggregate only reported amounts", async () => {
  const { result } = await collectMatched();
  const nih = dataset(result, "NIH_REPORTER");
  assert.deepEqual(nih.records.map((item) => item.values.awardAmountUsd), [250_000, 750_000]);
  assert.deepEqual(nih.summary, {
    exactAwardeeMatches: 2,
    distinctProjects: 2,
    activeApplications: 1,
    reportedApplicationAwardsUsd: 1_000_000,
    sbirOrSttrApplications: 2,
    broadQueryTotal: 3,
    broadCandidatesRejectedByExactMatch: 1
  });

  const spending = dataset(result, "USA_SPENDING");
  assert.deepEqual(spending.records.map((item) => item.values.awardAmountUsd).sort((a, b) => a - b), [400_000, 600_000]);
  assert.deepEqual(spending.summary, {
    exactRecipientMatches: 2,
    activeAwardPeriods: 1,
    reportedAwardAmountUsd: 1_000_000,
    grantOrCooperativeAwards: 1,
    contractAwards: 1,
    broadCandidatesRejectedByExactMatch: 2
  });
  for (const record of spending.records) {
    assert.match(record.interpretation, /not necessarily cash received, revenue recognized, profit, or recurring commercial demand/i);
  }
});

test("no exact entity match is an explicit unknown rather than a zero or adverse signal", async () => {
  const api = createOfficialApiMock();
  const result = await collectOfficialOpenData({
    companyName: "Nova Robotics, Inc.",
    fetchImpl: api.fetchImpl,
    now: FIXED_NOW
  });

  assert.deepEqual(result.coverage, {
    queriedDatasets: 4,
    completedDatasets: 4,
    matchedDatasets: 0,
    matchedRecords: 0,
    unavailableDatasets: 0
  });
  for (const item of result.datasets) {
    assert.equal(item.status, "NO_EXACT_ENTITY_MATCH");
    assert.equal(item.matchedRecords, 0);
    assert.deepEqual(item.records, []);
    assert.equal(item.absenceIsNegative, false);
    assert.equal(item.canAffectOpportunityScore, false);
    assert.ok(item.summary && typeof item.summary === "object");
  }
  assert.equal(result.boundaries.absenceIsNegative, false);
  assert.equal(result.boundaries.exactNormalizedEntityMatchRequired, true);
});

test("an official provider failure fails open and preserves the other provider observations", async () => {
  const { result, calls } = await collectMatched({ failingDataset: "CLINICAL_TRIALS_GOV" });
  const clinical = dataset(result, "CLINICAL_TRIALS_GOV");
  assert.equal(clinical.status, "UNAVAILABLE");
  assert.equal(clinical.matchedRecords, 0);
  assert.equal(clinical.summary, null);
  assert.deepEqual(clinical.records, []);
  assert.equal(clinical.absenceIsNegative, false);
  assert.equal(clinical.canAffectOpportunityScore, false);
  assert.match(clinical.warnings[0], /HTTP 503/);

  assert.equal(result.coverage.completedDatasets, 3);
  assert.equal(result.coverage.matchedDatasets, 3);
  assert.equal(result.coverage.unavailableDatasets, 1);
  assert.equal(dataset(result, "GLEIF_LEI").status, "MATCHED");
  assert.equal(dataset(result, "NIH_REPORTER").status, "MATCHED");
  assert.equal(dataset(result, "USA_SPENDING").status, "MATCHED");
  assert.equal(calls.length, 5);
});

test("one run is entity-scoped and makes exactly the documented five official requests", async () => {
  const { result, calls } = await collectMatched();
  assert.equal(OPEN_DATA_PROVIDER_LIMITS.externalRequestsPerRun, 5);
  assert.equal(result.usage.externalRequestsUpperBound, 5);
  assert.equal(result.usage.queryIsEntityScoped, true);
  assert.equal(result.usage.credentialsRequired, false);
  assert.equal(result.usage.providerCreditsUsed, 0);
  assert.equal(calls.length, 5);
  assert.equal(calls.filter((item) => item.method === "GET").length, 2);
  assert.equal(calls.filter((item) => item.method === "POST").length, 3);

  const gleif = calls.find((item) => item.url.startsWith("https://api.gleif.org/"));
  assert.equal(new URL(gleif.url).searchParams.get("filter[entity.legalName]"), COMPANY_NAME);
  const clinical = calls.find((item) => item.url.startsWith("https://clinicaltrials.gov/"));
  assert.equal(new URL(clinical.url).searchParams.get("query.spons"), COMPANY_NAME);
  const nih = calls.find((item) => item.url.startsWith("https://api.reporter.nih.gov/"));
  assert.deepEqual(nih.body.criteria.org_names, [COMPANY_NAME]);
  const spending = calls.filter((item) => item.url.startsWith("https://api.usaspending.gov/"));
  assert.equal(spending.length, 2);
  for (const call of spending) assert.deepEqual(call.body.filters.recipient_search_text, [COMPANY_NAME]);
  assert.equal(spending.some((item) => item.body.filters.award_type_codes.includes("A")), true);
  assert.equal(spending.some((item) => item.body.filters.award_type_codes.includes("02")), true);
});

test("records retain deep provenance and the entire layer has zero scoring authority", async () => {
  const { result } = await collectMatched();
  assert.equal(result.version, OPEN_DATA_PROVIDER_VERSION);
  assert.equal(result.generatedAt, FIXED_TIME);
  assert.deepEqual(result.boundaries, {
    canAffectOpportunityScore: false,
    producesSuccessProbability: false,
    producesRevenueForecast: false,
    absenceIsNegative: false,
    exactNormalizedEntityMatchRequired: true,
    sameUnderlyingFederalAwardCountsOnce: true,
    humanReviewRequired: true
  });
  assert.match(result.interpretation, /do not change the Proofline Opportunity score/i);
  assert.equal(Object.hasOwn(result, "opportunityScore"), false);
  assert.equal(Object.hasOwn(result, "successProbability"), false);
  assert.equal(Object.hasOwn(result, "revenueForecast"), false);

  for (const item of result.datasets) {
    assert.equal(item.status, "MATCHED");
    assert.equal(item.canAffectOpportunityScore, false);
    assert.equal(item.absenceIsNegative, false);
    assert.match(item.documentationUrl, /^https:\/\//);
    assert.match(item.licenseUrl, /^https:\/\//);
    assert.ok(item.independenceFamily);
    assert.ok(item.interpretation);
    for (const record of item.records) {
      assert.equal(record.subjectType, "STARTUP");
      assert.equal(record.subjectName, COMPANY_NAME);
      assert.match(record.entityMatch.method, /EXACT/);
      assert.ok(record.entityMatch.confidence >= 0.9 && record.entityMatch.confidence <= 1);
      assert.equal(record.observedAt, FIXED_TIME);
      assert.ok(record.signalType);
      assert.ok(record.direction);
      assert.ok(record.values && typeof record.values === "object");
      assert.ok(record.interpretation.length > 40);
      assert.deepEqual(Object.keys(record.source).sort(), [
        "accessedAt", "datasetId", "publisher", "title", "url"
      ]);
      assert.equal(record.source.datasetId, item.id);
      assert.equal(record.source.publisher, item.label);
      assert.equal(record.source.accessedAt, FIXED_TIME);
      assert.match(record.source.url, /^https:\/\//);
      assert.ok(record.source.title);
    }
  }

  assert.equal(dataset(result, "NIH_REPORTER").independenceFamily, "US_FEDERAL_AWARD");
  assert.equal(dataset(result, "USA_SPENDING").independenceFamily, "US_FEDERAL_AWARD");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"opportunityScore"\s*:/i);
  assert.doesNotMatch(serialized, /"successProbability"\s*:/i);
  assert.doesNotMatch(serialized, /"revenueForecast"\s*:/i);
  assert.doesNotMatch(serialized, /"investmentRecommendation"\s*:/i);
});
