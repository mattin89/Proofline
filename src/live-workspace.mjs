import {
  buildLiveScoreInput,
  computeLiveOpportunityScore,
  computeLiveEvidenceQuality
} from "./live-domain.mjs";
import { EMOVO_DEMO_TEMPLATE, createEmovoDemoAssessment } from "./demo-data-v2.mjs";
import { calculatePolicyCheck } from "./investment-policy.mjs";
import { isAssessmentQueued, queueAssessment } from "./live-queue.mjs";
import { TRENDS_SNAPSHOT_V1 } from "./trends-snapshot-v1.mjs";
import {
  TREND_COMPANY_DISCOVERY_CATALOG,
  TREND_COMPANY_DISCOVERY_LIMITS,
  TREND_DISCOVERY_REGIONS,
  TREND_DISCOVERY_SECTORS
} from "./trend-company-discovery-v1.mjs";
import {
  appendSavedTrendObservation,
  buildSavedTrendSearchReuse,
  compareSavedTrend,
  createSavedTrendObservationSnapshot,
  projectSavedTrendWatchlist,
  removeTrendFromProfile,
  saveTrendToProfile
} from "./saved-trends-v1.mjs";
import { buildOfficialProviderSignalSnapshot } from "./open-data-signal-adapter-v1.mjs";
import { EMOVO_OPEN_DATA_SIGNAL_DEMO_V1 } from "./open-data-signals-v1.mjs";

const DEFAULT_MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_DOCUMENTS = ".pdf,.docx,.txt,.md,.html,.json,.csv";

export function createLiveWorkspaceState() {
  return {
    mode: "trends",
    loading: false,
    stage: null,
    error: null,
    discovery: null,
    trends: structuredClone(TRENDS_SNAPSHOT_V1),
    trendsFocus: TRENDS_SNAPSHOT_V1.focus,
    trendsLoading: false,
    trendsError: null,
    trendsSelectedIds: [],
    trendsRegion: "GLOBAL",
    trendsSector: "ALL",
    trendsDiscovery: null,
    trendsDiscoveryLoading: false,
    trendsDiscoveryError: null,
    trendsDiscoveryStale: false,
    savedTrendsProfile: null,
    savedTrendSelectionIds: [],
    assessments: [],
    queueEvents: [],
    queueWorkflowEvents: [],
    queueCheckApprovals: [],
    checkOutreachEvents: [],
    selectedQueueId: null,
    selectedAssessmentId: null,
    scoreMode: "PROVISIONAL",
    discoveryCrossValidateWithExa: false,
    capabilities: null,
    intake: {
      ...EMOVO_DEMO_TEMPLATE,
      allowPlanKeywordsForWebResearch: false,
      crossValidateWithExa: false
    }
  };
}

export function createDemoReadyLiveWorkspaceState() {
  const live = createLiveWorkspaceState();
  const assessment = attachEmovoOpenDataSnapshot(createEmovoDemoAssessment());
  live.assessments = [assessment];
  live.selectedAssessmentId = assessment.id;
  return live;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function assessmentPublicContacts(assessment) {
  const contacts = assessment?.publicContacts || assessment?.research?.publicContacts;
  return Array.isArray(contacts)
    ? contacts.filter((contact) => contact?.publicProfessional === true)
    : [];
}

function publicContactHref(contact) {
  const value = String(contact?.value || "").trim();
  if (contact?.channel === "BUSINESS_EMAIL" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `mailto:${value}`;
  }
  if (contact?.channel === "BUSINESS_PHONE" && /^\+?[0-9().\-\s]{7,30}$/.test(value)) {
    return `tel:${value.replace(/[^+0-9]/g, "")}`;
  }
  return safeHttpUrl(value);
}

function publicContactChannelLabel(channel) {
  return ({
    OFFICIAL_WEBSITE: "Official website",
    CONTACT_PAGE: "Contact page",
    BUSINESS_EMAIL: "Business email",
    BUSINESS_PHONE: "Business phone",
    LINKEDIN: "LinkedIn",
    PUBLIC_SOCIAL_PROFILE: "Public social profile"
  })[channel] || readable(channel || "Public channel");
}

function renderPublicContactProfiles(assessment) {
  const contacts = assessmentPublicContacts(assessment);
  const subjects = [
    { subjectType: "STARTUP", subjectName: assessment.companyName, profileLabel: "Startup profile" },
    ...(assessment.founderNames || []).map((subjectName) => ({ subjectType: "FOUNDER", subjectName, profileLabel: "Founder profile" }))
  ];
  const discovery = assessment.contactDiscovery || assessment.research?.contactDiscovery;
  return `<article class="surface public-contact-profiles">
    <div class="surface-heading"><div><p class="eyebrow">Public professional contacts</p><h2>Contact profiles</h2><p>Proofline checks the submitted links and existing bounded research for official business channels. It never guesses email addresses, returns private contact data, or bypasses login controls.</p></div>${pill(contacts.length ? `${contacts.length} channel${contacts.length === 1 ? "" : "s"}` : "Coverage unknown", contacts.length ? "positive" : "warning")}</div>
    <div class="public-contact-boundary"><strong>Verify before outreach</strong><span>Every channel keeps its source. A discovered channel can be stale or mismatched and is not permission to transfer funds.</span></div>
    <div class="public-contact-profile-grid">${subjects.map((subject) => {
      const matching = contacts.filter((contact) => contact.subjectType === subject.subjectType && contact.subjectName === subject.subjectName);
      return `<section class="public-contact-profile"><div><span>${esc(subject.profileLabel)}</span><h3>${esc(subject.subjectName)}</h3></div>${matching.length ? `<div class="public-contact-list">${matching.map((contact) => {
        const href = publicContactHref(contact);
        const sourceUrl = safeHttpUrl(contact.sourceUrl);
        const external = href?.startsWith("http") ? ' target="_blank" rel="noreferrer"' : "";
        return `<div class="public-contact-item"><div><span>${esc(publicContactChannelLabel(contact.channel))}</span><strong>${esc(contact.value)}</strong><small>${esc(readable(contact.verificationState || "UNREVIEWED_PUBLIC_SOURCE"))}</small></div><div>${href ? `<a href="${esc(href)}"${external}>Use channel</a>` : ""}${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noreferrer">Verify source ↗</a>` : ""}</div></div>`;
      }).join("")}</div>` : `<p class="public-contact-empty">No public professional channel was retained for this profile. Missing coverage is unknown—not evidence that the person is unreachable.</p>`}</section>`;
    }).join("")}</div>
    <small class="public-contact-method">${esc(discovery?.additionalProviderCalls ?? 0)} extra provider calls for contact discovery · public professional channels only</small>
  </article>`;
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date not reported";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "Capture time not reported";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function formatMoney(value, currency = "USD") {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function splitList(value) {
  return [...new Set(String(value || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function splitLinks(value) {
  return [...new Set(String(value || "").split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function pill(label, tone = "neutral") {
  return `<span class="pill pill-${tone}">${esc(label)}</span>`;
}

function readable(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function thesisText(thesis) {
  return [
    thesis.name,
    thesis.sectors?.length ? `Sectors: ${thesis.sectors.join(", ")}.` : "",
    thesis.stages?.length ? `Stages: ${thesis.stages.join(", ")}.` : "",
    thesis.geographies?.length ? `Geographies: ${thesis.geographies.join(", ")}.` : "",
    thesis.riskAppetite ? `Risk posture: ${thesis.riskAppetite}` : ""
  ].filter(Boolean).join(" ");
}

function selectedAssessment(state) {
  return state.assessments.find((item) => item.id === state.selectedAssessmentId) || state.assessments[0] || null;
}

function savedTrendWatchlist(live) {
  try {
    return live.savedTrendsProfile
      ? projectSavedTrendWatchlist(live.savedTrendsProfile)
      : { profileId: "Mario", active: [], removed: [], eventCount: 0 };
  } catch {
    return { profileId: "Mario", active: [], removed: [], eventCount: 0, invalid: true };
  }
}

const PRIMARY_AXES = Object.freeze([
  { key: "FOUNDER_EXECUTION", label: "Founder", description: "Observable founder or team execution evidence only" },
  { key: "MARKET_PROBLEM_PULL", label: "Market", description: "Problem severity, buyer urgency, timing, and incumbent pain" },
  { key: "PRODUCT_TECHNICAL_FIT", label: "Idea vs. market", description: "Technical feasibility, differentiation, validation, and research alignment" }
]);

function dimensionByKey(score, key) {
  return score.dimensions.find((item) => item.key === key) || null;
}

function axisSnapshot(score) {
  return Object.fromEntries(PRIMARY_AXES.map(({ key }) => [key, dimensionByKey(score, key)?.score ?? null]));
}

function axisTrend(assessment, scoreMode, key, currentScore) {
  const previous = assessment.previousAxisScores?.[scoreMode]?.[key];
  if (!Number.isFinite(previous) || !Number.isFinite(currentScore)) return { label: "Trend unknown · first comparable observation", tone: "neutral" };
  const delta = Math.round(currentScore - previous);
  if (delta >= 3) return { label: `↑ ${delta} since prior session observation`, tone: "positive" };
  if (delta <= -3) return { label: `↓ ${Math.abs(delta)} since prior session observation`, tone: "negative" };
  return { label: "→ Stable within 2 points", tone: "neutral" };
}

export function renderLiveWorkspace({ live, thesis, tavily, investmentPolicy }) {
  const assessment = selectedAssessment(live);
  const assessmentQueued = assessment ? isAssessmentQueued(live, assessment.id) : false;
  const watchlist = savedTrendWatchlist(live);
  return `
    <section class="page-heading live-page-heading">
      <div>
        <p class="eyebrow">Public-web venture research · thesis v${esc(thesis.version)}</p>
        <h1>Find and assess real startups</h1>
        <p>Discover recent companies or investigate a known startup from its public links and business plan. Results preserve three independent opportunity axes, source coverage, and uncertainty.</p>
      </div>
      ${pill(tavily.configured ? (tavily.exaConfigured ? "Tavily + Exa ready" : "Tavily ready") : "Research not configured", tavily.configured ? "positive" : "warning")}
    </section>

    <section class="live-policy-strip" aria-label="Live research policy">
      <div><strong>Three axes, never one opaque verdict</strong><span>Founder, Market, and Idea-vs-Market remain separate so strength on one axis cannot hide weakness on another.</span></div>
      <div><strong>Public and authorized inputs only</strong><span>Proofline does not bypass LinkedIn or social-network login controls. Do not paste credentials.</span></div>
      <div><strong>Preliminary screen only</strong><span>Unreviewed web evidence can inform provisional axes, but no result is a success probability or investment decision.</span></div>
    </section>

    <section class="live-mode-tabs" aria-label="Live research actions">
      <button class="live-mode-button ${live.mode === "trends" ? "active" : ""}" data-live-mode="trends" type="button" aria-pressed="${live.mode === "trends"}">Internet trends</button>
      <button class="live-mode-button ${live.mode === "saved-trends" ? "active" : ""}" data-live-mode="saved-trends" type="button" aria-pressed="${live.mode === "saved-trends"}">Saved trends <span>${watchlist.active.length}</span></button>
      <button class="live-mode-button ${live.mode === "discover" ? "active" : ""}" data-live-mode="discover" type="button" aria-pressed="${live.mode === "discover"}">Discover from thesis</button>
      <button class="live-mode-button ${live.mode === "investigate" ? "active" : ""}" data-live-mode="investigate" type="button" aria-pressed="${live.mode === "investigate"}">Analyze a startup</button>
      ${live.assessments.length ? `<button class="live-mode-button ${live.mode === "assessments" ? "active" : ""}" data-live-mode="assessments" type="button" aria-pressed="${live.mode === "assessments"}">Session assessments <span>${live.assessments.length}</span></button>` : ""}
    </section>

    ${live.error ? `<div class="live-error" role="alert"><strong>Research could not complete</strong><span>${esc(live.error)}</span></div>` : ""}
    ${live.loading ? renderResearchProgress(live.stage, live.capabilities) : ""}

    ${live.mode === "trends" || live.mode === "saved-trends"
      ? live.mode === "trends" ? renderTrendsDashboard(live, tavily) : renderSavedTrendsDashboard(live, tavily)
      : `<section class="discovery-layout">
          <div class="live-work-main">
            ${live.mode === "discover" ? renderDiscoveryForm(thesis, tavily, live.discovery, live.loading, live.discoveryCrossValidateWithExa) : ""}
            ${live.mode === "investigate" ? renderInvestigationForm(live, tavily) : ""}
            ${live.mode === "assessments" && assessment ? renderAssessment(assessment, live.scoreMode, investmentPolicy, assessmentQueued, live.capabilities) : ""}
          </div>
          <aside class="live-work-rail">
            ${renderSessionHistory(live)}
            ${renderResearchBoundary(live.capabilities)}
          </aside>
        </section>`}`;
}

const TREND_PILLARS = Object.freeze([
  {
    id: "INTERNET_TRENDS",
    queryKind: "CURRENT_INTERNET_TRENDS",
    title: "Current internet trends",
    kicker: "Signal radar",
    description: "Observed public signals about technology adoption, deployment, and investment attention."
  },
  {
    id: "COMPANY_CHALLENGES",
    queryKind: "COMPANY_OPERATING_CHALLENGES",
    title: "Company challenges",
    kicker: "Demand pressure",
    description: "Named operating constraints and business challenges reported by companies or institutional surveys."
  },
  {
    id: "RESEARCH_FRONTIERS",
    queryKind: "RESEARCH_FRONTIERS",
    title: "Research frontiers",
    kicker: "Technical frontier",
    description: "Current technical and academic directions; alignment does not establish product efficacy or commercial adoption."
  }
]);

const MAX_TREND_SELECTIONS = TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends;
const TREND_DISCOVERY_CREDIT_UPPER_BOUND = TREND_COMPANY_DISCOVERY_LIMITS.maxTavilySearches;
const TREND_REGION_OPTIONS = Object.freeze(TREND_DISCOVERY_REGIONS.map(({ id, label }) => ({
  value: id,
  label: id === "GLOBAL" ? "All regions / global" : label
})));
const TREND_SECTOR_OPTIONS = Object.freeze(TREND_DISCOVERY_SECTORS.map(({ id, label }) => ({ value: id, label })));

function comparableSourceUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.href.replace(/\/$/, "").toLowerCase();
}

const TREND_CATALOG_BY_SOURCE = new Map(
  TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => [comparableSourceUrl(trend.sourceUrl), trend])
);
const TREND_CATALOG_BY_ID = new Map(
  TREND_COMPANY_DISCOVERY_CATALOG.map((trend) => [trend.id, trend])
);

function trendCardsForSnapshot(evidence) {
  return evidence.map((item) => {
    const catalog = TREND_CATALOG_BY_SOURCE.get(comparableSourceUrl(item.url));
    return {
      ...item,
      evidenceId: item.id,
      trendId: catalog?.id || null,
      searchLabel: catalog?.searchLabel || null,
      keyFeatures: catalog?.keyFeatures || [],
      sectors: catalog?.sectors || [],
      regions: catalog?.regions || [],
      githubTerms: catalog?.githubTerms || [],
      signalScore: catalog?.signalScore || null
    };
  });
}

function optionLabel(options, value) {
  return options.find((item) => item.value === value)?.label || readable(value);
}

function trendPillarDefinition(item) {
  return TREND_PILLARS.find((definition) => definition.queryKind === item?.queryKind) || TREND_PILLARS[0];
}

export function classifyTrendEvidence(item) {
  const explicitSectorInput = item?.sectors || item?.discoveryMetadata?.sectors;
  const explicitRegionInput = item?.regions || item?.discoveryMetadata?.regions;
  const explicitSectors = Array.isArray(explicitSectorInput)
    ? explicitSectorInput.filter((value) => TREND_SECTOR_OPTIONS.some((option) => option.value === value))
    : [];
  const explicitRegions = Array.isArray(explicitRegionInput)
    ? explicitRegionInput.filter((value) => TREND_REGION_OPTIONS.some((option) => option.value === value))
    : [];
  if (explicitSectors.length || explicitRegions.length) {
    return {
      sectors: explicitSectors.length ? [...new Set(explicitSectors)] : ["INDUSTRIAL_TECH"],
      regions: explicitRegions.length ? [...new Set(explicitRegions)] : ["GLOBAL"],
      basis: item?.trendId ? "Server-curated frozen trend catalog" : "Server-curated source metadata"
    };
  }

  const text = `${item?.title || ""} ${item?.excerpt || ""} ${item?.sourceRole || ""}`.toLowerCase();
  const sectors = new Set();
  if (/brain[- ]computer|neural|neurotech|intracortical/.test(text)) sectors.add("NEUROTECHNOLOGY");
  if (/soft robotic|wearable|rehabilitation|medical device/.test(text)) sectors.add("WEARABLE_MEDTECH");
  if (/robot|humanoid|autonomy|automation/.test(text)) sectors.add("ROBOTICS");
  if (/data cent(?:er|re)|artificial intelligence|\bai\b|advanced-chip|compute/.test(text)) sectors.add("AI_INFRASTRUCTURE");
  if (/cyber|security|industrial.control|incident recovery/.test(text)) sectors.add("CYBERSECURITY");
  if (/grid|electricity|power system|renewable/.test(text)) sectors.add("GRID_TECH");
  if (/storage|battery|dunkelflaute/.test(text)) sectors.add("ENERGY_STORAGE");
  if (/manufactur|industrial|it\/ot/.test(text)) sectors.add("INDUSTRIAL_TECH");
  if (!sectors.size) sectors.add("INDUSTRIAL_TECH");

  const regions = new Set();
  if (/\beurope\b|\beu\b|european|managenergy/.test(text)) regions.add("EUROPE");
  if (/\bnist\b|government accountability office|\bgao\b|united states|\bu\.s\./.test(text)) regions.add("NORTH_AMERICA");
  if (!regions.size) regions.add("GLOBAL");
  return { sectors: [...sectors], regions: [...regions], basis: "UI tag derived from retained source text · unreviewed" };
}

export function trendSignalCompleteness(item) {
  const components = [
    { label: "Public source link", present: Boolean(safeHttpUrl(item?.url)) },
    { label: "Retained source excerpt", present: Boolean(String(item?.excerpt || "").trim()) },
    { label: "Reported publication date", present: Boolean(item?.publishedDate && !Number.isNaN(Date.parse(item.publishedDate))) },
    { label: "Named source role", present: Boolean(item?.sourceRole || item?.sourceType) },
    { label: "Capture provenance", present: Boolean(item?.captureMethod && item?.provider) }
  ];
  const present = components.filter((component) => component.present).length;
  return { score: present * 20, present, total: components.length, components };
}

function trendEvidenceForSection(trends, section, definition) {
  const evidence = Array.isArray(trends?.evidence) ? trends.evidence : [];
  const ids = new Set(Array.isArray(section?.evidenceIds) ? section.evidenceIds : []);
  if (ids.size) return evidence.filter((item) => ids.has(item.id));
  return evidence.filter((item) => item.queryKind === (section?.queryKind || definition.queryKind));
}

function trendDomain(item) {
  const url = safeHttpUrl(item?.url);
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function trendUsageLabel(trends) {
  const reported = trends?.usage?.reportedCredits;
  const estimated = trends?.usage?.estimatedCreditsUpperBound;
  if (Number.isFinite(reported)) return `${reported} Tavily credit${reported === 1 ? "" : "s"} reported`;
  if (Number.isFinite(estimated)) return `Up to ${estimated} Tavily credits estimated`;
  return "Provider usage not reported";
}

function normalizedTrendSelections(live, cards) {
  const validIds = new Set(cards.map((item) => item.trendId).filter(Boolean).map(String));
  return [...new Set(Array.isArray(live.trendsSelectedIds) ? live.trendsSelectedIds.map(String) : [])]
    .filter((id) => validIds.has(id))
    .slice(0, MAX_TREND_SELECTIONS);
}

function githubSignalsForTrend(discovery, trendId) {
  const signals = Array.isArray(discovery?.githubSignals) ? discovery.githubSignals : [];
  return signals.filter((signal) => {
    const ids = signal.selectedTrendIds || signal.trendIds || signal.sourceTrendIds || [];
    return Array.isArray(ids) && ids.map(String).includes(String(trendId));
  });
}

function selectedTrendIdsForRun(discovery) {
  return new Set((Array.isArray(discovery?.selectedTrends) ? discovery.selectedTrends : [])
    .map((trend) => typeof trend === "string" ? trend : trend?.id || trend?.trendId)
    .filter(Boolean)
    .map(String));
}

function githubRunState(discovery, trendId) {
  if (!discovery) return "NOT_SAMPLED";
  const selectedIds = selectedTrendIdsForRun(discovery);
  if (!selectedIds.has(String(trendId))) return "NOT_SAMPLED_IN_RUN";
  const warnings = Array.isArray(discovery.providers?.github?.warnings) ? discovery.providers.github.warnings : [];
  const warning = warnings.find((item) => String(item.trendId) === String(trendId));
  if (warning?.code === "GITHUB_INCOMPLETE_RESULTS") return "PARTIAL";
  if (warning) return "UNAVAILABLE";
  const query = (Array.isArray(discovery.queries) ? discovery.queries : []).find((item) =>
    String(item.trendId) === String(trendId) && /GITHUB/i.test(String(item.method || ""))
  );
  if (query?.incompleteResults === true) return "PARTIAL";
  if (query?.status === "UNAVAILABLE" || query?.code) return "UNAVAILABLE";
  return query?.status === "COMPLETED" ? "COMPLETED" : "UNKNOWN";
}

function finiteMetric(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) ?? null;
}

function compactNumber(value) {
  if (value === null || value === undefined || value === "") return "Not reported";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not reported";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function sourceAgeLabel(item, capturedAt) {
  const published = Date.parse(item?.publishedDate || "");
  const captured = Date.parse(capturedAt || "");
  if (Number.isNaN(published) || Number.isNaN(captured)) return "Date not reported";
  const days = Math.max(0, Math.round((captured - published) / 86_400_000));
  return days === 0 ? "Published near capture" : `${days} day${days === 1 ? "" : "s"} before capture`;
}

function trendFreshnessMetric(item, capturedAt) {
  const published = Date.parse(item?.publishedDate || "");
  const captured = Date.parse(capturedAt || "");
  if (Number.isNaN(published) || Number.isNaN(captured) || published > captured) return null;
  const ageDays = (captured - published) / 86_400_000;
  if (ageDays <= 180) return 100;
  if (ageDays <= 365) return 80;
  if (ageDays <= 730) return 60;
  return 35;
}

function observationTrendFor(live, trendId) {
  const catalog = TREND_CATALOG_BY_ID.get(String(trendId));
  if (!catalog) return null;
  const current = trendCardsForSnapshot(Array.isArray(live.trends?.evidence) ? live.trends.evidence : [])
    .find((item) => String(item.trendId) === String(trendId));
  const sourceUrl = safeHttpUrl(current?.url) || catalog.sourceUrl;
  const verificationStatus = ["UNREVIEWED", "REVIEWED", "VERIFIED"].includes(String(current?.verificationStatus || "").toUpperCase())
    ? String(current.verificationStatus).toUpperCase()
    : "UNREVIEWED";
  return {
    ...catalog,
    evidenceId: String(current?.evidenceId || current?.id || catalog.evidenceId),
    title: String(current?.title || catalog.title),
    summary: String(current?.excerpt || catalog.summary),
    sourceUrl,
    sourceHost: new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, ""),
    sourceRole: String(current?.sourceRole || catalog.sourceRole),
    publishedDate: current?.publishedDate && !Number.isNaN(Date.parse(current.publishedDate)) ? current.publishedDate : catalog.publishedDate,
    queryKind: String(current?.queryKind || catalog.queryKind),
    verificationStatus
  };
}

function savedTrendObservationSnapshot(live, trendId, { capturedAt, includeDiscovery = false } = {}) {
  const trend = observationTrendFor(live, trendId);
  if (!trend) return null;
  const timestamp = new Date(capturedAt || live.trends?.generatedAt || Date.now()).toISOString();
  const discovery = includeDiscovery ? live.trendsDiscovery : null;
  const sampled = Boolean(discovery && selectedTrendIdsForRun(discovery).has(String(trendId)));
  const repositories = sampled ? githubSignalsForTrend(discovery, trendId) : [];
  const githubState = sampled ? githubRunState(discovery, trendId) : "NOT_SAMPLED";
  const githubObserved = githubState === "COMPLETED" || (githubState === "PARTIAL" && repositories.length > 0);
  const stars = repositories.map((item) => finiteMetric(item.popularity?.stars, item.stars, item.stargazersCount));
  const forks = repositories.map((item) => finiteMetric(item.popularity?.forks, item.forks, item.forksCount));
  const allStarsReported = sampled && stars.every((value) => value !== null);
  const allForksReported = sampled && forks.every((value) => value !== null);
  const candidates = sampled
    ? (Array.isArray(discovery?.candidates) ? discovery.candidates : []).filter((item) =>
      Array.isArray(item.selectedTrendIds) && item.selectedTrendIds.map(String).includes(String(trendId))
    )
    : [];
  const provider = includeDiscovery
    ? `${live.trends?.provider || "Trend snapshot"} + ${providerLabel(discovery?.providers)}`.slice(0, 100)
    : String(live.trends?.provider || "Trend snapshot").slice(0, 100);
  return createSavedTrendObservationSnapshot({
    snapshotId: `SAVED-${String(trendId).replace(/[^A-Za-z0-9-]/g, "-")}-${timestamp.replace(/[^0-9]/g, "")}`.slice(0, 200),
    capturedAt: timestamp,
    provider,
    trend,
    metrics: {
      sourceFreshness: trendFreshnessMetric(trend, timestamp),
      githubRepositoryCount: githubObserved ? repositories.length : null,
      githubStars: githubObserved && allStarsReported ? stars.reduce((sum, value) => sum + Number(value), 0) : null,
      githubForks: githubObserved && allForksReported ? forks.reduce((sum, value) => sum + Number(value), 0) : null,
      companySignalCount: sampled ? candidates.length : null
    }
  });
}

function captureSavedTrendObservations(live, persistSavedTrendsProfile, { capturedAt, includeDiscovery = false } = {}) {
  if (!live.savedTrendsProfile) return 0;
  const watchlist = savedTrendWatchlist(live);
  let profile = live.savedTrendsProfile;
  let appended = 0;
  for (const watch of watchlist.active) {
    try {
      const snapshot = savedTrendObservationSnapshot(live, watch.trendId, { capturedAt, includeDiscovery });
      if (!snapshot) continue;
      const eventTime = new Date(Math.max(Date.now(), Date.parse(profile.updatedAt), Date.parse(snapshot.capturedAt))).toISOString();
      const next = appendSavedTrendObservation(profile, {
        trendId: watch.trendId,
        actor: "PROOFLINE_CURRENT_DATA_CAPTURE",
        occurredAt: eventTime,
        currentSnapshot: snapshot
      });
      if (next !== profile) appended += 1;
      profile = next;
    } catch {
      // Saving a trend does not invent a later point from an older/equal snapshot.
    }
  }
  if (profile !== live.savedTrendsProfile) {
    live.savedTrendsProfile = profile;
    persistSavedTrendsProfile?.(profile);
  }
  return appended;
}

function renderTrendSignalCard(item, { selectedIds, atLimit, capturedAt, discovery, savedIds = new Set() }) {
  const url = safeHttpUrl(item?.url);
  const domain = trendDomain(item) || "Source host not reported";
  const title = String(item?.title || "").trim() || "Untitled public source";
  const excerpt = String(item?.excerpt || "").trim() || "No excerpt was retained in this snapshot.";
  const stableTrendId = item.trendId;
  const selected = stableTrendId ? selectedIds.includes(String(stableTrendId)) : false;
  const saved = stableTrendId ? savedIds.has(String(stableTrendId)) : false;
  const disabled = !stableTrendId || (atLimit && !selected);
  const taxonomy = classifyTrendEvidence(item);
  const completeness = trendSignalCompleteness(item);
  const signal = item.signalScore || {
    value: completeness.score,
    label: "Metadata coverage only",
    components: null,
    formula: "20 points each for a safe public link, retained excerpt, publication date, source role, and capture provenance",
    purpose: "Source metadata completeness only"
  };
  const pillar = trendPillarDefinition(item);
  const githubSignals = stableTrendId ? githubSignalsForTrend(discovery, stableTrendId) : [];
  const githubState = stableTrendId ? githubRunState(discovery, stableTrendId) : "NOT_SAMPLED";
  const githubStarValues = githubSignals.map((repository) => finiteMetric(repository.popularity?.stars, repository.stars, repository.stargazersCount));
  const reportedGithubStars = githubStarValues.filter((value) => value !== null);
  const githubStars = reportedGithubStars.reduce((sum, value) => sum + Number(value), 0);
  const githubPopularityLabel = !githubSignals.length ? ""
    : !reportedGithubStars.length ? "stars not reported"
      : reportedGithubStars.length < githubSignals.length ? `${compactNumber(githubStars)} known stars · partial metadata`
        : `${compactNumber(githubStars)} stars`;
  const githubLabel = githubSignals.length
    ? `${githubSignals.length} linked repo${githubSignals.length === 1 ? "" : "s"} · ${githubPopularityLabel}${githubState === "PARTIAL" ? " · partial coverage" : ""}`
    : githubState === "UNAVAILABLE" ? "Lookup unavailable · no negative signal"
      : githubState === "PARTIAL" ? "Partial coverage · no absence inference"
        : githubState === "COMPLETED" ? "Completed lookup · 0 retained"
          : githubState === "NOT_SAMPLED_IN_RUN" ? "Not sampled in this run"
            : "Not sampled yet";
  const inputId = `trend-select-${String(stableTrendId || item.evidenceId || item.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return `<article class="trend-signal-card ${selected ? "is-selected" : ""} ${stableTrendId ? "" : "is-unavailable"}" data-trend-id="${esc(stableTrendId || "")}" data-source-evidence-id="${esc(item.evidenceId || item.id)}">
    <header class="trend-signal-head">
      <div class="trend-select-control">
        <input id="${esc(inputId)}" type="checkbox" name="selectedTrendIds" value="${esc(stableTrendId || "")}" data-trend-select ${selected ? "checked" : ""} ${disabled ? "disabled" : ""} />
        <label for="${esc(inputId)}">${selected ? "Selected for company search" : !stableTrendId ? "Source is not in the stable search catalog" : disabled ? "Selection limit reached" : "Use in company search"}</label>
      </div>
      <div class="trend-card-profile-actions"><button class="button button-small" type="button" data-save-trend="${esc(stableTrendId || "")}" ${!stableTrendId || saved ? "disabled" : ""}>${saved ? "Saved in profile" : "Save trend"}</button><span class="trend-track-label">${esc(pillar.kicker)}</span></div>
    </header>
    <div class="trend-card-title-row">
      <div><span class="trend-domain">${esc(domain)}</span><h3>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} <span aria-hidden="true">↗</span><span class="sr-only"> (opens source in a new tab)</span></a>` : esc(title)}</h3></div>
      <div class="trend-card-score" aria-label="Trend prioritization signal ${signal.value} out of 100; not an investment score"><strong>${signal.value}</strong><span>/100</span><small>trend signal · non-investment</small></div>
    </div>
    <div class="trend-score-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${signal.value}" aria-label="Trend prioritization signal; not an investment score"><span style="width:${signal.value}%"></span></div>
    <p class="trend-excerpt">${esc(excerpt)}</p>
    ${item.keyFeatures?.length ? `<div class="trend-feature-list" aria-label="Features used by company discovery">${item.keyFeatures.map((feature) => `<span>${esc(feature)}</span>`).join("")}</div>` : ""}
    <dl class="trend-signal-values">
      <div><dt>Published</dt><dd>${esc(formatDate(item?.publishedDate))}</dd></div>
      <div><dt>Freshness</dt><dd>${esc(sourceAgeLabel(item, capturedAt))}</dd></div>
      <div><dt>GitHub indicator</dt><dd>${esc(githubLabel)}</dd></div>
      <div><dt>Capture</dt><dd>${esc(readable(item?.captureMethod || "public source"))}</dd></div>
    </dl>
    <details class="trend-score-method"><summary>Why this signal is ${esc(signal.value)}/100</summary><p>${esc(signal.formula)}. Purpose: ${esc(signal.purpose)}. This ranking cannot affect a startup score.</p>${signal.components ? `<dl><div><dt>Source authority</dt><dd>${esc(signal.components.sourceAuthority)}/100</dd></div><div><dt>Freshness</dt><dd>${esc(signal.components.freshness)}/100</dd></div><div><dt>Editorial commercialization relevance</dt><dd>${esc(signal.components.commercializationRelevance)}/100</dd></div></dl>` : `<small>${completeness.present} of ${completeness.total} source metadata fields are present.</small>`}</details>
    <div class="trend-taxonomy"><span>${taxonomy.regions.map((value) => esc(optionLabel(TREND_REGION_OPTIONS, value))).join(" · ")}</span><span>${taxonomy.sectors.map((value) => esc(optionLabel(TREND_SECTOR_OPTIONS, value))).join(" · ")}</span></div>
    <footer class="trend-card-foot"><span>${esc(readable(item?.sourceRole || item?.sourceType || "unclassified source"))}</span><span>Curated summary · ${esc(readable(item?.verificationStatus || "unreviewed"))}</span></footer>
  </article>`;
}

function trendDiscoveryCreditBound(live) {
  const candidates = [
    live.capabilities?.trendDiscovery?.tavilyCreditsUpperBound,
    live.capabilities?.guards?.maxTrendDiscoveryTavilyCredits,
    live.capabilities?.limits?.trendDiscoveryCreditsUpperBound,
    live.capabilities?.costs?.trendDiscovery?.estimatedCreditsUpperBound
  ];
  return Number(candidates.find((value) => Number.isFinite(Number(value))) ?? TREND_DISCOVERY_CREDIT_UPPER_BOUND);
}

function githubSignalName(signal) {
  return signal.fullName || signal.repositoryFullName || signal.repoFullName || signal.name ||
    [signal.owner, signal.repository].filter(Boolean).join("/") || "Repository name not reported";
}

function githubSignalUrl(signal) {
  return safeHttpUrl(signal.htmlUrl || signal.repositoryUrl || signal.url);
}

function renderGithubSignal(signal) {
  const url = githubSignalUrl(signal);
  const stars = finiteMetric(signal.popularity?.stars, signal.stars, signal.stargazersCount);
  const forks = finiteMetric(signal.popularity?.forks, signal.forks, signal.forksCount);
  const subscribers = finiteMetric(signal.popularity?.subscribers, signal.subscribers);
  const issues = finiteMetric(signal.popularity?.openIssues, signal.openIssues, signal.openIssuesCount);
  const owner = signal.owner?.login || signal.ownerLogin || signal.builderHandle || "Owner not reported";
  const accountType = signal.owner?.accountType || "Account type not reported";
  const founderRelationship = signal.owner?.founderOrStartupStatus === "NOT_ESTABLISHED" || !signal.owner?.founderOrStartupStatus
    ? "Founder/company relationship not established"
    : readable(signal.owner.founderOrStartupStatus);
  const rank = finiteMetric(signal.popularity?.rankWithinTrendQuery, signal.rank);
  const recent = signal.activity?.recentlyCreatedProject === true || signal.activity?.recentlyActiveProject === true || signal.recentProject === true || signal.recentActivity === true;
  const createdAt = signal.activity?.createdAt || signal.createdAt;
  const pushedAt = signal.activity?.pushedAt || signal.pushedAt;
  return `<article class="github-signal-card">
    <div class="github-signal-heading"><div><span>GitHub repository${rank ? ` · retrieval rank ${esc(rank)}` : ""}</span><h4>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(githubSignalName(signal))} ↗</a>` : esc(githubSignalName(signal))}</h4></div>${recent ? pill("Recent public activity", "positive") : pill("Activity date unclassified", "neutral")}</div>
    <dl><div><dt>Stars</dt><dd>${esc(compactNumber(stars))}</dd></div><div><dt>Forks</dt><dd>${esc(compactNumber(forks))}</dd></div>${subscribers === null ? "" : `<div><dt>Subscribers</dt><dd>${esc(compactNumber(subscribers))}</dd></div>`}<div><dt>Open issues</dt><dd>${esc(compactNumber(issues))}</dd></div></dl>
    <div class="github-signal-foot"><span>Repository owner: ${esc(owner)} · ${esc(accountType)}</span><span>${esc(founderRelationship)}</span><span>Created ${esc(formatDate(createdAt))} · pushed ${esc(formatDate(pushedAt))}</span></div>
  </article>`;
}

function candidateEvidence(candidate, evidence) {
  const ids = candidate.sourceEvidenceIds || candidate.evidenceIds || [];
  const idSet = new Set(Array.isArray(ids) ? ids.map(String) : []);
  return evidence.filter((item) => idSet.has(String(item.id)));
}

function renderTrendCandidate(candidate, evidence) {
  const website = safeHttpUrl(candidate.website);
  const sources = candidateEvidence(candidate, evidence);
  const contacts = Array.isArray(candidate.publicContacts)
    ? candidate.publicContacts.filter((contact) => contact?.publicProfessional === true)
    : [];
  const canInvestigate = Boolean(candidate?.id && (String(candidate.companyName || "").trim() || website));
  return `<article class="candidate-card trend-candidate-card">
    <div class="candidate-head"><div><span class="candidate-origin">${esc(readable(candidate.discoveryMethod || "trend grounded discovery"))}</span><h3>${esc(candidate.companyName || "Unresolved candidate")}</h3></div>${pill("Unreviewed", "warning")}</div>
    <p>${esc(candidate.reason || "The provider returned a candidate without a retained explanatory excerpt.")}</p>
    <dl class="candidate-meta"><div><dt>Founder signal</dt><dd>${candidate.founderNames?.length ? esc(candidate.founderNames.join(", ")) : "Not resolved"}</dd></div><div><dt>Linked sources</dt><dd>${sources.length}</dd></div><div><dt>Public contacts</dt><dd>${contacts.length ? `${esc(contacts.length)} sourced route${contacts.length === 1 ? "" : "s"}` : "Not found · coverage unknown"}</dd></div></dl>
    ${contacts.length ? `<div class="candidate-contact-signals">${contacts.slice(0, 3).map((contact) => `<span><strong>${esc(contact.subjectName)}</strong>${esc(publicContactChannelLabel(contact.channel))}</span>`).join("")}</div>` : ""}
    <div class="trend-candidate-sources">${sources.length ? sources.map((source) => {
      const url = safeHttpUrl(source.url);
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || trendDomain(source) || "Public source")} ↗</a>` : `<span>${esc(source.title || "Source URL unavailable")}</span>`;
    }).join("") : `<span>Candidate-level source links were not mapped in this response.</span>`}</div>
    <div class="candidate-actions">${website ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer">Open candidate website ↗</a>` : `<span>Website not confirmed</span>`}<button class="button button-small" data-live-candidate="${esc(candidate.id || "")}" type="button" ${canInvestigate ? "" : "disabled"}>Investigate &amp; score</button></div>
  </article>`;
}

function providerLabel(providers) {
  if (!providers) return "Provider not reported";
  if (typeof providers === "string") return providers;
  if (Array.isArray(providers)) return providers.filter(Boolean).join(" + ") || "Provider not reported";
  const methodLabel = (provider, method) => {
    const providerToken = provider.toLowerCase().replace(/[^a-z]/g, "");
    const words = String(method || "").split(/[_\s-]+/).filter(Boolean).filter((word) => word.toLowerCase().replace(/[^a-z]/g, "") !== providerToken);
    const label = words.map((word) => word.toUpperCase() === "API" ? "API" : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ");
    return label ? `${provider} ${label}` : provider;
  };
  return [...new Set([
    providers.primary,
    providers.tavily?.method ? methodLabel("Tavily", providers.tavily.method) : null,
    providers.github?.method ? methodLabel("GitHub", providers.github.method) : providers.github,
    providers.optionalCrossValidation
  ].filter((value) => typeof value === "string" && value))].join(" + ") || "Provider not reported";
}

function trendDiscoveryUsageLabel(usage) {
  const coverage = String(usage?.reportedCreditCoverage || "").trim();
  const coverageMatch = coverage.match(/^(\d+)\/(\d+)/);
  const coverageComplete = coverageMatch && coverageMatch[1] === coverageMatch[2];
  const reported = Number.isFinite(usage?.reportedCredits) ? usage.reportedCredits : null;
  const observed = Number.isFinite(usage?.reportedCreditsObserved)
    ? usage.reportedCreditsObserved
    : Number.isFinite(usage?.partiallyReportedCredits) ? usage.partiallyReportedCredits : null;
  const upperBound = Number.isFinite(usage?.estimatedCreditsUpperBound) ? usage.estimatedCreditsUpperBound : null;
  if (reported !== null && (coverageComplete || !coverageMatch)) {
    return `${reported} reported${coverage ? ` (${coverage})` : ""}${upperBound !== null ? ` · planned upper bound ${upperBound}` : ""}`;
  }
  if (observed !== null || reported !== null) {
    return `${observed ?? reported} reported${coverage ? ` (${coverage})` : " · partial coverage"}${upperBound !== null ? ` · planned upper bound ${upperBound}` : ""}`;
  }
  return `Provider usage not fully reported${coverage ? ` (${coverage})` : ""}${upperBound !== null ? ` · planned upper bound ${upperBound}` : ""}`;
}

function githubCoverageSummary(discovery) {
  const github = discovery?.providers?.github || {};
  const warnings = Array.isArray(github.warnings) ? github.warnings : [];
  const resultCoverage = Array.isArray(github.resultCoverage) ? github.resultCoverage : [];
  const incomplete = warnings.some((warning) => warning.code === "GITHUB_INCOMPLETE_RESULTS") || resultCoverage.some((item) => item.incompleteResults === true);
  const unavailableWarnings = warnings.filter((warning) => warning.code !== "GITHUB_INCOMPLETE_RESULTS");
  const attempted = Number(discovery?.usage?.githubApiRequests || 0);
  const completed = Number(discovery?.usage?.githubApiRequestsCompleted ?? attempted);
  const unavailable = unavailableWarnings.length > 0 || completed < attempted;
  return { warnings, resultCoverage, incomplete, unavailable, unavailableWarnings, attempted, completed };
}

function renderGithubCoverageNotice(discovery) {
  const coverage = githubCoverageSummary(discovery);
  if (!coverage.warnings.length && !coverage.incomplete && !coverage.unavailable) return "";
  const heading = coverage.unavailable
    ? "GitHub lookup unavailable for part or all of this run"
    : "GitHub repository coverage is partial";
  const explanation = coverage.unavailable
    ? `${coverage.completed} of ${coverage.attempted} planned GitHub requests completed. Missing repository signals are unknown coverage—not a negative or empty-market signal.`
    : "GitHub marked at least one result set incomplete. Retained repositories are examples from partial coverage, not a comparative ranking of the full ecosystem.";
  return `<aside class="github-coverage-notice ${coverage.unavailable ? "is-unavailable" : "is-partial"}" role="status">
    <div><strong>${esc(heading)}</strong><span>${esc(explanation)}</span></div>
    ${coverage.warnings.length ? `<ul>${coverage.warnings.map((warning) => `<li><strong>${esc(warning.code || "GITHUB_COVERAGE_WARNING")}</strong><span>${esc(warning.message || "GitHub coverage warning; no negative signal is inferred.")}</span>${warning.trendId ? `<small>${esc(warning.trendId)}</small>` : ""}</li>`).join("")}</ul>` : ""}
    ${coverage.resultCoverage.length ? `<div class="github-coverage-rows">${coverage.resultCoverage.map((item) => `<span><strong>${esc(item.trendId || "Trend not reported")}</strong> · ${Number.isFinite(item.totalCount) ? `${esc(item.totalCount)} reported repository matches` : "match total not reported"} · ${item.incompleteResults === true ? "partial result set" : "completed result set"}</span>`).join("")}</div>` : ""}
  </aside>`;
}

function renderExecutedTrendBrief(discovery) {
  const selectedTrends = Array.isArray(discovery?.selectedTrends) ? discovery.selectedTrends : [];
  const region = discovery?.filters?.region?.label || discovery?.filters?.region?.id || discovery?.filters?.region || "Region not reported";
  const sector = discovery?.filters?.sector?.label || discovery?.filters?.sector?.id || discovery?.filters?.sector || "Sector not reported";
  return `<section class="trend-executed-brief" aria-label="Executed trend search brief">
    <div><span>Executed region</span><strong>${esc(region)}</strong><small>Tavily company discovery only; not GitHub geography.</small></div>
    <div><span>Executed sector</span><strong>${esc(sector)}</strong></div>
    <div class="trend-executed-anchors"><span>Selected frozen anchors</span>${selectedTrends.length ? `<div>${selectedTrends.map((trend) => {
      const value = typeof trend === "string" ? { id: trend } : trend;
      const url = safeHttpUrl(value.sourceUrl);
      const label = value.searchLabel || value.title || value.id || "Trend not reported";
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : `<strong>${esc(label)}</strong>`;
    }).join("")}</div>` : `<strong>Selected anchors not reported</strong>`}</div>
  </section>`;
}

function renderTrendDiscoveryResults(discovery, { stale = false } = {}) {
  const candidates = Array.isArray(discovery?.candidates) ? discovery.candidates : [];
  const githubSignals = Array.isArray(discovery?.githubSignals) ? discovery.githubSignals : [];
  const evidence = Array.isArray(discovery?.evidence) ? discovery.evidence : [];
  const usage = discovery?.usage || {};
  const githubRequests = usage.githubApiRequests ?? usage.githubApiRequestsUpperBound ?? "Not reported";
  const tavilySourceCount = discovery.tavilySourceCount ?? evidence.filter((item) => item.provider !== "GitHub").length;
  const githubCoverage = githubCoverageSummary(discovery);
  const githubEmptyCopy = githubCoverage.unavailable
    ? ["GitHub lookup unavailable", "Repository coverage failed for part or all of this run. Absence is not evidence, and no negative signal is recorded."]
    : githubCoverage.incomplete
      ? ["No repository signal shown under partial coverage", "GitHub marked the result set incomplete. Zero retained signals cannot be interpreted as an ecosystem absence."]
      : ["Completed GitHub lookup retained zero repository signals", "This bounded query result is not evidence that no relevant repositories, builders, or companies exist."];
  return `<section class="trend-discovery-results" aria-labelledby="trend-company-results-title">
    <article class="surface trend-results-summary">
      <div><p class="eyebrow">Trend-grounded discovery · ${esc(formatDateTime(discovery.generatedAt))}${stale ? " · Previous run—inputs changed" : ""}</p><h2 id="trend-company-results-title">${candidates.length} company signal${candidates.length === 1 ? "" : "s"} · ${githubSignals.length} GitHub project signal${githubSignals.length === 1 ? "" : "s"}</h2><p>Every result remains unreviewed. Candidate and repository popularity indicators require entity investigation before any Proofline score.</p></div>
      <dl><div><dt>Tavily usage</dt><dd>${esc(trendDiscoveryUsageLabel(usage))}</dd></div><div><dt>GitHub API</dt><dd>${esc(githubRequests)} request${githubRequests === 1 ? "" : "s"}</dd></div><div><dt>Provider</dt><dd>${esc(providerLabel(discovery.providers))}</dd></div><div><dt>Public sources retained</dt><dd>${esc(tavilySourceCount)}</dd></div></dl>
    </article>
    ${renderExecutedTrendBrief(discovery)}
    ${candidates.length ? `<div class="candidate-grid trend-candidate-grid">${candidates.map((candidate) => renderTrendCandidate(candidate, evidence)).join("")}</div>` : `<div class="surface trend-results-empty"><strong>No defensible company candidates were retained</strong><span>This is a coverage result, not evidence that the selected problem has no startups.</span></div>`}
    <section class="surface github-signal-section" aria-labelledby="github-signal-title">
      <div class="surface-heading"><div><p class="eyebrow">Open-source builder radar</p><h2 id="github-signal-title">Observable GitHub project popularity</h2><p>Stars, forks, actual subscribers when available, creation dates, and recent public activity help surface emerging builders. They do not measure founder quality or establish a company relationship.</p></div>${pill(`${discovery.githubRepositoryCount ?? githubSignals.length} retained`, "neutral")}</div>
      ${renderGithubCoverageNotice(discovery)}
      ${githubSignals.length ? `<div class="github-signal-grid">${githubSignals.map(renderGithubSignal).join("")}</div>` : `<div class="github-not-sampled"><strong>${esc(githubEmptyCopy[0])}</strong><span>${esc(githubEmptyCopy[1])}</span></div>`}
      <div class="github-age-boundary"><strong>Emerging builder means recent observable project activity—not biological age.</strong><span>Proofline does not infer age, protected traits, founder identity, or investment potential from a GitHub handle.</span></div>
    </section>
    ${evidence.length ? `<section class="surface trend-result-provenance"><div class="surface-heading"><div><p class="eyebrow">Search provenance</p><h2>Sources retained by company discovery</h2></div><span>${evidence.length} source${evidence.length === 1 ? "" : "s"}</span></div><div>${evidence.map((item) => {
      const url = safeHttpUrl(item.url);
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || trendDomain(item) || "Public source")} ↗</a>` : `<span>${esc(item.title || "Source URL unavailable")}</span>`;
    }).join("")}</div></section>` : ""}
  </section>`;
}

export function renderTrendsDashboard(live, tavily) {
  const trends = live.trends;
  const evidence = Array.isArray(trends?.evidence) ? trends.evidence : [];
  const trendCards = trendCardsForSnapshot(evidence);
  const domains = new Set(evidence.map(trendDomain).filter(Boolean));
  const selectedIds = normalizedTrendSelections(live, trendCards);
  const region = TREND_REGION_OPTIONS.some((item) => item.value === live.trendsRegion) ? live.trendsRegion : "GLOBAL";
  const sector = TREND_SECTOR_OPTIONS.some((item) => item.value === live.trendsSector) ? live.trendsSector : "ALL";
  const visibleEvidence = trendCards.filter((item) => {
    const taxonomy = classifyTrendEvidence(item);
    return (region === "GLOBAL" || taxonomy.regions.includes(region) || taxonomy.regions.includes("GLOBAL")) && (sector === "ALL" || taxonomy.sectors.includes(sector));
  });
  const focus = live.trendsFocus || trends?.focus || "AI, medical technology, robotics, advanced materials, climate technology, and space";
  const capturedAt = trends?.generatedAt || trends?.capturedAt;
  const provider = trends?.provider || "No provider run loaded";
  const refreshCredits = Number.isFinite(trends?.refreshCostUpperBound) ? trends.refreshCostUpperBound : 3;
  const discoveryCredits = trendDiscoveryCreditBound(live);
  const selectedCreditBound = Math.min(discoveryCredits, selectedIds.length);
  const scoredTrendCards = trendCards.filter((item) => item.signalScore);
  const signalAverage = scoredTrendCards.length
    ? Math.round(scoredTrendCards.reduce((sum, item) => sum + item.signalScore.value, 0) / scoredTrendCards.length)
    : 0;
  const githubSignals = Array.isArray(live.trendsDiscovery?.githubSignals) ? live.trendsDiscovery.githubSignals : [];
  const watchlist = savedTrendWatchlist(live);
  const savedIds = new Set(watchlist.active.map((item) => String(item.trendId)));

  return `<section class="trends-dashboard" aria-labelledby="trends-dashboard-title">
    <article class="surface trends-command">
      <div class="trends-command-copy">
        <p class="eyebrow">Trend-to-company radar · real public sources</p>
        <h2 id="trends-dashboard-title">Select evidence signals, then find the builders responding to them</h2>
        <p>Filter the frozen Tavily snapshot, select up to four signals, and run one bounded company-and-GitHub discovery. Attention, operator pain, and research remain separate from startup validation.</p>
      </div>
      <form class="trends-refresh-form" id="trends-refresh-form">
        <div class="trend-fixed-scope"><span>Radar scope</span><strong>${esc(focus)}</strong></div><input type="hidden" name="focus" value="${esc(focus)}" />
        <small id="trends-focus-help">A refresh re-extracts nine fixed authoritative anchors in three bounded Tavily batches. Opening this tab never spends credits.</small>
        <button class="button button-primary" type="submit" ${!tavily.configured || live.trendsLoading ? "disabled" : ""}>${live.trendsLoading ? "Refreshing three tracks…" : `Refresh with Tavily · ≈${esc(refreshCredits)} credits`}</button>
      </form>
    </article>

    ${live.trendsError ? `<div class="live-error trends-refresh-error" role="alert"><strong>Trend refresh could not complete</strong><span>${esc(live.trendsError)}${trends ? " The previous captured snapshot remains visible below." : ""}</span></div>` : ""}

    ${trends ? `<section class="trend-kpi-grid" aria-label="Trend snapshot indicators">
      <article><span>Retained signals</span><strong>${evidence.length}</strong><small>${domains.size} distinct public hosts</small></article>
      <article><span>Selected search inputs</span><strong>${selectedIds.length}<small> / ${MAX_TREND_SELECTIONS}</small></strong><small>${selectedIds.length ? "Server resolves frozen IDs" : "Choose one or more cards"}</small></article>
      <article><span>Trend signal average</span><strong>${signalAverage}<small> / 100</small></strong><small>Prioritization only · non-investment</small></article>
      <article><span>GitHub repositories</span><strong>${live.trendsDiscovery ? githubSignals.length : "—"}</strong><small>${live.trendsDiscovery ? "Retained after public API lookup" : "Not sampled until search"}</small></article>
      <article><span>Saved in profile</span><strong>${watchlist.active.length}</strong><small>${watchlist.active.reduce((sum, item) => sum + item.observationCount, 0)} later observation${watchlist.active.reduce((sum, item) => sum + item.observationCount, 0) === 1 ? "" : "s"} retained</small></article>
      <article><span>Captured</span><strong class="trend-kpi-date">${esc(formatDate(capturedAt))}</strong><small>${esc(provider)} · ${esc(trendUsageLabel(trends))}</small></article>
    </section>` : ""}

    <aside class="trend-boundary" aria-label="Trend data boundary">
      <div aria-hidden="true">i</div>
      <p><strong>Unreviewed signal layer—no score for a startup.</strong> A card's 0–100 prioritization signal is transparently calculated from 40% source authority, 25% publication freshness, and 35% editorial commercialization relevance. Open each formula before relying on it. It does not measure company quality, predict success or revenue, establish research efficacy, or approve an investment.</p>
    </aside>

    ${trends
      ? `<form id="trend-discovery-form" class="trend-selection-workspace">
          <section class="surface trend-filter-bar" aria-label="Trend filters">
            <div><p class="eyebrow">Signal filters</p><h2>Build a grounded search brief</h2><p>Filters change visible cards and are sent with the selected frozen IDs. They never alter the evidence snapshot.</p></div>
            <label class="field"><span>Target company region</span><select id="trend-region-filter" name="region">${TREND_REGION_OPTIONS.map((option) => `<option value="${esc(option.value)}" ${option.value === region ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select><small>Applies to Tavily company discovery; GitHub repository search has no reliable geography qualifier.</small></label>
            <label class="field"><span>Sector</span><select id="trend-sector-filter" name="sector">${TREND_SECTOR_OPTIONS.map((option) => `<option value="${esc(option.value)}" ${option.value === sector ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label>
            <div class="trend-visible-count"><strong>${visibleEvidence.length}</strong><span>of ${evidence.length} signals visible</span></div>
          </section>
          ${selectedIds.some((id) => !visibleEvidence.some((item) => String(item.trendId) === id)) ? `<div class="trend-hidden-selection" role="status"><strong>${selectedIds.filter((id) => !visibleEvidence.some((item) => String(item.trendId) === id)).length} selected signal${selectedIds.filter((id) => !visibleEvidence.some((item) => String(item.trendId) === id)).length === 1 ? " is" : "s are"} hidden by the filters.</strong><span>They remain selected until you change filters and deselect them; the search CTA always shows the total.</span></div>` : ""}
          ${visibleEvidence.length ? `<div class="trend-signal-grid">${visibleEvidence.map((item) => renderTrendSignalCard(item, { selectedIds, atLimit: selectedIds.length >= MAX_TREND_SELECTIONS, capturedAt, discovery: live.trendsDiscovery, savedIds })).join("")}</div>` : `<div class="surface trend-filter-empty"><strong>No captured signals match this filter</strong><span>Try another region or sector. Missing coverage is not evidence that the market has no activity.</span></div>`}
          <aside class="github-preflight" aria-label="GitHub popularity indicator boundary"><div><strong>GitHub popularity is sampled only after you search.</strong><span>Proofline can retain public stars, forks, actual subscribers when available, repository age, and recent activity. Before a run, every card correctly shows “Not sampled yet.”</span></div><div><strong>Emerging builders, not inferred young people.</strong><span>The radar uses recent public project activity and never infers biological age or founder quality from a profile.</span></div></aside>
          <div class="surface trend-search-dock">
            <div><span>${selectedIds.length} of ${MAX_TREND_SELECTIONS} signals selected</span><strong>${selectedIds.length ? `${esc(optionLabel(TREND_REGION_OPTIONS, region))} · ${esc(optionLabel(TREND_SECTOR_OPTIONS, sector))}` : "Select at least one evidence signal"}</strong><small>The server uses every selected signal's frozen features and primary link. ${selectedIds.length ? `Estimated upper bound: ${esc(selectedCreditBound)} Tavily credit${selectedCreditBound === 1 ? "" : "s"}—one bounded search per selection.` : `Select up to ${MAX_TREND_SELECTIONS}; the global cap is ${esc(discoveryCredits)} Tavily credits.`} GitHub API requests are reported separately.</small></div>
            <button class="button button-primary" type="submit" ${!tavily.configured || !selectedIds.length || live.trendsDiscoveryLoading ? "disabled" : ""}>${live.trendsDiscoveryLoading ? "Finding companies and repositories…" : selectedIds.length ? `Find companies from ${selectedIds.length} trend${selectedIds.length === 1 ? "" : "s"} · ≤${esc(selectedCreditBound)} credit${selectedCreditBound === 1 ? "" : "s"}` : "Select trends to find companies"}</button>
          </div>
        </form>
        ${live.trendsDiscoveryError ? `<div class="live-error trend-discovery-error" role="alert"><strong>Trend company search could not complete</strong><span>${esc(live.trendsDiscoveryError)}${live.trendsDiscovery ? " The previous result remains visible below." : " No placeholder companies were added."}</span></div>` : ""}
        ${live.trendsDiscovery && live.trendsDiscoveryStale ? `<div class="trend-hidden-selection trend-result-stale" role="status"><strong>Filters or selected signals changed after this result was captured.</strong><span>The result below remains visible for comparison, but it does not represent the current search brief. Run the bounded search again to update it.</span></div>` : ""}
        ${live.trendsDiscovery ? renderTrendDiscoveryResults(live.trendsDiscovery, { stale: live.trendsDiscoveryStale === true }) : ""}
        ${trends.interpretation ? `<p class="trends-interpretation">${esc(trends.interpretation)}</p>` : ""}`
      : `<article class="surface trends-empty">
          <div class="trends-empty-mark" aria-hidden="true">↗</div>
          <div><p class="eyebrow">No captured trend snapshot</p><h2>Refresh when you want current public-web signals</h2><p>No placeholder claims are shown. Tavily is called only after you explicitly refresh the curated anchor set.</p></div>
        </article>`}
  </section>`;
}

const SAVED_TREND_METRIC_LABELS = Object.freeze({
  sourceFreshness: "Source freshness",
  githubRepositoryCount: "GitHub repositories",
  githubStars: "GitHub stars",
  githubForks: "GitHub forks",
  companySignalCount: "Company signals"
});

function savedMetricValue(value, key) {
  if (value === null || value === undefined) return "Not sampled";
  return key === "sourceFreshness" ? `${value} / 100` : compactNumber(value);
}

function savedMetricDelta(value, key) {
  if (value === null || value === undefined) return "No comparable pair";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${key === "sourceFreshness" ? value : compactNumber(value)} vs baseline`;
}

function renderSavedMetricHistory(watch, metricKey) {
  const points = [
    { ...watch.baselineSnapshot, pointType: "Frozen baseline" },
    ...watch.observations.map((snapshot) => ({ ...snapshot, pointType: "Saved observation" }))
  ];
  const known = points.map((point) => point.metrics[metricKey]).filter((value) => value !== null);
  const maximum = metricKey === "sourceFreshness" ? 100 : Math.max(1, ...known);
  return `<section class="saved-trend-history-series">
    <div><strong>${esc(SAVED_TREND_METRIC_LABELS[metricKey])}</strong><span>${known.length} known point${known.length === 1 ? "" : "s"}</span></div>
    <div class="saved-trend-history-bars">${points.map((point) => {
      const value = point.metrics[metricKey];
      const width = value === null ? 0 : Math.max(value === 0 ? 2 : 8, Math.round((value / maximum) * 100));
      return `<div class="saved-trend-history-point ${value === null ? "is-unknown" : ""}" title="${esc(`${point.pointType} · ${formatDateTime(point.capturedAt)} · ${savedMetricValue(value, metricKey)}`)}"><span style="height:${width}%"></span><small>${value === null ? "?" : esc(compactNumber(value))}</small></div>`;
    }).join("")}</div>
  </section>`;
}

function renderSavedTrendWatch(watch, selected, atLimit) {
  const trend = watch.baselineSnapshot.trend;
  const sourceUrl = safeHttpUrl(trend.sourceUrl);
  const latest = watch.observations.at(-1) || null;
  let comparison;
  try {
    comparison = watch.latestComparison || null;
  } catch {
    comparison = null;
  }
  const inputId = `saved-trend-${String(watch.trendId).replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const latestMetrics = comparison?.currentMetrics || latest?.metrics || null;
  const deltas = comparison?.metricDeltas || {};
  return `<article class="surface saved-trend-card ${selected ? "is-selected" : ""}">
    <header class="saved-trend-card-head">
      <label class="trend-select-control" for="${esc(inputId)}"><input id="${esc(inputId)}" type="checkbox" value="${esc(watch.trendId)}" data-saved-trend-select ${selected ? "checked" : ""} ${atLimit && !selected ? "disabled" : ""}/><span>${selected ? "Selected for reuse" : atLimit ? "Selection limit reached" : "Reuse in company search"}</span></label>
      <button class="button button-small" type="button" data-remove-saved-trend="${esc(watch.trendId)}">Remove</button>
    </header>
    <div class="saved-trend-title"><div><span>${esc(trend.sourceHost)}</span><h3>${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(trend.searchLabel)} ↗</a>` : esc(trend.searchLabel)}</h3><p>${esc(trend.summary)}</p></div>${pill(comparison?.status === "CHANGED" ? "Changed vs baseline" : comparison?.status === "UNCHANGED" ? "Unchanged vs baseline" : "Awaiting later observation", comparison ? "neutral" : "warning")}</div>
    <dl class="saved-trend-watch-meta"><div><dt>Saved</dt><dd>${esc(formatDateTime(watch.savedAt))}</dd></div><div><dt>Frozen baseline</dt><dd>${esc(formatDateTime(watch.baselineSnapshot.capturedAt))}</dd></div><div><dt>Later observations</dt><dd>${watch.observationCount}</dd></div><div><dt>Latest capture</dt><dd>${latest ? esc(formatDateTime(latest.capturedAt)) : "Not observed yet"}</dd></div></dl>
    <div class="saved-trend-current-metrics">${Object.keys(SAVED_TREND_METRIC_LABELS).map((key) => `<div><span>${esc(SAVED_TREND_METRIC_LABELS[key])}</span><strong>${esc(savedMetricValue(latestMetrics?.[key], key))}</strong><small>${esc(savedMetricDelta(deltas[key], key))}</small></div>`).join("")}</div>
    <div class="saved-trend-history-grid">${["sourceFreshness", "githubStars", "companySignalCount"].map((key) => renderSavedMetricHistory(watch, key)).join("")}</div>
    <details class="saved-trend-history-ledger"><summary>Observation ledger and exact changes</summary>${watch.observations.length ? `<ol>${watch.observations.map((point) => `<li><strong>${esc(formatDateTime(point.capturedAt))}</strong><span>${esc(point.provider)}</span><small>Freshness ${esc(savedMetricValue(point.metrics.sourceFreshness, "sourceFreshness"))} · GitHub stars ${esc(savedMetricValue(point.metrics.githubStars, "githubStars"))} · company signals ${esc(savedMetricValue(point.metrics.companySignalCount, "companySignalCount"))}</small></li>`).join("")}</ol>` : `<p>No post-save observation exists. Refresh the trend radar or run a selected-trend company search later to append a real point.</p>`}${comparison?.changes?.length ? `<div class="saved-trend-change-list">${comparison.changes.slice(0, 10).map((change) => `<span>${esc(readable(change.field))}</span>`).join("")}</div>` : ""}</details>
    <footer><span>${trend.sectors.map((value) => esc(optionLabel(TREND_SECTOR_OPTIONS, value))).join(" · ")}</span><span>History starts at the frozen source snapshot; no backfill or forecast</span></footer>
  </article>`;
}

export function renderSavedTrendsDashboard(live, tavily) {
  const watchlist = savedTrendWatchlist(live);
  const activeIds = new Set(watchlist.active.map((item) => String(item.trendId)));
  const selectedIds = [...new Set((live.savedTrendSelectionIds || []).map(String))]
    .filter((id) => activeIds.has(id))
    .slice(0, MAX_TREND_SELECTIONS);
  const observations = watchlist.active.reduce((sum, item) => sum + item.observationCount, 0);
  const lastObserved = watchlist.active.flatMap((item) => item.observations.map((point) => point.capturedAt)).sort().at(-1) || null;
  const region = TREND_REGION_OPTIONS.some((item) => item.value === live.trendsRegion) ? live.trendsRegion : "GLOBAL";
  const sector = TREND_SECTOR_OPTIONS.some((item) => item.value === live.trendsSector) ? live.trendsSector : "ALL";
  return `<section class="saved-trends-dashboard" aria-labelledby="saved-trends-title">
    <article class="surface saved-trends-command"><div><p class="eyebrow">Mario's profile · evidence watchlist</p><h2 id="saved-trends-title">Watch real trend signals across explicit observations</h2><p>Save authoritative trend anchors, append later points when Proofline refreshes or searches, compare exact metrics, and reuse up to four frozen IDs in a new company search.</p></div><div class="saved-trends-command-actions"><button class="button" type="button" data-live-mode="trends">Browse Internet trends</button><span>${tavily.configured ? "Live refresh available" : "Frozen snapshot available"}</span></div></article>
    <section class="saved-trend-kpi-grid" aria-label="Saved trend profile summary"><article><span>Active watches</span><strong>${watchlist.active.length}</strong><small>Profile limit 24</small></article><article><span>Later observations</span><strong>${observations}</strong><small>Only explicit provider captures</small></article><article><span>Selected for reuse</span><strong>${selectedIds.length}<small> / ${MAX_TREND_SELECTIONS}</small></strong><small>Server revalidates every ID</small></article><article><span>Last observed</span><strong>${lastObserved ? esc(formatDate(lastObserved)) : "—"}</strong><small>${lastObserved ? esc(formatDateTime(lastObserved)) : "No post-save point yet"}</small></article><article><span>Profile events</span><strong>${watchlist.eventCount}</strong><small>Append-only local profile</small></article></section>
    <aside class="saved-trend-boundary"><strong>Change is not a growth forecast.</strong><span>Null means not sampled or not reported. Zero appears only after an explicit sample returns zero. GitHub popularity and company counts cannot change a startup score or approve a check.</span></aside>
    ${watchlist.active.length ? `<form id="saved-trend-reuse-form" class="saved-trend-reuse"><div><p class="eyebrow">Reuse saved evidence</p><h3>Load selected watches into a bounded company search</h3><p>This copies stable trend IDs only. The search server rebuilds and validates the current query plan.</p></div><label class="field"><span>Region</span><select name="region">${TREND_REGION_OPTIONS.map((option) => `<option value="${esc(option.value)}" ${option.value === region ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label><label class="field"><span>Sector</span><select name="sector">${TREND_SECTOR_OPTIONS.map((option) => `<option value="${esc(option.value)}" ${option.value === sector ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label><button class="button button-primary" type="submit" ${!selectedIds.length ? "disabled" : ""}>${selectedIds.length ? `Load ${selectedIds.length} saved trend${selectedIds.length === 1 ? "" : "s"} into search` : "Select saved trends below"}</button></form><div class="saved-trend-grid">${watchlist.active.map((watch) => renderSavedTrendWatch(watch, selectedIds.includes(String(watch.trendId)), selectedIds.length >= MAX_TREND_SELECTIONS)).join("")}</div>` : `<article class="surface saved-trends-empty"><div aria-hidden="true">☆</div><div><h3>No saved trend watches yet</h3><p>Open Internet trends and save a real source anchor. Its frozen source snapshot becomes the baseline; history begins only when a later refresh or company search provides another observation.</p><button class="button button-primary" type="button" data-live-mode="trends">Browse real trend signals</button></div></article>`}
  </section>`;
}

function renderResearchProgress(stage, capabilities = null) {
  const hostedUpload = capabilities?.deployment?.uploadProcessing === "HOSTED_EPHEMERAL_SERVER";
  const labels = {
    document: hostedUpload ? "Parsing the authorized upload on the ephemeral hosted server" : "Parsing the authorized upload locally",
    entity: "Running the bounded startup, market, and research queries",
    score: "Normalizing sources and calculating the independent axes",
    "open-data": "Checking four official datasets for exact entity matches"
  };
  return `<section class="research-progress surface" role="status" aria-live="polite" aria-busy="true">
    <div class="research-progress-head"><div class="live-spinner" aria-hidden="true"></div><div><strong>Building the evidence pack</strong><span>${esc(labels[stage] || "Running a bounded research job")}. The provider returns one completed response, so Proofline does not imply sub-query progress it cannot observe.</span></div></div>
  </section>`;
}

function renderDiscoveryForm(thesis, tavily, discovery, loading = false, crossValidateWithExa = false) {
  return `
    <form class="surface live-form" id="live-discovery-form">
      <div class="surface-heading"><div><p class="eyebrow">Thesis-driven outbound sourcing</p><h2>Search for new startup signals</h2><p>Discovery produces unreviewed candidates. Proofline investigates a candidate before producing any score.</p></div>${pill("≈ 2 search credits", "neutral")}</div>
      <div class="live-form-grid">
        <label class="field field-wide"><span>Investment thesis</span><textarea name="thesis" rows="4" required>${esc(thesisText(thesis))}</textarea></label>
        <label class="field"><span>Sectors</span><input name="sectors" value="${esc(thesis.sectors.join(", "))}" /></label>
        <label class="field"><span>Geographies</span><input name="geographies" value="${esc(thesis.geographies.join(", "))}" /></label>
        <label class="field"><span>Stage</span><input name="stage" value="${esc(thesis.stages.join(", "))}" /></label>
        <label class="field"><span>Maximum candidates</span><select name="limit"><option value="4">4</option><option value="8" selected>8</option><option value="12">12</option></select></label>
        <label class="checkbox-row field-wide"><input name="crossValidateWithExa" type="checkbox" ${crossValidateWithExa ? "checked" : ""} ${!tavily.exaConfigured ? "disabled" : ""}/><span>Cross-check retrieval with Exa${tavily.exaConfigured ? " (about $0.014 for this two-query discovery)" : " (add EXA_API to enable)"}. Shared URLs still count once.</span></label>
      </div>
      <div class="live-form-actions"><p>Searches recent public sources for candidate and public professional contact signals—not verified companies or private contact data.</p><button class="button button-primary" type="submit" ${!tavily.configured || loading ? "disabled" : ""}>${loading ? "Searching public sources…" : "Find startup signals"}</button></div>
    </form>
    ${discovery ? renderDiscoveryResults(discovery) : ""}`;
}

function renderDiscoveryResults(discovery) {
  const candidates = discovery.candidates || [];
  return `<section class="surface discovery-results">
    <div class="surface-heading"><div><p class="eyebrow">Live discovery · ${esc(formatDate(discovery.generatedAt))}</p><h2>${candidates.length} candidate signal${candidates.length === 1 ? "" : "s"}</h2><p>${esc(discovery.sourceCount || 0)} public sources searched. Each candidate needs entity investigation before scoring.</p></div>${pill(`${discovery.usage?.reportedCredits ?? discovery.usage?.estimatedCreditsUpperBound ?? "?"} credits`, "neutral")}</div>
    ${candidates.length ? `<div class="candidate-grid">${candidates.map(renderCandidate).join("")}</div>` : `<div class="empty-live"><strong>No defensible candidate names were extracted</strong><p>Try a narrower sector or geography. Zero results means coverage is unknown—not that no startups exist.</p></div>`}
  </section>`;
}

function renderCandidate(candidate) {
  const website = safeHttpUrl(candidate.website);
  const contacts = Array.isArray(candidate.publicContacts)
    ? candidate.publicContacts.filter((contact) => contact?.publicProfessional === true)
    : [];
  return `<article class="candidate-card">
    <div class="candidate-head"><div><span class="candidate-origin">${esc(readable(candidate.discoveryMethod))}</span><h3>${esc(candidate.companyName)}</h3></div>${pill("Unreviewed", "warning")}</div>
    <p>${esc(candidate.reason)}</p>
    <dl class="candidate-meta"><div><dt>Founder signal</dt><dd>${candidate.founderNames?.length ? esc(candidate.founderNames.join(", ")) : "Not resolved"}</dd></div><div><dt>Source links</dt><dd>${esc(candidate.sourceEvidenceIds?.length || 0)}</dd></div><div><dt>Public contacts</dt><dd>${contacts.length ? `${esc(contacts.length)} sourced route${contacts.length === 1 ? "" : "s"}` : "Not found · coverage unknown"}</dd></div></dl>
    ${contacts.length ? `<div class="candidate-contact-signals">${contacts.slice(0, 3).map((contact) => `<span><strong>${esc(contact.subjectName)}</strong>${esc(publicContactChannelLabel(contact.channel))}</span>`).join("")}</div>` : ""}
    <div class="candidate-actions">${website ? `<a href="${esc(website)}" target="_blank" rel="noreferrer">Open candidate website ↗</a>` : `<span>Website not confirmed</span>`}<button class="button button-small" data-live-candidate="${esc(candidate.id)}" type="button">Investigate & score</button></div>
  </article>`;
}

function renderInvestigationForm(live, tavily) {
  const intake = live.intake;
  const maxBytes = live.capabilities?.uploads?.maxBytes || DEFAULT_MAX_DOCUMENT_BYTES;
  const hostedUpload = live.capabilities?.deployment?.uploadProcessing === "HOSTED_EPHEMERAL_SERVER";
  return `<form class="surface live-form" id="live-investigation-form">
    <div class="surface-heading investigation-heading"><div><p class="eyebrow">Known startup research</p><h2>Build a sourced opportunity assessment</h2><p>Add a company name, public links, or an authorized business plan. The form starts with the real Emovo Care demonstration inputs, which you can edit or replace directly.</p></div><div class="investigation-heading-actions">${pill(tavily.exaConfigured ? "Tavily credits + optional Exa USD" : "≈ 1–4 Tavily credits", "neutral")}<button class="button button-small" data-run-emovo-demo type="button">Load frozen $100K result</button><a class="button button-small button-quiet" href="/output/pdf/emovo-care-public-source-business-plan_v1.pdf" target="_blank" rel="noreferrer">Demo PDF</a></div></div>
    <div class="live-form-grid">
      <label class="field"><span>Company name</span><input name="companyName" value="${esc(intake.companyName)}" placeholder="e.g. company legal or trading name" /></label>
      <label class="field"><span>Founder names · optional</span><input name="founderNames" value="${esc(intake.founderNames)}" placeholder="Comma separated" /></label>
      <label class="field field-wide"><span>Website, LinkedIn, or public social links</span><textarea name="links" rows="3" placeholder="One public URL per line. Do not paste credentials.">${esc(intake.links)}</textarea><small>Proofline asks Tavily to inspect public pages. Login walls are reported as not accessed.</small></label>
      <label class="field field-wide"><span>Problem, buyer, and technical context · recommended</span><textarea name="context" rows="3" placeholder="Describe the buyer's operational problem and the technical mechanism to compare. This text guides identity-free incumbent and research searches.">${esc(intake.context)}</textarea><small>Without enough comparison context, Proofline runs entity research only and leaves comparator coverage unknown.</small></label>
      <label class="upload-field field-wide"><span>Business plan · optional</span><input id="business-plan-file" name="businessPlan" type="file" accept="${ACCEPTED_DOCUMENTS}" /><strong>PDF, DOCX, TXT, MD, HTML, JSON, or CSV</strong><small>Maximum ${Math.round(maxBytes / 1024 / 1024)} MiB. Analyze only documents you are authorized to use.${hostedUpload ? " Do not upload confidential plans to this public demo." : ""}</small></label>
      <label class="checkbox-row field-wide"><input name="allowPlanKeywordsForWebResearch" type="checkbox" ${intake.allowPlanKeywordsForWebResearch ? "checked" : ""}/><span>Allow up to eight sanitized plan keywords to guide web searches. The full document is never sent to Tavily.</span></label>
      <label class="checkbox-row field-wide"><input name="crossValidateWithExa" type="checkbox" ${intake.crossValidateWithExa ? "checked" : ""} ${!tavily.exaConfigured ? "disabled" : ""}/><span>Cross-check the same bounded query plan with Exa${tavily.exaConfigured ? " (up to about $0.021 for three searches)" : " (add EXA_API to enable)"}. Provider overlap is retrieval corroboration, not a second independent source.</span></label>
    </div>
    <div class="default-intake-note"><strong>Real-data demo defaults</strong><span>Emovo Care's company, founder, public-link, and market context values are already loaded. The frozen result is a separate reviewed snapshot; a live run uses current provider evidence.</span></div>
    <div class="plan-boundary"><strong>${hostedUpload ? "Public demo document boundary" : "Document boundary"}</strong><p>${hostedUpload ? "The selected file is uploaded to Proofline's ephemeral Render process for parsing and is not persisted by the server. Use the supplied demo PDF; do not submit confidential material. " : ""}The plan is founder-provided, self-reported evidence—not independent validation. Proofline returns only a short excerpt and never returns or persists the full extracted text. Exa and Tavily receive only the bounded search query, never the full document.</p></div>
    <div class="live-form-actions"><p>At least a name, public link, or document is required.</p><button class="button button-primary" type="submit" ${live.loading || (!tavily.configured && !live.capabilities?.uploads) ? "disabled" : ""}>${live.loading ? "Building evidence pack…" : "Research and calculate axes"}</button></div>
  </form>`;
}

function renderSessionHistory(live) {
  if (!live.assessments.length) {
    return `<article class="surface live-side-card"><p class="eyebrow">This session</p><h2>No live assessments yet</h2><p>Start with thesis discovery or analyze a known startup. Uploaded plan content is not retained in browser storage.</p></article>`;
  }
  return `<article class="surface live-side-card"><div class="surface-heading"><div><p class="eyebrow">This session</p><h2>Live assessments</h2></div><span>${live.assessments.length}</span></div><div class="assessment-history">${live.assessments.map((item) => {
    const knownAxes = PRIMARY_AXES.filter(({ key }) => Number.isFinite(dimensionByKey(item.provisionalScore, key)?.score)).length;
    return `<button type="button" data-live-assessment="${esc(item.id)}" class="${item.id === live.selectedAssessmentId ? "active" : ""}"><span>${esc(item.companyName)}</span><strong>${knownAxes}/3 axes covered</strong><small>${item.provisionalScore.coverage.percentage}% criterion coverage · ${esc(readable(item.provisionalScore.uncertainty.level))} uncertainty</small></button>`;
  }).join("")}</div></article>`;
}

function renderResearchBoundary(capabilities) {
  const uploads = capabilities?.uploads?.acceptedExtensions?.join(", ") || "PDF, DOCX, and text formats";
  const hostedUpload = capabilities?.deployment?.uploadProcessing === "HOSTED_EPHEMERAL_SERVER";
  return `<article class="surface live-side-card boundary-card"><p class="eyebrow">Evidence boundary</p><h2>What these axes mean</h2><ul><li>Assess the opportunity and observable execution evidence—not personal worth.</li><li>Exclude protected traits, pedigree, followers, likes, and popularity.</li><li>Require at least two source-host groups before a criterion is covered; host diversity alone does not prove independence.</li><li>Corporate pain establishes context, not startup success.</li><li>Academic and technical work can support problem or mechanism alignment, not this product's efficacy or adoption.</li></ul><small>Uploads: ${esc(uploads)}. ${hostedUpload ? "Public-demo files are parsed in ephemeral server memory; do not upload confidential plans. " : ""}Server-side secret boundary; no arbitrary direct URL fetch.</small></article>`;
}

function openDataFieldLabel(value) {
  return readable(String(value || "Value").replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
}

function openDataValue(value, unit = null) {
  if (value === null || value === undefined) return "Unknown";
  if (unit === "USD" || unit === "CHF") return formatMoney(Number(value), unit);
  if (unit === "BINARY") return Number(value) === 1 ? "1 · inactive flag present" : "0 · inactive flag absent in matched record";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return compactNumber(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None reported";
  return String(value || "Unknown");
}

function renderOpenDataIndicator(indicator, observations) {
  const observation = observations.find((item) => item.observationId === indicator.latestObservationId);
  const sourceUrl = safeHttpUrl(observation?.source?.recordUrl);
  const observed = indicator.status === "OBSERVED";
  const magnitude = Number.isFinite(indicator.normalizedValue) ? Math.max(0, Math.min(100, indicator.normalizedValue)) : 0;
  const direction = indicator.trend?.direction || "UNKNOWN";
  const directionText = direction === "UNKNOWN" ? "Direction unknown" : `${readable(direction)} across retained points · not a forecast`;
  return `<article class="open-data-indicator ${indicator.signalClass === "RISK" ? "is-risk" : "is-growth"} ${observed ? "" : "is-unknown"}">
    <header><div><span>${esc(readable(indicator.signalClass))} proxy</span><h4>${esc(indicator.label)}</h4></div>${pill(observed ? "Observed" : "Unknown", observed ? "neutral" : "warning")}</header>
    <div class="open-data-indicator-value"><strong>${esc(openDataValue(indicator.rawValue, indicator.unit))}</strong><span>${observed ? `${esc(indicator.normalizedValue)} / 100 display magnitude` : "No normalized value"}</span></div>
    <div class="open-data-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${observed ? esc(magnitude) : 0}" aria-label="${esc(indicator.label)} declared display magnitude"><span style="width:${observed ? esc(magnitude) : 0}%"></span></div>
    <dl><div><dt>Freshness</dt><dd>${indicator.freshness?.score == null ? "Unknown" : `${esc(indicator.freshness.score)} / 100 · ${esc(readable(indicator.freshness.status))}`}</dd></div><div><dt>History</dt><dd>${indicator.knownPointCount} known · ${indicator.unknownPointCount} unknown</dd></div><div><dt>Exact match</dt><dd>${indicator.entityMatchConfidence == null ? "Not established" : `${Math.round(indicator.entityMatchConfidence * 100)}% machine match · unreviewed`}</dd></div></dl>
    <p class="open-data-direction">${esc(directionText)}</p>
    <details><summary>Definition, gaps, and source</summary><p>${esc(indicator.referenceRangeCaveat)}</p>${indicator.missingReasonCodes?.length ? `<small>Missing reason: ${indicator.missingReasonCodes.map(readable).map(esc).join(" · ")}</small>` : ""}${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open official/public record ↗</a>` : `<small>No matched source record is available for this indicator.</small>`}</details>
  </article>`;
}

function renderOpenDataDataset(dataset) {
  const matched = dataset.status === "MATCHED";
  const unavailable = dataset.status === "UNAVAILABLE";
  const notQueried = dataset.status === "NOT_QUERIED";
  const documentationUrl = safeHttpUrl(dataset.documentationUrl);
  const summary = dataset.summary && typeof dataset.summary === "object" ? Object.entries(dataset.summary) : [];
  return `<article class="open-data-dataset ${matched ? "is-matched" : unavailable ? "is-unavailable" : "is-unknown"}">
    <header><div><span>${esc(dataset.access || "Official open data")}</span><h4>${esc(dataset.label)}</h4></div>${pill(matched ? `${dataset.matchedRecords} matched` : unavailable ? "Unavailable" : notQueried ? "Not queried" : "No exact match", matched ? "positive" : "warning")}</header>
    <p>${esc(dataset.coverage || "Coverage not reported")}</p>
    ${summary.length ? `<dl>${summary.map(([key, value]) => {
      const noMatchedMoneyValue = !matched && /(amount|award).*usd|usd.*(amount|award)/i.test(key);
      return `<div><dt>${esc(openDataFieldLabel(key))}</dt><dd>${esc(noMatchedMoneyValue ? "Unknown · no exact match" : openDataValue(value, /usd/i.test(key) ? "USD" : null))}</dd></div>`;
    }).join("")}</dl>` : ""}
    ${dataset.records?.length ? `<div class="open-data-record-list">${dataset.records.slice(0, 4).map((record) => {
      const url = safeHttpUrl(record.source?.url);
      const keyValues = Object.entries(record.values || {}).filter(([, value]) => value !== null && value !== "" && (!Array.isArray(value) || value.length)).slice(0, 4);
      return `<div><strong>${esc(record.matchedEntityName || record.subjectName)}</strong><span>${esc(readable(record.direction || record.signalType))}</span><small>${keyValues.map(([key, value]) => `${openDataFieldLabel(key)}: ${openDataValue(value, /amountusd/i.test(key) ? "USD" : null)}`).map(esc).join(" · ")}</small>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Official record ↗</a>` : ""}</div>`;
    }).join("")}</div>` : `<div class="open-data-no-match"><strong>${unavailable ? "Coverage unavailable" : notQueried ? "Entity query not run" : "Exact entity match not retained"}</strong><span>${unavailable ? "The dataset failed open and contributes no adverse value." : notQueried ? "Run the official-data check to request an exact entity match. Until then, coverage is unknown." : "This remains unknown. It is not zero activity, zero funding, or an adverse company signal."}</span></div>`}
    ${dataset.warnings?.length ? `<div class="open-data-warnings">${dataset.warnings.map((warning) => `<span>${esc(warning)}</span>`).join("")}</div>` : ""}
    <footer><span>${esc(dataset.interpretation || "Human verification required.")}</span>${documentationUrl ? `<a href="${esc(documentationUrl)}" target="_blank" rel="noopener noreferrer">API documentation ↗</a>` : ""}</footer>
  </article>`;
}

function renderOpenDataPanel(assessment, capabilities) {
  const result = assessment.openData;
  const snapshot = assessment.openDataSignalSnapshot;
  const catalog = (result?.catalog || capabilities?.providers?.officialOpenData || []).filter((item) => item.id !== "GITHUB_PUBLIC_API");
  const datasets = result?.datasets || catalog.map((item) => ({
    ...item,
    status: "NOT_QUERIED",
    matchedRecords: 0,
    summary: null,
    records: [],
    warnings: [],
    interpretation: "Not queried for this entity yet. Missing coverage is unknown."
  }));
  const observations = Array.isArray(snapshot?.observations) ? snapshot.observations : [];
  const indicators = Array.isArray(snapshot?.indicators) ? snapshot.indicators : [];
  const knownIndicators = indicators.filter((item) => item.status === "OBSERVED").length;
  const growthKnown = indicators.filter((item) => item.status === "OBSERVED" && item.signalClass === "GROWTH").length;
  const riskKnown = indicators.filter((item) => item.status === "OBSERVED" && item.signalClass === "RISK").length;
  return `<section class="surface open-data-panel" aria-labelledby="open-data-title">
    <div class="open-data-heading"><div><p class="eyebrow">Open-data growth &amp; risk context</p><h2 id="open-data-title">Official records and declared key values</h2><p>Proofline checks exact entity matches in GLEIF, ClinicalTrials.gov, NIH RePORTER, and USAspending. These observations sit beside—not inside—the Opportunity score.</p></div><button class="button button-primary" type="button" data-refresh-open-data="${esc(assessment.id)}" ${assessment.openDataLoading ? "disabled" : ""}>${assessment.openDataLoading ? "Checking official datasets…" : "Check 4 official datasets · 0 API credits"}</button></div>
    <section class="open-data-kpi-grid" aria-label="Open data coverage"><article><span>Datasets queried</span><strong>${result?.coverage?.queriedDatasets ?? 0}<small> / 4</small></strong><small>At most 5 external requests</small></article><article><span>Exact matches</span><strong>${result?.coverage?.matchedRecords ?? 0}</strong><small>${result ? `${result.coverage.matchedDatasets} matched dataset${result.coverage.matchedDatasets === 1 ? "" : "s"}` : "Run not started"}</small></article><article><span>Observed indicators</span><strong>${knownIndicators}<small> / ${indicators.length || 10}</small></strong><small>Unknown stays unknown</small></article><article><span>Growth proxies</span><strong>${growthKnown}</strong><small>Observed named measures</small></article><article><span>Risk proxies</span><strong>${riskKnown}</strong><small>Not a composite risk score</small></article><article><span>Provider credits</span><strong>${result?.usage?.providerCreditsUsed ?? 0}</strong><small>No Tavily or Exa call</small></article></section>
    ${assessment.openDataError ? `<div class="live-error open-data-error" role="alert"><strong>Official open-data check was incomplete</strong><span>${esc(assessment.openDataError)} Existing startup research and score were preserved.</span></div>` : ""}
    <aside class="open-data-boundary"><strong>No hidden score inflation.</strong><span>Missing records are unknown, multiple federal sources for one award count once, and registry activity is not efficacy, revenue, valuation, or a calibrated probability of success. Every match requires human entity review before use.</span></aside>
    ${indicators.length ? `<section class="open-data-indicator-section"><div class="surface-heading"><div><h3>Growth and risk indicators</h3><p>Bars show magnitude within each indicator's declared bounds—not cross-company percentiles. Direction describes retained past observations only.</p></div>${pill(`${knownIndicators} observed`, "neutral")}</div><div class="open-data-indicator-grid">${indicators.map((indicator) => renderOpenDataIndicator(indicator, observations)).join("")}</div></section>` : `<div class="open-data-indicators-empty"><strong>No indicator snapshot yet</strong><span>Run the official-data check. A no-match result will remain unknown rather than becoming a zero.</span></div>`}
    <section class="open-data-dataset-section"><div class="surface-heading"><div><h3>Dataset coverage and matched records</h3><p>Every dataset is independently fail-open and preserves its documentation, query coverage, exact-match rejections, and record links.</p></div>${pill(`${datasets.length} sources`, "neutral")}</div><div class="open-data-dataset-grid">${datasets.map(renderOpenDataDataset).join("")}</div></section>
    ${result ? `<footer class="open-data-run-footer"><span>Captured ${esc(formatDateTime(result.generatedAt))} · ${result.usage.externalRequestsUpperBound} request upper bound · exact normalized entity matching</span><span>${esc(result.interpretation)}</span></footer>` : ""}
  </section>`;
}

function renderAssessment(assessment, scoreMode, investmentPolicy, assessmentQueued = false, capabilities = null) {
  const score = scoreMode === "REVIEWED" ? assessment.reviewedScore : assessment.provisionalScore;
  const check = calculatePolicyCheck(score, investmentPolicy, {
    identityConfirmed: assessment.identityConfirmed === true,
    thesisMatch: assessment.thesisMatch === true,
    complianceHold: assessment.complianceHold === false ? false : null
  });
  const reviewedAvailable = assessment.reviewedScore.coverage.coveredCriteria > 0;
  const incumbent = assessment.evidence.filter((item) => item.subject === "INCUMBENT");
  const academic = assessment.evidence.filter((item) => item.subject === "ACADEMIC");
  return `<section class="live-assessment" id="live-assessment">
    <article class="surface live-score-hero score-neutral">
      <div><p class="eyebrow">${scoreMode === "PROVISIONAL" ? "Provisional public-web screen" : "Reviewed-source screen"}</p><h2>${esc(assessment.companyName)}</h2><p>The bounded Opportunity score supports evidence-backed ranking, while the three axes and check gates remain noncompensatory. It is not a success probability, valuation, or investment decision.</p><div class="score-mode-switch" aria-label="Score evidence state"><button type="button" data-live-score-mode="PROVISIONAL" aria-pressed="${scoreMode === "PROVISIONAL"}" class="${scoreMode === "PROVISIONAL" ? "active" : ""}">Provisional</button><button type="button" data-live-score-mode="REVIEWED" aria-pressed="${scoreMode === "REVIEWED"}" class="${scoreMode === "REVIEWED" ? "active" : ""}">Reviewed only</button></div></div>
      <div class="assessment-score-actions"><div class="opportunity-score"><span>Opportunity score</span><strong>${scoreMode === "REVIEWED" && !reviewedAvailable ? "—" : esc(score.opportunityScore)}</strong><small>${scoreMode === "REVIEWED" && !reviewedAvailable ? "Attest relevant external sources first" : `${score.coverage.percentage}% coverage · ±${score.uncertainty.points} · ${esc(readable(score.uncertainty.level))} uncertainty`}</small></div><button class="button ${assessmentQueued ? "button-quiet" : "button-primary"}" data-add-live-queue="${esc(assessment.id)}" type="button" ${assessmentQueued ? "disabled" : ""}>${assessmentQueued ? "In Queue" : "Add to Queue"}</button></div>
    </article>

    <div class="score-disclaimer"><strong>No compensating average</strong><span>A strong Market axis cannot offset a weak or unknown Founder or Idea-vs-Market axis. Missing evidence stays unknown.</span></div>

    ${renderPublicContactProfiles(assessment)}

    ${renderOpenDataPanel(assessment, capabilities)}

    ${renderPolicyCheck(check, assessment, scoreMode)}

    <section class="axis-section" aria-label="Independent opportunity axes"><div class="surface-heading"><div><p class="eyebrow">Independent opportunity axes</p><h2>Founder · Market · Idea vs. market</h2><p>Each axis has its own evidence coverage, confidence, and trend.</p></div></div><div class="live-dimension-grid primary-axis-grid">${PRIMARY_AXES.map((axis) => renderAxisCard(axis, dimensionByKey(score, axis.key), assessment, scoreMode)).join("")}</div></section>

    <section class="diagnostic-section" aria-label="Supporting diagnostics"><div class="surface-heading"><div><p class="eyebrow">Supporting diagnostics</p><h2>Evidence quality and revenue plausibility</h2></div></div><div class="live-dimension-grid diagnostic-grid">${["EVIDENCE_QUALITY", "REVENUE_PLAUSIBILITY"].map((key) => renderDiagnosticCard(dimensionByKey(score, key))).join("")}</div></section>

    <section class="comparison-grid">
      ${renderComparisonPanel("Large-company problem signals", "Corporate pain can strengthen market context only when it independently overlaps the startup's solution evidence.", incumbent, score.comparisons.incumbentPain)}
      ${renderComparisonPanel("Academic and technical research", "Academic work may support problem or mechanism alignment; it does not establish this product's efficacy or adoption.", academic, score.comparisons.academicResearch)}
    </section>

    ${renderCommercialOutlook(score)}
    ${renderClaimTrace(score)}
    ${renderEvidenceLedger(assessment, score)}
    ${renderResearchMetadata(assessment)}
  </section>`;
}

function renderPolicyCheck(check, assessment, scoreMode) {
  const eligible = check.eligibility.eligible && Number.isFinite(check.amount);
  const failed = check.eligibility.failed || [];
  const modeLabel = check.mode === "FIXED" ? "Fixed-check policy" : "Risk-adjusted policy";
  const prerequisitesConfirmed = assessment.identityConfirmed === true && assessment.thesisMatch === true && assessment.complianceHold === false;
  return `<article class="surface policy-check-card ${eligible ? "policy-check-eligible" : ""}">
    <div><p class="eyebrow">${esc(modeLabel)}</p><h2>${eligible ? `Policy-eligible check: ${esc(formatMoney(check.amount, check.currency))}` : "No check calculated yet"}</h2><p>${eligible ? "This opportunity clears the configured evidence gates. Human investment-committee approval, legal and financial diligence, fund allocation, and executed documents are still required." : "Missing or insufficient evidence pauses sizing; it never becomes a smaller founder check or an adverse founder signal."}</p></div>
    <div class="policy-check-state">${pill(eligible ? "Eligible for human review" : scoreMode === "PROVISIONAL" ? "Reviewed sources required" : "Evidence gate open", eligible ? "positive" : "warning")}${check.riskIndex != null ? `<span>Risk index ${esc(check.riskIndex)} · ${esc(readable(check.riskBand))}</span>` : `<span>${esc(readable(check.mode))}</span>`}</div>
    ${!eligible && failed.length ? `<div class="policy-gaps"><strong>Open gates</strong><span>${failed.slice(0, 5).map(readable).map(esc).join(" · ")}</span></div>` : ""}
    ${scoreMode === "REVIEWED" && !prerequisitesConfirmed && !assessment.demoSnapshot ? `<button class="button button-small" data-live-identity-confirm type="button">Confirm policy prerequisites</button>` : ""}
    ${assessment.demoSnapshot ? `<div class="demo-snapshot-note"><strong>Frozen public-source demo</strong><span>${esc(assessment.demoSnapshot.disclaimer)}</span></div>` : ""}
    <small>Non-binding screening output. Proofline does not reserve capital, authorize a transfer, or promise funding.</small>
  </article>`;
}

function renderAxisCard(axis, dimension, assessment, scoreMode) {
  const coverage = Math.round((dimension.coverage || 0) * 100);
  const score = Number.isFinite(dimension.score) ? dimension.score : "—";
  const trend = axisTrend(assessment, scoreMode, axis.key, dimension?.score);
  return `<article class="surface live-dimension-card primary-axis-card"><div><span>${esc(axis.label)}</span><strong>${score}</strong></div><p>${esc(axis.description)}</p><div class="dimension-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number.isFinite(dimension?.score) ? dimension.score : 0}" aria-label="${esc(axis.label)} evidence score"><span style="width:${Number.isFinite(dimension?.score) ? dimension.score : 0}%"></span></div><small>${coverage}% criterion coverage · ${Math.round((dimension?.confidence || 0) * 100)}% confidence</small><span class="axis-trend trend-${esc(trend.tone)}">${esc(trend.label)}</span></article>`;
}

function renderDiagnosticCard(dimension) {
  if (!dimension) return "";
  const coverage = Math.round((dimension.coverage || 0) * 100);
  const score = Number.isFinite(dimension.score) ? dimension.score : "—";
  return `<article class="surface live-dimension-card diagnostic-card"><div><span>${esc(dimension.label)}</span><strong>${score}</strong></div><div class="dimension-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number.isFinite(dimension.score) ? dimension.score : 0}" aria-label="${esc(dimension.label)} score"><span style="width:${Number.isFinite(dimension.score) ? dimension.score : 0}%"></span></div><small>${coverage}% criterion coverage · ${Math.round((dimension.confidence || 0) * 100)}% confidence</small></article>`;
}

function renderComparisonPanel(title, caveat, evidence, comparison) {
  const status = comparison.status === "EVIDENCE_BACKED" ? pill("Evidence-backed", "positive") : pill("Incomplete comparison", "warning");
  const cited = (comparison.citations || []).filter((item) => evidence.some((candidate) => candidate.id === item.evidenceId));
  const citedIds = new Set(cited.map((item) => item.evidenceId));
  const unused = evidence.filter((item) => !citedIds.has(item.id));
  const body = cited.length
    ? `<strong class="comparison-list-label">Sources used in this comparison</strong><div class="comparison-sources">${cited.slice(0, 6).map((item) => sourceMini(item)).join("")}</div>`
    : unused.length
      ? `<strong class="comparison-list-label">Captured research signals · not used in an axis</strong><div class="comparison-sources comparison-unused">${unused.slice(0, 6).map((item) => sourceMini(item)).join("")}</div>`
      : `<div class="empty-live"><strong>No qualifying sources yet</strong><p>Missing evidence is unknown coverage, not a negative finding.</p></div>`;
  return `<article class="surface comparison-panel"><div class="surface-heading"><div><h2>${esc(title)}</h2><p>${esc(caveat)}</p></div>${status}</div>${body}${comparison.missing?.length ? `<small>Still required: ${comparison.missing.map(readable).map(esc).join(" · ")}</small>` : ""}</article>`;
}

function sourceMini(item) {
  const url = safeHttpUrl(item.sourceUrl);
  return `<div class="comparison-source"><span>${esc(readable(item.sourceType))} · ${esc(readable(item.reviewState))}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer"><strong>${esc(item.title)}</strong></a>` : `<strong>${esc(item.title)}</strong>`}<small>${esc(item.excerpt.slice(0, 220))}</small></div>`;
}

function renderCommercialOutlook(score) {
  const revenue = score.dimensions.find((item) => item.key === "REVENUE_PLAUSIBILITY");
  const coverage = Math.round((revenue?.coverage || 0) * 100);
  const covered = score.claims.filter((claim) => claim.dimension === "REVENUE_PLAUSIBILITY" && claim.score != null);
  if (!Number.isFinite(revenue?.score) || !covered.length) {
    return `<article class="surface commercial-outlook"><div class="surface-heading"><div><p class="eyebrow">Commercial outlook</p><h2>Revenue plausibility remains unknown</h2><p>Proofline found no independently corroborated willingness-to-pay, unit-economics, repeatable sales-path, or market-scale criterion. It will not invent TAM, pricing, conversion, or a dollar forecast.</p></div>${pill(`${coverage}% coverage`, "warning")}</div><div class="empty-live"><strong>Evidence needed before a revenue view is defensible</strong><p>Buyer budgets or paid pilots · unit cost and gross-margin evidence · procurement or channel path · addressable customer or unit counts.</p></div></article>`;
  }
  return `<article class="surface commercial-outlook"><div class="surface-heading"><div><p class="eyebrow">Commercial outlook</p><h2>Revenue plausibility evidence</h2><p>This is a bounded evidence index, not a revenue forecast or valuation model.</p></div>${pill(`${coverage}% coverage`, "neutral")}</div><div class="revenue-evidence-summary"><strong>${revenue.score}</strong><span>${Math.round((revenue.confidence || 0) * 100)}% confidence · ${covered.length} covered criterion${covered.length === 1 ? "" : "s"}</span></div><div class="claim-trace-list">${covered.map((claim) => `<div><strong>${esc(claim.criterionLabel)}</strong><p>${esc(claim.rationale)}</p></div>`).join("")}</div></article>`;
}

function renderClaimTrace(score) {
  const claims = score.claims.filter((claim) => claim.score != null);
  return `<article class="surface claim-trace"><div class="surface-heading"><div><p class="eyebrow">Auditable calculation</p><h2>Covered evidence claims</h2><p>Each criterion needs role-tagged, topically coherent evidence from at least two source-host groups.</p></div>${pill(`${claims.length} covered`, "neutral")}</div>${claims.length ? `<div class="claim-trace-list">${claims.map((claim) => `<div><div><strong>${esc(claim.criterionLabel)}</strong><span>${esc(readable(claim.status))}</span></div><p>${esc(claim.rationale)}</p><small>Evidence score ${claim.score} · ${Math.round(claim.confidence * 100)}% confidence · ${claim.independentSupportingGroups} source-host groups</small>${renderClaimCitations(claim.citations)}</div>`).join("")}</div>` : `<div class="empty-live"><strong>No criteria clear the evidence gate yet</strong><p>Attest relevant sources or collect stronger evidence. Absence of public proof is not an adverse founder signal.</p></div>`}</article>`;
}

function renderClaimCitations(citations = []) {
  if (!citations.length) return "";
  return `<div class="claim-citations">${citations.slice(0, 4).map((citation) => {
    const url = safeHttpUrl(citation.sourceUrl);
    const label = `${citation.title} · ${readable(citation.reviewState)}`;
    return url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>` : `<span>${esc(label)}</span>`;
  }).join("")}</div>`;
}

function renderEvidenceLedger(assessment, score) {
  const quality = new Map(score.evidenceLedger.map((item) => [item.evidenceId, item]));
  const itemCount = assessment.evidence.length;
  const groupCount = new Set(assessment.evidence.map((item) => item.independenceGroup)).size;
  return `<article class="surface live-evidence-ledger"><div class="surface-heading"><div><p class="eyebrow">Source ledger</p><h2>${itemCount} captured evidence item${itemCount === 1 ? "" : "s"}</h2><p>A review attestation confirms that a human opened the source and checked entity match and excerpt relevance. It does not make the source's claims true.</p></div>${pill(`${groupCount} source-host group${groupCount === 1 ? "" : "s"}`, "neutral")}</div><div class="live-evidence-list">${assessment.evidence.map((item) => renderLiveEvidence(item, quality.get(item.id), assessment.demoSnapshot)).join("")}</div></article>`;
}

function renderLiveEvidence(item, quality, frozenDemo = null) {
  const url = safeHttpUrl(item.sourceUrl);
  const reviewed = item.reviewState === "REVIEWED";
  return `<article class="live-evidence-item"><div class="live-evidence-head"><div><span>${esc(readable(item.subject))} · ${esc(readable(item.sourceType))}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer"><strong>${esc(item.title)}</strong></a>` : `<strong>${esc(item.title)}</strong>`}</div><div>${pill(reviewed ? "Review attested" : "Unreviewed", reviewed ? "positive" : "warning")}<strong class="evidence-q">Q ${quality?.quality ?? 0}</strong></div></div><p>${esc(item.excerpt)}</p><div class="live-evidence-foot"><span>${esc(item.independenceGroup)} · ${esc(formatDate(item.publishedAt || item.capturedAt))}</span>${frozenDemo ? `<span class="frozen-source-label">Frozen demo source</span>` : `<button class="button button-small" data-live-review="${esc(item.id)}" type="button">${reviewed ? "Retract attestation" : "Attest source reviewed"}</button>`}</div></article>`;
}

function renderResearchMetadata(assessment) {
  const usage = assessment.research.usage || {};
  const failures = assessment.research.linkInspection?.failures || [];
  const latestReview = assessment.reviewEvents?.at(-1);
  const researchWarning = assessment.research.webResearch?.warning || assessment.research.warning;
  const cross = assessment.research.crossValidation;
  const demoRecognition = assessment.research.document?.demoSnapshot;
  const exaCost = usage.exa?.reportedCostDollars ?? usage.exa?.estimatedCostUpperBoundDollars;
  const usageLabel = `${usage.reportedCredits ?? usage.estimatedCreditsUpperBound ?? "?"} Tavily credits${exaCost ? ` · Exa $${Number(exaCost).toFixed(3)}` : ""}`;
  return `<article class="surface research-metadata"><div class="surface-heading"><div><p class="eyebrow">Research run</p><h2>Provenance and provider usage</h2></div>${pill(usageLabel, "neutral")}</div><dl><div><dt>Provider</dt><dd>${esc(assessment.research.provider || "Local document parser only")}</dd></div><div><dt>Captured</dt><dd>${esc(formatDate(assessment.research.generatedAt))}</dd></div><div><dt>Primary queries</dt><dd>${esc(assessment.research.queries?.length || 0)}</dd></div><div><dt>Exa cross-check</dt><dd>${esc(readable(cross?.status || "not requested"))}${cross?.retrievalOverlapUrls ? ` · ${esc(cross.retrievalOverlapUrls)} overlapping URL${cross.retrievalOverlapUrls === 1 ? "" : "s"}` : ""}</dd></div><div><dt>Plan text shared</dt><dd>${assessment.research.privacy?.fullDocumentSentToResearchProvider ? "Yes" : "No"}</dd></div><div><dt>Review events</dt><dd>${esc(assessment.reviewEvents?.length || 0)}${latestReview ? ` · latest ${esc(formatDate(latestReview.occurredAt))}` : ""}</dd></div></dl>${demoRecognition ? `<div class="provider-interpretation"><strong>Exact packaged demo recognized</strong><span>${esc(demoRecognition.interpretation)} Any current Tavily or Exa retrieval shown here is unreviewed and excluded from the frozen score.</span></div>` : ""}${cross?.interpretation ? `<div class="provider-interpretation"><strong>Cross-validation boundary</strong><span>${esc(cross.interpretation)}</span></div>` : ""}${cross?.warnings?.length ? `<div class="link-failures"><strong>Exa warning</strong>${cross.warnings.map((item) => `<span>${esc(item.message)}</span>`).join("")}</div>` : ""}${researchWarning ? `<div class="link-failures"><strong>Optional web enrichment warning</strong><span>${esc(researchWarning)}</span></div>` : ""}${failures.length ? `<div class="link-failures"><strong>Links not accessed</strong>${failures.map((item) => `<span>${esc(item.url)} · ${esc(item.reason)}</span>`).join("")}</div>` : ""}</article>`;
}

function attachEmovoOpenDataSnapshot(assessment) {
  if (String(assessment?.companyName || "").trim().toLowerCase() === "emovo care") {
    assessment.openDataSignalSnapshot = EMOVO_OPEN_DATA_SIGNAL_DEMO_V1;
  }
  assessment.openData ??= null;
  assessment.openDataLoading ??= false;
  assessment.openDataError ??= null;
  return assessment;
}

async function collectAssessmentOpenData(live, assessment) {
  assessment.openDataLoading = true;
  assessment.openDataError = null;
  try {
    const endpoint = live.capabilities?.endpoints?.openDataSignals || "/api/open-data/signals";
    const result = await apiRequest(endpoint, {
      companyName: assessment.companyName,
      founderNames: assessment.founderNames || []
    });
    assessment.openData = result;
    assessment.openDataSignalSnapshot = buildOfficialProviderSignalSnapshot(result, {
      baseSnapshot: assessment.openDataSignalSnapshot || null
    });
    return result;
  } catch (error) {
    assessment.openDataError = messageForError(error);
    return null;
  } finally {
    assessment.openDataLoading = false;
  }
}

export function bindLiveWorkspace({ live, thesis, tavily, rerender, notice, persistSavedTrendsProfile }) {
  document.querySelectorAll("[data-live-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      live.mode = button.dataset.liveMode;
      live.error = null;
      rerender(true);
    });
  });

  document.querySelectorAll("[data-save-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      const trendId = String(button.dataset.saveTrend || "");
      try {
        const profile = saveTrendToProfile(live.savedTrendsProfile, {
          trendId,
          actor: "Mario",
          occurredAt: new Date(Math.max(Date.now(), Date.parse(live.savedTrendsProfile.updatedAt))).toISOString()
        });
        live.savedTrendsProfile = profile;
        persistSavedTrendsProfile?.(profile);
        notice(`${TREND_CATALOG_BY_ID.get(trendId)?.searchLabel || "Trend"} saved to Mario's profile. History will append only from a later real observation.`);
        rerender();
      } catch (error) {
        notice(error instanceof Error ? error.message : "The trend could not be saved.");
      }
    });
  });

  document.querySelectorAll("[data-remove-saved-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      const trendId = String(button.dataset.removeSavedTrend || "");
      try {
        const profile = removeTrendFromProfile(live.savedTrendsProfile, {
          trendId,
          actor: "Mario",
          occurredAt: new Date(Math.max(Date.now(), Date.parse(live.savedTrendsProfile.updatedAt))).toISOString()
        });
        live.savedTrendsProfile = profile;
        live.savedTrendSelectionIds = (live.savedTrendSelectionIds || []).filter((id) => String(id) !== trendId);
        persistSavedTrendsProfile?.(profile);
        notice("Trend watch removed from the active profile. Its append-only profile events remain auditable.");
        rerender();
      } catch (error) {
        notice(error instanceof Error ? error.message : "The trend watch could not be removed.");
      }
    });
  });

  document.querySelectorAll("[data-saved-trend-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const activeIds = new Set(savedTrendWatchlist(live).active.map((item) => String(item.trendId)));
      const trendId = String(checkbox.value || "");
      const selected = [...new Set((live.savedTrendSelectionIds || []).map(String))].filter((id) => activeIds.has(id));
      if (checkbox.checked && !selected.includes(trendId)) {
        if (selected.length >= MAX_TREND_SELECTIONS) {
          notice(`Select up to ${MAX_TREND_SELECTIONS} saved trends per company search.`);
        } else if (activeIds.has(trendId)) {
          selected.push(trendId);
        }
      } else if (!checkbox.checked) {
        const index = selected.indexOf(trendId);
        if (index >= 0) selected.splice(index, 1);
      }
      live.savedTrendSelectionIds = selected;
      rerender();
    });
  });

  document.getElementById("saved-trend-reuse-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      const reuse = buildSavedTrendSearchReuse(live.savedTrendsProfile, {
        trendIds: live.savedTrendSelectionIds,
        region: String(data.get("region") || "GLOBAL"),
        sector: String(data.get("sector") || "ALL")
      });
      live.trendsSelectedIds = [...reuse.request.selectedTrendIds];
      live.trendsRegion = reuse.request.region;
      live.trendsSector = reuse.request.sector;
      live.trendsDiscoveryStale = Boolean(live.trendsDiscovery);
      live.mode = "trends";
      notice(`${reuse.request.selectedTrendIds.length} saved trend${reuse.request.selectedTrendIds.length === 1 ? "" : "s"} loaded. Review the grounded brief, then run the bounded company search.`);
      rerender(true);
    } catch (error) {
      notice(error instanceof Error ? error.message : "The saved trends could not be reused.");
    }
  });

  document.getElementById("trends-refresh-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!tavily.configured || live.trendsLoading) return;
    const data = new FormData(event.currentTarget);
    live.trendsFocus = String(data.get("focus") || "").trim();
    live.trendsLoading = true;
    live.trendsError = null;
    rerender();
    try {
      const refreshed = await apiRequest("/api/trends", { focus: live.trendsFocus });
      live.trends = refreshed;
      live.trendsFocus = refreshed.focus || live.trendsFocus;
      live.trendsSelectedIds = normalizedTrendSelections(live, trendCardsForSnapshot(refreshed.evidence || []));
      live.trendsDiscoveryStale = Boolean(live.trendsDiscovery);
      const appended = captureSavedTrendObservations(live, persistSavedTrendsProfile, {
        capturedAt: refreshed.generatedAt || refreshed.capturedAt,
        includeDiscovery: false
      });
      notice(`Trend radar refreshed with ${refreshed.evidence?.length || 0} retained public sources. ${appended ? `${appended} saved watch observation${appended === 1 ? " was" : "s were"} appended.` : "No eligible later watch observation was appended."} No startup score changed.`);
    } catch (error) {
      live.trendsError = messageForError(error);
    } finally {
      live.trendsLoading = false;
      rerender(true);
    }
  });

  document.querySelectorAll("[data-trend-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const evidence = Array.isArray(live.trends?.evidence) ? live.trends.evidence : [];
      const validIds = new Set(trendCardsForSnapshot(evidence).map((item) => item.trendId).filter(Boolean));
      const trendId = String(checkbox.value || "");
      if (!validIds.has(trendId)) {
        live.trendsDiscoveryError = "This source is not part of the server-known trend discovery catalog.";
        rerender();
        return;
      }
      const selected = normalizedTrendSelections(live, trendCardsForSnapshot(evidence));
      if (checkbox.checked && !selected.includes(trendId)) {
        if (selected.length >= MAX_TREND_SELECTIONS) {
          notice(`Select up to ${MAX_TREND_SELECTIONS} trend signals per bounded company search.`);
          rerender();
          return;
        }
        selected.push(trendId);
      } else if (!checkbox.checked) {
        const index = selected.indexOf(trendId);
        if (index >= 0) selected.splice(index, 1);
      }
      live.trendsSelectedIds = selected;
      live.trendsDiscoveryError = null;
      live.trendsDiscoveryStale = Boolean(live.trendsDiscovery);
      rerender();
    });
  });

  document.getElementById("trend-region-filter")?.addEventListener("change", (event) => {
    const region = String(event.currentTarget.value || "GLOBAL");
    live.trendsRegion = TREND_REGION_OPTIONS.some((option) => option.value === region) ? region : "GLOBAL";
    live.trendsDiscoveryStale = Boolean(live.trendsDiscovery);
    rerender();
  });

  document.getElementById("trend-sector-filter")?.addEventListener("change", (event) => {
    const sector = String(event.currentTarget.value || "ALL");
    live.trendsSector = TREND_SECTOR_OPTIONS.some((option) => option.value === sector) ? sector : "ALL";
    live.trendsDiscoveryStale = Boolean(live.trendsDiscovery);
    rerender();
  });

  document.getElementById("trend-discovery-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!tavily.configured || live.trendsDiscoveryLoading) return;
    const evidence = Array.isArray(live.trends?.evidence) ? live.trends.evidence : [];
    const selectedTrendIds = normalizedTrendSelections(live, trendCardsForSnapshot(evidence));
    if (!selectedTrendIds.length) {
      live.trendsDiscoveryError = "Select at least one frozen trend signal before searching for companies.";
      rerender();
      return;
    }
    const data = new FormData(event.currentTarget);
    const region = String(data.get("region") || live.trendsRegion || "GLOBAL");
    const sector = String(data.get("sector") || live.trendsSector || "ALL");
    live.trendsRegion = TREND_REGION_OPTIONS.some((option) => option.value === region) ? region : "GLOBAL";
    live.trendsSector = TREND_SECTOR_OPTIONS.some((option) => option.value === sector) ? sector : "ALL";
    live.trendsSelectedIds = selectedTrendIds;
    live.trendsDiscoveryLoading = true;
    live.trendsDiscoveryError = null;
    rerender();
    try {
      const endpoint = live.capabilities?.endpoints?.trendCompanyDiscovery || live.capabilities?.endpoints?.trendDiscovery || "/api/trends/discover";
      const result = await apiRequest(endpoint, {
        selectedTrendIds,
        region: live.trendsRegion,
        sector: live.trendsSector
      });
      live.trendsDiscovery = result;
      live.trendsDiscoveryStale = false;
      const appended = captureSavedTrendObservations(live, persistSavedTrendsProfile, {
        capturedAt: result.generatedAt,
        includeDiscovery: true
      });
      notice(`Trend search retained ${result.candidates?.length || 0} company signals and ${result.githubSignals?.length || 0} public GitHub project signals.${appended ? ` ${appended} saved watch observation${appended === 1 ? " was" : "s were"} appended.` : ""} Investigate a company before scoring.`);
    } catch (error) {
      live.trendsDiscoveryError = messageForError(error);
    } finally {
      live.trendsDiscoveryLoading = false;
      rerender(true);
    }
  });

  document.getElementById("live-discovery-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!tavily.configured || live.loading) return;
    const data = new FormData(event.currentTarget);
    live.discoveryCrossValidateWithExa = data.get("crossValidateWithExa") === "on";
    live.loading = true;
    live.stage = "entity";
    live.error = null;
    rerender();
    try {
      live.discovery = await apiRequest("/api/discover", {
        thesis: String(data.get("thesis") || ""),
        sectors: splitList(data.get("sectors")),
        geographies: splitList(data.get("geographies")),
        stage: String(data.get("stage") || ""),
        limit: Number(data.get("limit") || 8),
        crossValidateWithExa: live.discoveryCrossValidateWithExa
      });
      notice(`Found ${live.discovery.candidates?.length || 0} candidate signals. Investigate one before scoring.`);
    } catch (error) {
      live.error = messageForError(error);
    } finally {
      live.loading = false;
      live.stage = null;
      rerender();
    }
  });

  document.querySelectorAll("[data-live-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = [
        ...(live.discovery?.candidates || []),
        ...(live.trendsDiscovery?.candidates || [])
      ].find((item) => item.id === button.dataset.liveCandidate);
      if (!candidate) return;
      const candidateLinks = [...new Set([
        candidate.website,
        ...(candidate.publicContacts || []).map((contact) => safeHttpUrl(contact?.value))
      ].filter(Boolean))];
      live.intake = {
        ...live.intake,
        companyName: candidate.companyName,
        founderNames: candidate.founderNames?.join(", ") || "",
        links: candidateLinks.join("\n"),
        context: candidate.reason
      };
      live.mode = "investigate";
      live.error = null;
      rerender(true);
    });
  });

  document.querySelector("[data-run-emovo-demo]")?.addEventListener("click", () => {
    const assessment = attachEmovoOpenDataSnapshot(createEmovoDemoAssessment());
    live.assessments = [assessment, ...live.assessments.filter((item) => item.id !== assessment.id)];
    live.selectedAssessmentId = assessment.id;
    live.scoreMode = "REVIEWED";
    live.mode = "assessments";
    live.error = null;
    notice("Loaded the frozen real-source Emovo Care policy demo. It is non-binding and uses no live provider credits.");
    rerender(true);
  });

  document.getElementById("live-investigation-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (live.loading) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("businessPlan");
    const intake = {
      companyName: String(data.get("companyName") || "").trim(),
      founderNames: String(data.get("founderNames") || ""),
      links: String(data.get("links") || ""),
      context: String(data.get("context") || "").trim(),
      allowPlanKeywordsForWebResearch: data.get("allowPlanKeywordsForWebResearch") === "on",
      crossValidateWithExa: data.get("crossValidateWithExa") === "on"
    };
    live.intake = intake;
    const founders = splitList(intake.founderNames);
    const links = splitLinks(intake.links);
    const hasFile = file instanceof File && file.size > 0;
    if (!intake.companyName && !links.length && !hasFile) {
      live.error = "Provide a company name, at least one public link, or a business-plan file.";
      rerender();
      return;
    }
    if (!tavily.configured && !hasFile) {
      live.error = "Public-web research is not configured. Add TAVILY_API or TAVILY_API_KEY, or attach an authorized document for local-only parsing.";
      rerender();
      return;
    }
    live.loading = true;
    live.stage = hasFile ? "document" : "entity";
    live.error = null;
    rerender();
    try {
      let research;
      if (hasFile) {
        const maxBytes = live.capabilities?.uploads?.maxBytes || DEFAULT_MAX_DOCUMENT_BYTES;
        if (file.size > maxBytes) throw new Error(`Document exceeds the ${Math.round(maxBytes / 1024 / 1024)} MiB limit.`);
        const filePayload = await encodeFile(file);
        live.stage = "entity";
        rerender();
        research = await apiRequest("/api/documents/inspect", {
          file: filePayload,
          companyName: intake.companyName || undefined,
          founderNames: founders,
          links,
          context: intake.context || undefined,
          allowPlanKeywordsForWebResearch: intake.allowPlanKeywordsForWebResearch,
          crossValidateWithExa: intake.crossValidateWithExa
        });
      } else {
        research = await apiRequest("/api/investigate", {
          companyName: intake.companyName || undefined,
          founderNames: founders,
          links,
          context: intake.context || undefined,
          crossValidateWithExa: intake.crossValidateWithExa
        });
      }
      live.stage = "score";
      rerender();
      const packagedDemoRecognized = research.document?.demoSnapshot?.id === "DEMO-EMOVO-2026-07-19";
      const companyName = packagedDemoRecognized ? "Emovo Care" : intake.companyName || inferCompanyName(research, file?.name);
      const assessment = packagedDemoRecognized
        ? createEmovoDemoAssessment()
        : buildAssessment({ research, companyName, founderNames: founders, thesis });
      attachEmovoOpenDataSnapshot(assessment);
      if (packagedDemoRecognized) {
        const frozenResearch = assessment.research;
        assessment.research = {
          ...research,
          provider: research.provider
            ? `${frozenResearch.provider}; current unreviewed retrieval: ${research.provider}`
            : frozenResearch.provider,
          summary: `${frozenResearch.summary} The exact uploaded PDF was recognized by file digest and loaded this separate frozen reviewed source pack.`,
          caveats: [...frozenResearch.caveats, ...(research.caveats || [])],
          frozenSnapshotCapturedAt: frozenResearch.generatedAt
        };
      }
      const priorAssessment = live.assessments.find((item) => item.companyName.toLowerCase() === companyName.toLowerCase());
      if (priorAssessment) {
        assessment.previousAxisScores = {
          PROVISIONAL: axisSnapshot(priorAssessment.provisionalScore),
          REVIEWED: axisSnapshot(priorAssessment.reviewedScore)
        };
      }
      live.stage = "open-data";
      rerender();
      await collectAssessmentOpenData(live, assessment);
      live.assessments = [assessment, ...live.assessments.filter((item) => item.id !== assessment.id)];
      live.selectedAssessmentId = assessment.id;
      live.scoreMode = packagedDemoRecognized ? "REVIEWED" : "PROVISIONAL";
      live.mode = "assessments";
      notice(packagedDemoRecognized
        ? "Exact packaged Emovo Care demo recognized; the separate frozen reviewed snapshot was loaded. The PDF itself remains self-reported evidence."
        : `Live assessment created for ${companyName}.`);
    } catch (error) {
      live.error = messageForError(error);
    } finally {
      live.loading = false;
      live.stage = null;
      rerender(true);
    }
  });

  document.querySelectorAll("[data-live-assessment]").forEach((button) => {
    button.addEventListener("click", () => {
      live.selectedAssessmentId = button.dataset.liveAssessment;
      live.mode = "assessments";
      rerender(true);
    });
  });

  document.querySelectorAll("[data-live-score-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      live.scoreMode = button.dataset.liveScoreMode;
      rerender();
    });
  });

  document.querySelector("[data-refresh-open-data]")?.addEventListener("click", async (event) => {
    const assessment = live.assessments.find((item) => item.id === event.currentTarget.dataset.refreshOpenData);
    if (!assessment || assessment.openDataLoading) return;
    assessment.openDataLoading = true;
    assessment.openDataError = null;
    rerender();
    const result = await collectAssessmentOpenData(live, assessment);
    if (result) {
      notice(`Official open-data check completed for ${assessment.companyName}: ${result.coverage.matchedRecords} exact record match${result.coverage.matchedRecords === 1 ? "" : "es"}. No Tavily/Exa credits were used and no startup score changed.`);
    } else {
      notice("Official datasets were unavailable or incomplete. Existing evidence and scores were preserved; no negative signal was recorded.");
    }
    rerender();
  });

  document.querySelector("[data-add-live-queue]")?.addEventListener("click", (event) => {
    const assessmentId = event.currentTarget.dataset.addLiveQueue;
    try {
      const queued = queueAssessment(live, assessmentId);
      notice(`${live.assessments.find((item) => item.id === queued.assessmentId)?.companyName || "Assessment"} added to the real-company Queue.`);
      rerender();
    } catch (error) {
      notice(error instanceof Error ? error.message : "The assessment could not be added to the Queue.");
    }
  });

  document.querySelectorAll("[data-live-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const assessment = selectedAssessment(live);
      if (!assessment) return;
      const evidence = assessment.evidence.find((item) => item.id === button.dataset.liveReview);
      if (!evidence) return;
      const occurredAt = new Date().toISOString();
      if (evidence.reviewState !== "REVIEWED") {
        const confirmed = window.confirm("Attest that you opened this source, checked the startup/entity match, and found the quoted excerpt relevant. This attestation does not establish that every source claim is true or that academic material is peer reviewed.");
        if (!confirmed) return;
        evidence.reviewState = "REVIEWED";
        assessment.reviewEvents.push({
          id: `REV-${Date.now()}-${evidence.id}`,
          type: "SOURCE_REVIEW_ATTESTED",
          evidenceId: evidence.id,
          occurredAt,
          actor: "LOCAL_HUMAN_SESSION",
          attestation: "SOURCE_OPENED_ENTITY_MATCH_AND_EXCERPT_RELEVANCE"
        });
      } else {
        evidence.reviewState = "UNREVIEWED";
        assessment.reviewEvents.push({
          id: `REV-${Date.now()}-${evidence.id}`,
          type: "SOURCE_REVIEW_RETRACTED",
          evidenceId: evidence.id,
          occurredAt,
          actor: "LOCAL_HUMAN_SESSION",
          attestation: "PRIOR_ATTESTATION_RETRACTED"
        });
      }
      recomputeAssessment(assessment, thesis, occurredAt);
      live.scoreMode = evidence.reviewState === "REVIEWED" ? "REVIEWED" : "PROVISIONAL";
      rerender();
    });
  });

  document.querySelector("[data-live-identity-confirm]")?.addEventListener("click", () => {
    const assessment = selectedAssessment(live);
    if (!assessment || assessment.demoSnapshot) return;
    const confirmed = window.confirm("Confirm all three policy prerequisites for this session: you reviewed the cited sources and entity match, the opportunity matches the configured thesis, and no compliance hold is known. This does not verify every claim or approve an investment.");
    if (!confirmed) return;
    assessment.identityConfirmed = true;
    assessment.thesisMatch = true;
    assessment.complianceHold = false;
    assessment.reviewEvents.push({
      id: `IDENTITY-${Date.now()}`,
      type: "POLICY_PREREQUISITES_CONFIRMED",
      occurredAt: new Date().toISOString(),
      actor: "LOCAL_HUMAN_SESSION",
      attestation: "ENTITY_MATCH_THESIS_MATCH_AND_NO_KNOWN_COMPLIANCE_HOLD"
    });
    notice("Policy prerequisites confirmed for this session. Check sizing still requires every published evidence gate.");
    rerender();
  });
}

async function apiRequest(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Proofline received an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}.`);
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function messageForError(error) {
  const code = error?.code;
  if (code === "UPSTREAM_RATE_LIMIT" || code === "LOCAL_RATE_LIMIT") return "The research quota or rate limit was reached. Wait briefly and retry; no negative evidence was recorded.";
  if (code === "PUBLIC_DEMO_BUDGET_EXHAUSTED") return "The public demo's bounded live-research budget has been used. The frozen real-source Emovo workflow remains available without provider credits.";
  if (code === "INVALID_URL" || code === "PRIVATE_URL") return "One submitted URL is invalid or points to a private/local address. Use a public HTTP or HTTPS link.";
  if (code === "ENCRYPTED_DOCUMENT") return "The document is encrypted or password-protected. Export an unlocked copy and try again.";
  if (code === "DOCUMENT_PARSE_FAILED" || code === "NO_READABLE_TEXT") return "Proofline could not extract readable text from this file. Try a text-searchable PDF, DOCX, or TXT export.";
  if (code === "UPSTREAM_AUTH") return "Tavily rejected the configured server credential. Check the API key without exposing it in the browser.";
  return error instanceof Error ? error.message : "Live research failed.";
}

async function encodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return {
    name: file.name,
    type: file.type || undefined,
    encoding: "base64",
    content: btoa(binary)
  };
}

function inferCompanyName(research, filename) {
  return research.subject?.companyName || String(filename || "Uploaded startup").replace(/\.[^.]+$/, "") || "Live startup";
}

export function buildAssessment({ research, companyName, founderNames, thesis }) {
  const asOf = validTimestamp(research.generatedAt) || new Date().toISOString();
  const evidence = normalizeEvidence(research.evidence || [], asOf, { companyName, founderNames });
  const id = research.researchId || `LIVE-${Date.now()}`;
  const assessment = {
    id,
    companyName,
    founderNames,
    research,
    evidence,
    publicContacts: structuredClone(Array.isArray(research.publicContacts) ? research.publicContacts : []),
    contactDiscovery: research.contactDiscovery ? structuredClone(research.contactDiscovery) : null,
    reviewEvents: [],
    previousAxisScores: null,
    openData: null,
    openDataSignalSnapshot: null,
    openDataLoading: false,
    openDataError: null,
    provisionalScore: null,
    reviewedScore: null
  };
  recomputeAssessment(assessment, thesis, asOf);
  return assessment;
}

function recomputeAssessment(assessment, thesis, asOf = assessment.research.generatedAt) {
  const effectiveAsOf = validTimestamp(asOf) || new Date().toISOString();
  const base = {
    opportunityId: assessment.id,
    asOf: effectiveAsOf,
    evidence: assessment.evidence,
    companyName: assessment.companyName,
    founderNames: assessment.founderNames,
    thesis: thesisText(thesis)
  };
  const provisionalInput = buildLiveScoreInput({ ...base, mode: "PROVISIONAL" });
  const reviewedInput = buildLiveScoreInput({ ...base, mode: "REVIEWED" });
  assessment.provisionalScore = computeLiveOpportunityScore(provisionalInput);
  assessment.reviewedScore = computeLiveOpportunityScore(reviewedInput);
}

function validTimestamp(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  const date = new Date(value);
  if (date.getTime() > Date.now() + 60_000) return null;
  return date.toISOString();
}

export function normalizeEvidence(items, capturedAt, subjectContext = {}) {
  const seen = new Set();
  return items.flatMap((item, index) => {
    const publicUrl = safeHttpUrl(item.url);
    const isUpload = item.sourceType === "FOUNDER_PROVIDED_DOCUMENT";
    if (!publicUrl && !isUpload) return [];
    const sourceUrl = publicUrl || `proofline://upload/${encodeURIComponent(item.id || `document-${index}`)}`;
    const host = publicUrl ? new URL(publicUrl).hostname.toLowerCase().replace(/^www\./, "") : `uploaded:${item.id || index}`;
    const sourceType = mapSourceType(item, host);
    const role = resolveSubjectRole(item, sourceType, subjectContext);
    const publishedAt = validTimestamp(item.publishedDate);
    const idBase = String(item.id || `LIVE-E${index + 1}`);
    let id = idBase;
    let suffix = 2;
    while (seen.has(id)) id = `${idBase}-${suffix++}`;
    seen.add(id);
    return [{
      id,
      title: String(item.title || "Untitled evidence source").slice(0, 240),
      sourceUrl,
      excerpt: String(item.excerpt || "No excerpt was returned.").slice(0, 1_600),
      capturedAt,
      ...(publishedAt ? { publishedAt } : {}),
      sourceType,
      subject: role.subject,
      roleResolution: role.reason,
      independenceGroup: host,
      reviewState: "UNREVIEWED",
      directness: item.captureMethod === "TAVILY_EXTRACT" ? 0.75 : sourceType === "UPLOADED_BUSINESS_PLAN" ? 0.55 : 0.35,
      entityMatchConfidence: sourceType === "STARTUP_PRIMARY" ? 0.88 : Number.isFinite(item.relevance) ? Math.max(0.35, Math.min(0.82, Number(item.relevance))) : 0.5
    }];
  });
}

export function mapSourceType(item, host) {
  if (item.sourceType === "FOUNDER_PROVIDED_DOCUMENT") return "UPLOADED_BUSINESS_PLAN";
  if (item.sourceType === "FIRST_PARTY") return "STARTUP_PRIMARY";
  if (item.sourceType === "SOCIAL_PROFILE") return "SOCIAL_PROFILE";
  if (item.sourceType === "COMPANY_DATABASE") return "INDUSTRY_REPORT";
  if (item.sourceType === "INCUMBENT_PRIMARY") return "INCUMBENT_PRIMARY";
  if (item.sourceType === "REPUTABLE_NEWS") return "REPUTABLE_NEWS";
  if (item.sourceType === "INDUSTRY_REPORT") return "INDUSTRY_REPORT";
  if (item.sourceType === "ACADEMIC_RESEARCH") return "INDEPENDENT_TECHNICAL";
  if (/(^|\.)(gov|gov\.[a-z]{2}|europa\.eu)$/.test(host)) return "GOVERNMENT_OR_REGULATORY";
  if (/(^|\.)(patents\.google\.com|patentscope\.wipo\.int)$/.test(host)) return "PATENT";
  return "SEARCH_SNIPPET";
}

const ACADEMIC_RESEARCH_TEXT = /\b(?:abstract|clinical trial|cohort study|controlled trial|doi|experimental|experiment|journal|meta-analysis|methods?|peer[- ]reviewed|preprint|randomi[sz]ed|research(?:ers)?|results?|study|systematic review|technical paper)\b/i;
const INCUMBENT_ENTITY_TEXT = /\b(?:annual report|business|company|corporation|corp\.?|earnings|enterprise|factory operator|form 10-k|health system|hospital(?: system)?|inc\.?|industry|investor relations|large manufacturer|manufacturer|operator|plc|procurement organization|provider network)\b/i;
const INCUMBENT_PAIN_TEXT = /\b(?:bottleneck|capacity constraint|challenge|compliance|cost|downtime|failure|inefficien|labor shortage|operational|procurement|reimbursement|risk|scrap|shortage|spending|unmet need|workforce)\b/i;

function normalizedRoleText(value) {
  return ` ${String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")} `;
}

function hasNamedRoleMatch(text, value) {
  const normalized = normalizedRoleText(value).trim();
  return normalized.length >= 3 && text.includes(` ${normalized} `);
}

function resolveSubjectRole(item, sourceType, { companyName = "", founderNames = [] } = {}) {
  if (sourceType === "UPLOADED_BUSINESS_PLAN") return { subject: "STARTUP", reason: "SOURCE_OWNERSHIP" };
  if (sourceType === "STARTUP_PRIMARY") return { subject: "STARTUP", reason: "SOURCE_OWNERSHIP" };
  const rawText = `${item.title || ""} ${item.excerpt || ""}`;
  const text = normalizedRoleText(rawText);
  const companyMatch = hasNamedRoleMatch(text, companyName);
  const founderMatch = founderNames.some((name) => hasNamedRoleMatch(text, name));
  if (sourceType === "SOCIAL_PROFILE") {
    if (founderMatch) return { subject: "FOUNDER", reason: "FOUNDER_IDENTITY_MATCH" };
    if (companyMatch) return { subject: "STARTUP", reason: "STARTUP_IDENTITY_MATCH" };
    return { subject: "OTHER", reason: "UNRESOLVED" };
  }
  // Search-track intent is provenance, not source identity. Any result centered
  // on the assessed entity stays on the startup/founder side of a comparison.
  if (companyMatch) return { subject: "STARTUP", reason: "STARTUP_IDENTITY_MATCH" };
  if (founderMatch) return { subject: "FOUNDER", reason: "FOUNDER_IDENTITY_MATCH" };
  if (sourceType === "INDEPENDENT_TECHNICAL" && ACADEMIC_RESEARCH_TEXT.test(rawText)) {
    return { subject: "ACADEMIC", reason: "ACADEMIC_SOURCE_AND_RESEARCH_TEXT" };
  }
  if (sourceType === "PATENT") return { subject: "TECHNICAL", reason: "SOURCE_OWNERSHIP" };
  if (sourceType === "GOVERNMENT_OR_REGULATORY") return { subject: "REGULATORY", reason: "SOURCE_OWNERSHIP" };
  if (INCUMBENT_ENTITY_TEXT.test(rawText) && INCUMBENT_PAIN_TEXT.test(rawText)) {
    return { subject: "INCUMBENT", reason: "INCUMBENT_ENTITY_AND_PAIN_TEXT" };
  }
  return { subject: "OTHER", reason: "UNRESOLVED" };
}

export function mapSubject(item, sourceType, subjectContext = {}) {
  return resolveSubjectRole(item, sourceType, subjectContext).subject;
}

export function scoreEvidencePreview(evidence, asOf) {
  return computeLiveEvidenceQuality(evidence, asOf);
}
