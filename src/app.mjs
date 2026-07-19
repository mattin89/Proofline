import {
  AXES,
  DECISION_LABELS,
  computeCaseFromState,
  evidenceQuality,
  nextEvent,
  replayEvents
} from "./domain.mjs";
import { DEMO_TRANSITIONS, SEED_EVENTS } from "./seed.mjs";
import {
  bindLiveWorkspace,
  createDemoReadyLiveWorkspaceState,
  renderLiveWorkspace
} from "./live-workspace.mjs?v=20260719.5";
import {
  DEFAULT_CHECK_POLICY,
  calculatePolicyCheck,
  validateCheckPolicy
} from "./investment-policy.mjs";
import {
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS,
  QUEUE_NEXT_ACTIONS,
  latestCheckApproval,
  projectLiveQueue,
  projectQueueNextAction,
  recordNonBindingCheckApproval,
  setQueueNextAction
} from "./live-queue.mjs";
import {
  SCORED_PIPELINE_CAPTURED_ON,
  SCORED_PIPELINE_LEADS,
  SCORED_PIPELINE_TOTAL_REPORTED_CREDITS
} from "./sourced-pipeline-v2.mjs";
import {
  simulatedWorkflowActionForLead
} from "./team-activity-v2.mjs";
import {
  projectRecordedCheckActivity,
  projectTeamActivity
} from "./team-activity-v4.mjs";
import {
  CHECK_OUTREACH_ACTIONS,
  prepareCheckOutreach,
  projectCheckOutreach,
  recordCheckOutreachAction,
  recordCheckRecipientResponse
} from "./check-outreach-v1.mjs";
import {
  createSavedTrendsProfile,
  deserializeSavedTrendsProfile,
  serializeSavedTrendsProfile
} from "./saved-trends-v1.mjs";
const STORAGE_KEY = "proofline.events.v3.0";
const POLICY_STORAGE_KEY = "proofline.check-policy.v2";
const SAVED_TRENDS_STORAGE_KEY = "proofline.saved-trends.profile.v1";
const root = document.getElementById("app");

function createInitialLiveState() {
  const live = createDemoReadyLiveWorkspaceState();
  live.savedTrendsProfile = loadSavedTrendsProfile();
  return live;
}

function loadSavedTrendsProfile() {
  try {
    const stored = localStorage.getItem(SAVED_TRENDS_STORAGE_KEY);
    if (stored) return deserializeSavedTrendsProfile(stored);
  } catch {
    // A corrupt or blocked local profile fails closed to a fresh empty watchlist.
  }
  return createSavedTrendsProfile({ profileId: "Mario", createdAt: new Date().toISOString() });
}

function persistSavedTrendsProfile(profile) {
  try {
    localStorage.setItem(SAVED_TRENDS_STORAGE_KEY, serializeSavedTrendsProfile(profile));
  } catch {
    showNotice("This browser blocked saved-trend persistence; the current session still keeps the watchlist.", "warning");
  }
}

const ui = {
  view: "research",
  caseTab: "overview",
  queueCaseTab: "overview",
  queueDetailId: null,
  selectedOpportunityId: "SYN-C001",
  selectedClaimId: "NUR-C01",
  replaySeq: null,
  tavily: { configured: false, provider: null, exaConfigured: false, checked: false },
  live: createInitialLiveState(),
  investmentPolicy: loadInvestmentPolicy(),
  liveResearch: {},
  approvalChecks: new Set(),
  reviewer: "Mario",
  approvalRationale: "",
  outreachContactSelection: {},
  outreachDrafts: {},
  notice: null
};

let events = loadEvents();

function loadEvents() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(SEED_EVENTS);
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed[0]?.type !== "DATASET_INITIALIZED") {
      return structuredClone(SEED_EVENTS);
    }
    replayEvents(parsed);
    return parsed;
  } catch {
    return structuredClone(SEED_EVENTS);
  }
}

function loadInvestmentPolicy() {
  try {
    const stored = localStorage.getItem(POLICY_STORAGE_KEY);
    return stored ? { ...validateCheckPolicy(JSON.parse(stored)) } : { ...DEFAULT_CHECK_POLICY };
  } catch {
    return { ...DEFAULT_CHECK_POLICY };
  }
}

function persistInvestmentPolicy() {
  try {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(ui.investmentPolicy));
  } catch {
    showNotice("This browser blocked policy persistence; the current session still uses the new settings.", "warning");
  }
}

function persistEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    showNotice("This browser blocked local persistence; the current session still works.", "warning");
  }
}

function fullState() {
  return replayEvents(events);
}

function visibleState() {
  return replayEvents(events, ui.replaySeq ?? Infinity);
}

function commit(type, payload, actor = { kind: "HUMAN", id: ui.reviewer || "Human reviewer" }) {
  const event = nextEvent(events, type, payload, actor);
  const candidateEvents = [...events, event];
  replayEvents(candidateEvents);
  events = candidateEvents;
  persistEvents();
  ui.replaySeq = null;
  render();
  return event;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function fmtTime(value) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function fmtDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date not established";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function fmtMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function fmtPct(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function sentenceCase(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function statusPill(label, tone = "neutral") {
  return `<span class="pill pill-${tone}">${esc(label)}</span>`;
}

function decisionTone(code) {
  if (code === "RECOMMEND" || code === "FINALIZED") return "positive";
  if (code === "PASS" || code === "HUMAN_HOLD") return "negative";
  if (code === "REQUEST_PROOF" || code === "INVESTIGATE") return "warning";
  return "neutral";
}

function trustTone(status) {
  if (status === "SUPPORTED") return "positive";
  if (status === "CONTESTED" || status === "REFUTED") return "negative";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

function axisTone(axis) {
  if (!Number.isFinite(axis.score)) return "neutral";
  if (axis.score >= 70 && axis.confidence >= 0.55) return "positive";
  if (axis.score < 45 && axis.confidence >= 0.55) return "negative";
  return "warning";
}

function showNotice(message, tone = "positive") {
  ui.notice = { message, tone };
  render();
  window.setTimeout(() => {
    if (ui.notice?.message === message) {
      ui.notice = null;
      render();
    }
  }, 3500);
}

async function copyTextForUser(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
}

function renderAtTop() {
  render();
  window.scrollTo(0, 0);
}

function caseFor(state, opportunityId = ui.selectedOpportunityId) {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  return opportunity ? computeCaseFromState(state, opportunity) : null;
}

function progressBar(value, tone = "neutral", label = "") {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="progress" role="progressbar" aria-valuenow="${bounded}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}">
      <span class="progress-fill progress-${tone}" style="width:${bounded}%"></span>
    </div>`;
}

function captureFocusState() {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement) || !root.contains(element)) return null;
  if (element.id) {
    return {
      kind: "id",
      value: element.id,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd
    };
  }
  const attributes = [
    "data-view",
    "data-tab",
    "data-claim-id",
    "data-select-opportunity",
    "data-approval-check",
    "data-replay-seq",
    "data-live-mode",
    "data-live-candidate",
    "data-live-assessment",
    "data-live-score-mode",
    "data-live-review",
    "data-reset-demo",
    "name"
  ];
  for (const attribute of attributes) {
    if (!element.hasAttribute(attribute)) continue;
    const value = element.getAttribute(attribute);
    const peers = [...document.querySelectorAll(`[${attribute}]`)].filter(
      (item) => item.getAttribute(attribute) === value
    );
    return { kind: "attribute", attribute, value, index: peers.indexOf(element) };
  }
  return null;
}

function restoreFocusState(state) {
  if (!state) return;
  let element = null;
  if (state.kind === "id") {
    element = document.getElementById(state.value);
  } else {
    const peers = [...document.querySelectorAll(`[${state.attribute}]`)].filter(
      (item) => item.getAttribute(state.attribute) === state.value
    );
    element = peers[Math.max(0, state.index)] || peers[0] || null;
  }
  if (!(element instanceof HTMLElement)) return;
  element.focus({ preventScroll: true });
  if (
    typeof element.setSelectionRange === "function" &&
    Number.isInteger(state.selectionStart) &&
    Number.isInteger(state.selectionEnd)
  ) {
    element.setSelectionRange(state.selectionStart, state.selectionEnd);
  }
}

function render() {
  const focusState = captureFocusState();
  let state;
  try {
    state = visibleState();
  } catch (error) {
    root.innerHTML = `<main class="fatal"><h1>Proofline could not replay the decision log</h1><p>${esc(error.message)}</p></main>`;
    return;
  }

  if (!state.opportunities.some((item) => item.id === ui.selectedOpportunityId)) {
    ui.selectedOpportunityId = state.opportunities[0]?.id;
  }
  const selectedCase = caseFor(state);
  const maxSeq = Math.max(...events.map((event) => event.seq));
  const teamActivityCount = projectTeamActivity(ui.live).length;

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand-block">
          <div class="brand-mark" aria-hidden="true">P</div>
          <div><strong>Proofline</strong><span>Cross-validated venture evidence</span></div>
        </div>
        <nav class="nav-list">
          ${navButton("research", "Live research", ui.live.assessments.length || (ui.tavily.configured ? "LIVE" : "OFF"))}
          ${navButton("team", "Team Activity", teamActivityCount)}
          ${navButton("queue", "Queue", projectLiveQueue(ui.live, SCORED_PIPELINE_LEADS).length)}
          ${navButton("thesis", "Thesis", `v${state.thesis.version}`)}
          ${navButton("settings", "Check settings", ui.investmentPolicy.mode === "FIXED" ? fmtMoney(ui.investmentPolicy.fixedAmount, ui.investmentPolicy.currency) : "DYNAMIC")}
        </nav>
        <div class="sidebar-foot">
          <div class="service-status">
            <span class="status-dot ${ui.tavily.configured ? "online" : "offline"}" aria-hidden="true"></span>
            <span>${ui.tavily.configured ? (ui.tavily.exaConfigured ? "Tavily + Exa ready" : "Tavily ready") : "Offline demo mode"}</span>
          </div>
          <div class="sidebar-snapshot"><span>Scored snapshot</span><strong>${esc(SCORED_PIPELINE_CAPTURED_ON)}</strong></div>
        </div>
      </aside>

      <div class="workspace">
        ${renderWorkspaceTopbar(state, selectedCase)}

        <main class="main-content">
          ${ui.replaySeq != null ? historicalBanner(ui.replaySeq, maxSeq) : ""}
          ${renderView(state)}
        </main>
      </div>
      ${ui.notice ? `<div class="toast toast-${esc(ui.notice.tone)}" role="status">${esc(ui.notice.message)}</div>` : ""}
    </div>`;

  bindGlobalEvents();
  bindViewEvents(state);
  restoreFocusState(focusState);
}

function renderWorkspaceTopbar(state, selectedCase) {
  if (["research", "team", "queue", "thesis", "settings"].includes(ui.view)) {
    return `<header class="topbar live-topbar">
      <div class="live-banner"><span>${ui.tavily.configured ? "LIVE" : "LOCAL"}</span> ${ui.tavily.configured ? "Public web and authorized document evidence" : "Authorized document parsing; web research not configured"}</div>
      <div class="deadline-block" aria-label="Live research provider status"><span>Providers</span><strong>${esc(ui.tavily.exaConfigured ? "Tavily + Exa" : ui.tavily.provider || "Not configured")}</strong></div>
    </header>`;
  }
  return `<header class="topbar">
    <div class="synthetic-banner"><span>SIMULATION</span> ${esc(state.watermark)}</div>
    <div class="deadline-block" aria-label="24-hour decision clock"><span>24h clock</span><strong>${selectedCase ? formatRemaining(selectedCase.opportunity.elapsedMinutes) : "—"}</strong></div>
    <button class="button button-small compact-reset" data-reset-demo type="button">Reset fixtures</button>
  </header>`;
}

function navButton(view, label, count) {
  const active = ui.view === view;
  return `
    <button class="nav-item ${active ? "active" : ""}" data-view="${view}" type="button" ${active ? 'aria-current="page"' : ""}>
      <span>${esc(label)}</span>${count != null ? `<small>${esc(count)}</small>` : ""}
    </button>`;
}

function formatRemaining(elapsedMinutes = 0) {
  const remaining = Math.max(0, 24 * 60 - elapsedMinutes);
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
}

function historicalBanner(sequence, maxSeq) {
  return `
    <div class="historical-banner">
      <div><strong>Historical replay</strong><span>Viewing the state after event ${sequence} of ${maxSeq}. Later evidence is hidden.</span></div>
      <button class="button button-small" id="return-current" type="button">Return to current</button>
    </div>`;
}

function renderView(state) {
  if (ui.view === "research") return renderLiveWorkspace({ live: ui.live, thesis: state.thesis, tavily: ui.tavily, investmentPolicy: ui.investmentPolicy });
  if (ui.view === "team") return renderTeamActivity();
  if (ui.view === "settings") return renderCheckSettings();
  if (ui.view === "queue") return renderQueue();
  if (ui.view === "thesis") return renderThesis(state);
  return renderQueue();
}

function teamInitials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2);
}

function publicContactsForRecord(item, approval = null) {
  const contacts = approval?.opportunitySnapshot?.publicContacts || item?.publicContacts || [];
  return Array.isArray(contacts)
    ? contacts.filter((contact) => contact?.publicProfessional === true)
    : [];
}

function contactChannelLabel(channel) {
  return ({
    OFFICIAL_WEBSITE: "Official website",
    CONTACT_PAGE: "Contact page",
    BUSINESS_EMAIL: "Business email",
    BUSINESS_PHONE: "Business phone",
    LINKEDIN: "LinkedIn",
    PUBLIC_SOCIAL_PROFILE: "Public social profile"
  })[channel] || sentenceCase(channel || "Public channel");
}

function contactHref(contact) {
  const value = String(contact?.value || "").trim();
  if (contact?.channel === "BUSINESS_EMAIL" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (contact?.channel === "BUSINESS_PHONE" && /^\+?[0-9().\-\s]{7,30}$/.test(value)) return `tel:${value.replace(/[^+0-9]/g, "")}`;
  return safeUrl(value) === "#" ? null : safeUrl(value);
}

function bestPublicContact(contacts) {
  const priority = ["BUSINESS_EMAIL", "CONTACT_PAGE", "LINKEDIN", "BUSINESS_PHONE", "PUBLIC_SOCIAL_PROFILE", "OFFICIAL_WEBSITE"];
  const rank = (channel) => {
    const index = priority.indexOf(channel);
    return index === -1 ? priority.length : index;
  };
  return [...contacts].sort((left, right) => rank(left.channel) - rank(right.channel))[0] || null;
}

function outreachForRecord(recordId) {
  return projectRecordedCheckActivity(ui.live).find((item) => item.recordId === recordId)?.outreach || null;
}

function outreachStatusMarkup(outreach, compact = false) {
  if (!outreach?.status) return "";
  return `<span class="outreach-status outreach-status-${esc(outreach.status.tone || "neutral")}${compact ? " outreach-status-compact" : ""}">${esc(outreach.status.label)}</span>`;
}

function renderQueuePublicContactProfiles(item) {
  const contacts = publicContactsForRecord(item);
  const subjects = [
    { type: "STARTUP", name: item.companyName, label: "Startup profile" },
    ...(item.founderNames || []).map((name) => ({ type: "FOUNDER", name, label: "Founder profile" }))
  ];
  return `<article class="surface queue-contact-profiles"><div class="surface-heading"><div><p class="eyebrow">Public professional contacts</p><h2>Startup and founder contact profiles</h2><p>Channels are retained only when they were explicitly public and source-linked. Open the source to verify the current details before outreach.</p></div>${statusPill(contacts.length ? `${contacts.length} channel${contacts.length === 1 ? "" : "s"}` : "Coverage unknown", contacts.length ? "positive" : "warning")}</div><div class="queue-contact-profile-grid">${subjects.map((subject) => {
    const matching = contacts.filter((contact) => contact.subjectType === subject.type && contact.subjectName === subject.name);
    return `<section class="queue-contact-profile"><span>${esc(subject.label)}</span><h3>${esc(subject.name)}</h3>${matching.length ? matching.map((contact) => { const href = contactHref(contact); const sourceUrl = safeUrl(contact.sourceUrl); const external = href?.startsWith("http") ? ' target="_blank" rel="noreferrer"' : ""; return `<div class="queue-contact-row"><div><strong>${esc(contactChannelLabel(contact.channel))}</strong><small>${esc(contact.value)}</small></div><div>${href ? `<a href="${esc(href)}"${external}>Use channel</a>` : ""}${sourceUrl !== "#" ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noreferrer">Verify ↗</a>` : ""}</div></div>`; }).join("") : `<p>No public professional channel retained. Refresh current web evidence to check again.</p>`}</section>`;
  }).join("")}</div><div class="public-contact-boundary"><strong>Privacy boundary</strong><span>No guessed emails, private phone numbers, credentialed pages, or login-wall bypasses.</span></div></article>`;
}

function renderSimulatedTeamActivityCard(item) {
  return `<article class="surface team-activity-card">
    <div class="team-person"><span aria-hidden="true">${esc(teamInitials(item.colleagueName))}</span><div><strong>${esc(item.colleagueName)}</strong><small>${esc(item.colleagueRole)} · simulated persona</small></div>${statusPill("Demo colleague", "warning")}</div>
    <div class="team-company"><div><p class="eyebrow">${esc(item.sector)} · ${esc(sentenceCase(item.stage))}</p><h2>${esc(item.companyName)}</h2><small>Real founders · ${esc(item.founderNames.join(", "))}</small></div><strong>${esc(item.engineScore)} / 100<small>provisional engine score</small></strong></div>
    <div class="team-demo-values"><div><span>Simulated invested amount</span><strong>${fmtMoney(item.simulatedInvestmentAmount, item.simulatedInvestmentCurrency)}</strong><small>Deterministic score band · not committed capital</small></div><div><span>Simulated action</span><strong>${esc(item.workflowAction.label)}</strong><small>Demo workflow only</small></div></div>
    <p class="team-fact"><strong>Real public record</strong> ${esc(item.fundingAsReported)} · ${esc(item.researchId)} · ${esc(item.coveragePercentage)}% coverage · ±${esc(item.uncertaintyPoints)} uncertainty points.</p>
    <div class="public-activity-sources">${item.evidence.slice(0, 3).map((source) => `<a href="${esc(safeUrl(source.url || source.sourceUrl))}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}</div>
  </article>`;
}

function renderRecordedCheckActivityCard(item) {
  const approval = item.checkApproval;
  const outreach = item.outreach;
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  const founders = item.founderNames?.length ? item.founderNames.join(", ") : "Founder identity not established";
  const score = Number.isFinite(item.engineScore) ? `${item.engineScore} / 100` : "Not scored";
  const risk = Number.isFinite(approval.riskIndex)
    ? `${sentenceCase(approval.riskBand || "RISK_RECORDED")} · ${approval.riskIndex} / 100`
    : approval.riskBand === "FIXED"
      ? "Fixed sizing · no risk adjustment"
      : "No risk index retained";
  const acknowledgementCount = Array.isArray(approval.acknowledgements) ? approval.acknowledgements.length : 0;
  return `<article class="surface team-activity-card team-activity-card-current-user">
    <div class="team-person"><span aria-hidden="true">${esc(teamInitials(item.colleagueName))}</span><div><strong>${esc(item.colleagueName)}</strong><small>You · check reviewer</small></div>${statusPill("Your recorded check", "positive")}</div>
    <div class="team-company"><div><p class="eyebrow">${esc(item.sector)} · ${esc(sentenceCase(item.stage))}</p><h2>${esc(item.companyName)}</h2><small>Startup founders · ${esc(founders)}</small></div><strong>${esc(score)}<small>${esc(sentenceCase(item.scoreMode || "REVIEWED"))} engine score</small></strong></div>
    <div class="team-recorded-check-values">
      <div><span>Approved non-binding amount</span><strong>${fmtMoney(approval.amount, approval.currency)}</strong><small>No capital reserved or transferred</small></div>
      <div><span>Activity</span><strong>${esc(item.workflowAction.label)}</strong><small>${esc(fmtTime(approval.occurredAt))}</small></div>
      <div><span>Policy snapshot</span><strong>${esc(sentenceCase(approval.mode))}</strong><small>${esc(approval.policyVersion)}</small></div>
      <div><span>Risk at approval</span><strong>${esc(risk)}</strong><small>${acknowledgementCount} required acknowledgement${acknowledgementCount === 1 ? "" : "s"} retained</small></div>
    </div>
    <div class="team-outreach-summary"><div><span>Check outreach</span>${outreachStatusMarkup(outreach)}<small>${outreach?.selectedContact ? `${contactChannelLabel(outreach.selectedContact.channel)} · ${outreach.selectedContact.subjectName}` : "Choose a sourced public professional channel in Queue"}</small></div><div><span>Recipient response</span><strong>${outreach?.recipientResponse ? esc(sentenceCase(outreach.recipientResponse)) : "Not contacted"}</strong><small>This field exists only after the check approval above.</small></div></div>
    <p class="team-fact"><strong>Reviewed public record</strong> ${esc(item.fundingAsReported)} · ${esc(item.researchId)} · ${esc(item.coveragePercentage)}% coverage · ±${esc(item.uncertaintyPoints)} uncertainty points.</p>
    <p class="team-approval-rationale"><strong>Approval rationale</strong>${esc(approval.rationale)}</p>
    <div class="public-activity-sources">${evidence.slice(0, 3).map((source) => `<a href="${esc(safeUrl(source.url || source.sourceUrl))}" target="_blank" rel="noreferrer">${esc(source.title || "Retained public source")} ↗</a>`).join("")}${evidence.length > 3 ? `<small>${esc(evidence.length)} retained sources · open the approved check for the complete ledger.</small>` : ""}</div>
    <div class="approval-safety-flags" aria-label="Non-binding check safeguards"><span>Binding: No</span><span>Funds reserved: No</span><span>Transfer authorized: No</span></div>
    <div class="team-recorded-check-actions"><small>Recorded from the immutable session approval · no capital was deployed</small><button class="button button-primary" data-open-recorded-check="${esc(item.recordId)}" type="button">Manage check & outreach</button></div>
  </article>`;
}

function renderTeamActivity() {
  const activity = projectTeamActivity(ui.live);
  const recorded = projectRecordedCheckActivity(ui.live);
  const demoCount = activity.length - recorded.length;
  const sectors = new Set(activity.map((item) => item.sector)).size;
  return `<section class="page-heading">
      <div><p class="eyebrow">Shared portfolio activity</p><h1>Team Activity</h1><p>${recorded.length ? `${recorded.length} recorded non-binding check approval${recorded.length === 1 ? "" : "s"} from this session, followed by ${demoCount} clearly simulated colleague record${demoCount === 1 ? "" : "s"}.` : `${demoCount} real seed-stage companies and founders joined to clearly simulated colleague activity for the demo.`}</p></div>
      ${statusPill(recorded.length ? `${recorded.length} recorded · ${demoCount} demo` : "Real evidence · simulated team", recorded.length ? "positive" : "warning")}
    </section>
    <section class="team-disclosure surface"><strong>Activity boundary</strong><p>Entries marked “You” come directly from immutable, session-local non-binding check approvals. Their outreach value appears only after approval and distinguishes approved-to-contact, contacted, accepted, and declined states. The five colleague names, roles, invested amounts, and workflow actions remain simulated. No entry states that capital was reserved, transferred, or deployed.</p></section>
    <section class="summary-grid" aria-label="Team Activity summary">
      ${summaryCard("Activity records", activity.length, `${recorded.length} recorded check${recorded.length === 1 ? "" : "s"} · ${demoCount} demo colleague${demoCount === 1 ? "" : "s"}`)}
      ${summaryCard("Fields", sectors, "Sectors represented across current activity")}
      ${summaryCard("Fresh-search credits", SCORED_PIPELINE_TOTAL_REPORTED_CREDITS, `Provider-reported Tavily credits in the stored score pass captured ${SCORED_PIPELINE_CAPTURED_ON}`)}
    </section>
    <section class="team-activity-grid" aria-label="Recorded check approvals and simulated colleague activity linked to real companies">
      ${activity.map((item) => item.simulation ? renderSimulatedTeamActivityCard(item) : renderRecordedCheckActivityCard(item)).join("")}
    </section>`;
}

function renderCheckSettings() {
  const policy = ui.investmentPolicy;
  const fixed = policy.mode === "FIXED";
  const currencyOptions = ["USD", "EUR", "CHF", "GBP"].map((currency) => `<option value="${currency}" ${policy.currency === currency ? "selected" : ""}>${currency}</option>`).join("");
  const incrementOptions = [5_000, 10_000, 25_000, 50_000].map((value) => `<option value="${value}" ${policy.increment === value ? "selected" : ""}>${fmtMoney(value, policy.currency)}</option>`).join("");
  return `<section class="page-heading">
      <div><p class="eyebrow">Live-assessment investment policy</p><h1>Configure check sizing</h1><p>This policy drives Live research assessments. Eligibility is noncompensatory and evidence-gated; sizing never uses founder pedigree, popularity, protected traits, or missing public footprint.</p></div>
      ${statusPill(fixed ? "Fixed check" : "Risk adjusted", fixed ? "positive" : "warning")}
    </section>
    <form class="surface check-settings-form" id="check-policy-form">
      <div class="surface-heading"><div><h2>Check policy</h2><p>The default is a fixed $100K check. Turn on Dynamic check to enable and edit evidence-gated risk sizing.</p></div><span class="policy-version">proofline.check-sizing.v1</span></div>
      <label class="dynamic-check-toggle" for="dynamic-check-toggle"><span><strong>Dynamic check</strong><small>${fixed ? "Off · eligible opportunities use the fixed check" : "On · eligible opportunities use the editable risk bands below"}</small></span><input id="dynamic-check-toggle" name="dynamicEnabled" type="checkbox" ${fixed ? "" : "checked"} role="switch" aria-checked="${!fixed}" /><i aria-hidden="true"></i></label>
      <div class="settings-grid">
        <label class="field"><span>Currency</span><select name="currency">${currencyOptions}</select></label>
        <label class="field"><span>Fixed eligible check</span><input name="fixedAmount" type="number" min="${policy.increment}" max="10000000" step="${policy.increment}" value="${policy.fixedAmount}" ${fixed ? "" : "disabled"} /></label>
        <label class="field"><span>Rounding increment</span><select name="increment">${incrementOptions}</select></label>
        <label class="field"><span>Dynamic base amount</span><input data-dynamic-check-field name="baseAmount" type="number" min="${policy.increment}" max="10000000" step="${policy.increment}" value="${policy.baseAmount}" ${fixed ? "disabled" : ""} /></label>
        <label class="field"><span>Dynamic minimum</span><input data-dynamic-check-field name="minimumAmount" type="number" min="${policy.increment}" max="10000000" step="${policy.increment}" value="${policy.minimumAmount}" ${fixed ? "disabled" : ""} /></label>
        <label class="field"><span>Dynamic maximum</span><input data-dynamic-check-field name="maximumAmount" type="number" min="${policy.increment}" max="10000000" step="${policy.increment}" value="${policy.maximumAmount}" ${fixed ? "disabled" : ""} /></label>
      </div>
      <section class="policy-explainer">
        <div><strong>${fixed ? "Fixed policy active" : "Risk-adjusted policy active"}</strong><span>${fixed ? `Every opportunity clearing the same gates is policy-eligible for ${fmtMoney(policy.fixedAmount, policy.currency)}.` : "Risk index = 40% product risk + 35% commercial risk + 25% market risk. Founder evidence is a gate, never an amount multiplier."}</span></div>
        <ol><li>Risk ≤ 30: 100% of base</li><li>30–42: 75% of base</li><li>42–55: 50% of base</li></ol>
      </section>
      <div class="settings-boundary"><strong>Non-binding by construction</strong><p>No policy output authorizes a transfer, reserves capital, infers valuation, or replaces investment-committee, legal, financial, and terms diligence.</p></div>
      <div class="form-actions"><button class="button button-primary" type="submit">Save check policy</button></div>
    </form>`;
}

function renderQueue() {
  const items = projectLiveQueue(ui.live, SCORED_PIPELINE_LEADS);
  const detail = items.find((item) => item.id === ui.queueDetailId) || null;
  if (detail) return renderRealQueueCase(detail);
  const selected = items.find((item) => item.id === ui.live.selectedQueueId) || items[0] || null;
  const actionCounts = items.reduce((counts, item) => {
    const action = queueWorkflowAction(item);
    counts[action.code] = (counts[action.code] || 0) + 1;
    return counts;
  }, {});
  const retrievedSources = items.reduce((sum, item) => sum + (item.engineSnapshot?.sourceCount || 0), 0);
  return `<section class="page-heading">
      <div><p class="eyebrow">Real-company evidence workbench</p><h1>Investment queue</h1><p>Real seed-stage startups and founders, frozen engine scores, coverage gaps, and source trails in one review surface.</p></div>
      <div class="case-actions"><button class="button" id="open-live-discovery" type="button">Discover real startups</button><button class="button button-primary" id="open-live-investigation" type="button">Analyze a startup</button></div>
    </section>
    <section class="queue-data-boundary surface"><strong>Real evidence · editable workflow · policy gates kept separate</strong><p>Five companies use frozen Tavily score passes. Emovo Care's real, reviewed public-source pack stays ready in Session assessments until you add it for the demo; refreshing resets that demo Queue insertion. Public professional contacts retain their sources. Contact and recipient-response values appear only after a genuine check approval; “Policy screen eligible” never approves capital by itself.</p></section>
    <section class="summary-grid" aria-label="Real queue summary">
      ${summaryCard("Request evidence", actionCounts.REQUEST_EVIDENCE || 0, "Simulated next actions")}
      ${summaryCard("Pass thesis", actionCounts.PASS_CURRENT_THESIS || 0, "Simulated next actions")}
      ${summaryCard("Policy screen", actionCounts.POLICY_SCREEN_ELIGIBLE || 0, `${retrievedSources} real sources searched`)}
    </section>
    <section class="split-layout queue-layout real-queue-layout">
      <div class="surface table-surface">
        <div class="surface-heading"><div><h2>Current real-company queue</h2><p>Scores are provisional automated outputs. Missing public evidence lowers coverage and increases uncertainty; it is not a negative founder judgment.</p></div>${statusPill(`${items.length} real companies`, "positive")}</div>
        <div class="table-wrap"><table class="data-table queue-table real-queue-table">
          <caption class="sr-only">Real startups and founders with simulated workflow actions</caption>
          <thead><tr><th scope="col">Founder / company</th><th scope="col">Search path</th><th scope="col">Score</th><th scope="col">Coverage / open questions</th><th scope="col">Stage</th><th scope="col">Next action</th></tr></thead>
          <tbody>${items.map((item) => realQueueRow(item, selected?.id === item.id)).join("")}</tbody>
        </table></div>
      </div>
      ${selected ? renderRealQueueInspector(selected) : ""}
    </section>`;
}

function realQueueRow(item, selected) {
  const assessed = item.recordType === "LIVE_ASSESSMENT";
  const score = item.engineSnapshot?.opportunityScore;
  const action = queueWorkflowAction(item);
  const openQuestions = item.unknowns?.length || 0;
  const actionOrigin = action.origin === "HUMAN_EDITED" ? "Human-edited session action" : action.origin === "CURATED_DEMO_DEFAULT" ? "Curated demo action" : "Simulated default";
  const approval = latestCheckApproval(ui.live, item.id);
  const outreach = approval ? outreachForRecord(item.id) : null;
  return `<tr class="selectable-row ${selected ? "selected" : ""}" data-open-queue-case="${esc(item.id)}">
    <td><button class="row-title" type="button" data-open-queue-case="${esc(item.id)}" aria-pressed="${selected}"><strong>${esc(item.founderNames?.join(", ") || "Founder not established")}</strong><span>${esc(item.companyName)} · ${esc(item.summary)}</span></button></td>
    <td><strong>${assessed ? "Session investigation" : "Fresh public-web search"}</strong><small>${esc(item.engineSnapshot?.researchId || "No research ID")} · ${esc(item.engineSnapshot?.sourceCount || item.evidence?.length || 0)} sources</small></td>
    <td><strong>${Number.isFinite(score) ? `${esc(score)} / 100` : "Not scored"}</strong><small>${esc(item.engineSnapshot?.scoreMode || (assessed ? "SESSION" : "PROVISIONAL"))} · ±${esc(item.engineSnapshot?.uncertaintyPoints ?? "?")}</small></td>
    <td><strong>${esc(item.engineSnapshot?.coveragePercentage ?? 0)}%</strong><small>${esc(openQuestions)} material unknown${openQuestions === 1 ? "" : "s"}</small></td>
    <td>${statusPill(sentenceCase(item.stage), assessed ? "neutral" : "positive")}<small>${esc(item.fundingAsReported)}</small></td>
    <td>${statusPill(action.label, simulatedActionTone(action.code))}<small>${esc(actionOrigin)} · not a policy result</small>${outreachStatusMarkup(outreach, true)}</td>
  </tr>`;
}

function renderRealQueueInspector(item) {
  const assessed = item.recordType === "LIVE_ASSESSMENT";
  const score = item.engineSnapshot?.opportunityScore;
  const action = queueWorkflowAction(item);
  const dimensions = item.engineSnapshot?.dimensions || [];
  const sources = item.evidence?.filter((source) => safeUrl(source.url || source.sourceUrl) !== "#").slice(0, 4) || [];
  const publicContacts = publicContactsForRecord(item);
  const approval = latestCheckApproval(ui.live, item.id);
  const outreach = approval ? outreachForRecord(item.id) : null;
  return `<aside class="surface inspector real-queue-inspector">
    <p class="eyebrow">${assessed ? "Queued live assessment" : "Frozen real-company score"}</p>
    <h2>${esc(item.companyName)}</h2>
    <p class="lead">${esc(item.summary)}</p>
    <div class="queue-score-hero"><div><span>${assessed ? "Reviewed score" : "Provisional score"}</span><strong>${Number.isFinite(score) ? esc(score) : "—"}</strong><small>±${esc(item.engineSnapshot?.uncertaintyPoints ?? "?")} points</small></div>${statusPill(action.label, simulatedActionTone(action.code))}</div>
    ${outreach ? `<div class="queue-outreach-inline"><span>Approved check outreach</span>${outreachStatusMarkup(outreach)}<small>${outreach.selectedContact ? `${esc(contactChannelLabel(outreach.selectedContact.channel))} · ${esc(outreach.selectedContact.subjectName)}` : "Open the case to choose a sourced contact"}</small></div>` : ""}
    <p class="queue-simulation-note"><strong>${action.origin === "HUMAN_EDITED" ? "Session action." : "Demo action."}</strong> ${esc(action.explanation)}</p>
    <dl class="compact-dl">
      <div><dt>Founders</dt><dd>${esc(item.founderNames?.join(", ") || "Not established")}</dd></div>
      <div><dt>Stage</dt><dd>${esc(sentenceCase(item.stage))} · ${esc(item.fundingAsReported)}</dd></div>
      <div><dt>Engine snapshot</dt><dd>${esc(item.engineSnapshot?.researchId || "Not recorded")}</dd></div>
      <div><dt>Coverage</dt><dd>${esc(item.engineSnapshot?.coveragePercentage ?? 0)}% · ${esc(item.engineSnapshot?.sourceCount || sources.length)} sources searched</dd></div>
      <div><dt>Public contacts</dt><dd>${publicContacts.length ? `${esc(publicContacts.length)} sourced channel${publicContacts.length === 1 ? "" : "s"}` : "Not retained · refresh to check"}</dd></div>
    </dl>
    ${dimensions.length ? `<div class="queue-dimensions"><span class="field-label">Engine dimensions</span>${dimensions.map((dimension) => `<div><span>${esc(dimension.label)}</span><strong>${Number.isFinite(dimension.score) ? esc(dimension.score) : "Not covered"}</strong></div>`).join("")}</div>` : ""}
    ${item.unknowns?.length ? `<div class="neutral-callout"><strong>Material unknowns</strong><p>${item.unknowns.slice(0, 4).map(esc).join(" · ")}</p></div>` : ""}
    ${item.productCaveat ? `<div class="neutral-callout"><strong>Current product boundary</strong><p>${esc(item.productCaveat)}</p></div>` : ""}
    ${item.nonEquitySupportAsReported ? `<div class="neutral-callout"><strong>Later non-equity support</strong><p>${esc(item.nonEquitySupportAsReported)}</p></div>` : ""}
    <div class="real-queue-sources"><span class="field-label">Source trail</span>${sources.length ? sources.map((source) => `<a href="${esc(safeUrl(source.url || source.sourceUrl))}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("") : "<small>No public URL retained.</small>"}</div>
    <div class="queue-inspector-actions"><button class="button button-primary button-full" data-open-queue-case="${esc(item.id)}" type="button">Open complete case</button><button class="button button-full" ${assessed ? `data-open-queued-assessment="${esc(item.assessmentId)}"` : `data-investigate-sourced="${esc(item.id)}"`} type="button">${assessed ? "Open evidence assessment" : "Refresh with current web data"}</button></div>
  </aside>`;
}

function queueCaseTabButton(tab, label) {
  const active = ui.queueCaseTab === tab;
  return `<button class="tab ${active ? "active" : ""}" data-queue-case-tab="${esc(tab)}" type="button" ${active ? 'aria-current="page"' : ""}>${esc(label)}</button>`;
}

function renderRealQueueCase(item) {
  const score = item.engineSnapshot?.opportunityScore;
  const action = queueWorkflowAction(item);
  const retained = item.evidence?.length || 0;
  const searched = item.engineSnapshot?.sourceCount || retained;
  const approval = latestCheckApproval(ui.live, item.id);
  const outreach = approval ? outreachForRecord(item.id) : null;
  return `<section class="case-heading queue-case-heading">
      <div><button class="back-link" id="back-to-real-queue" type="button">← Investment queue</button><p class="eyebrow">${esc(item.sector)} · ${esc(sentenceCase(item.stage))}</p><h1>${esc(item.companyName)}</h1><p>${esc(item.founderNames?.join(", ") || "Founder identity not established")} · ${esc(item.summary)}</p></div>
      <div class="case-actions">${statusPill(action.label, simulatedActionTone(action.code))}${outreachStatusMarkup(outreach)}<span class="queue-case-score">${Number.isFinite(score) ? `${esc(score)} / 100` : "Not scored"}<small>${esc(item.engineSnapshot?.scoreMode || "PROVISIONAL")} evidence screen</small></span></div>
    </section>
    <section class="queue-case-boundary surface"><div><strong>Complete stored case</strong><span>${esc(retained)} retained citation${retained === 1 ? "" : "s"} from ${esc(searched)} provider result${searched === 1 ? "" : "s"}; every retained source is available below.</span></div><div><strong>Capital boundary</strong><span>Workflow actions do not alter the score or satisfy policy gates. Any recorded check remains non-binding and transfers no funds.</span></div></section>
    <nav class="tab-list" aria-label="Queue case sections">
      ${queueCaseTabButton("overview", "Overview")}
      ${queueCaseTabButton("score", "Score & comparisons")}
      ${queueCaseTabButton("evidence", `Evidence · ${retained}`)}
      ${queueCaseTabButton("workflow", "Workflow & check")}
    </nav>
    ${ui.queueCaseTab === "score"
      ? renderQueueCaseScore(item)
      : ui.queueCaseTab === "evidence"
        ? renderQueueCaseEvidence(item)
        : ui.queueCaseTab === "workflow"
          ? renderQueueCaseWorkflow(item)
          : renderQueueCaseOverview(item)}`;
}

function renderQueueCaseOverview(item) {
  const assessed = item.recordType === "LIVE_ASSESSMENT";
  const snapshot = item.engineSnapshot || {};
  const verification = item.currentVerification;
  return `<section class="queue-case-grid">
    <div class="queue-case-main">
      <article class="surface queue-case-summary"><div class="surface-heading"><div><p class="eyebrow">Company record</p><h2>${esc(item.companyName)}</h2><p>${esc(item.summary)}</p></div>${statusPill(assessed ? "Queued reviewed assessment" : "Frozen provisional score", assessed ? "positive" : "warning")}</div>
        ${item.context ? `<div class="queue-case-context"><strong>Investigation context</strong><p>${esc(item.context)}</p></div>` : ""}
        <dl class="queue-case-facts">
          <div><dt>Founders</dt><dd>${esc(item.founderNames?.join(", ") || "Not established")}</dd></div>
          <div><dt>Sector</dt><dd>${esc(item.sector || "Not established")}</dd></div>
          <div><dt>Stage</dt><dd>${esc(sentenceCase(item.stage || "NOT_ESTABLISHED"))}</dd></div>
          <div><dt>Financing as reported</dt><dd>${esc(item.fundingAsReported || "Not established")}</dd></div>
          <div><dt>Source date</dt><dd>${esc(item.sourceDate || snapshot.generatedAt?.slice(0, 10) || "Not reported")}</dd></div>
          <div><dt>Verification state</dt><dd>${esc(sentenceCase(item.verificationStatus || "UNREVIEWED"))}</dd></div>
        </dl>
      </article>
      ${renderQueuePublicContactProfiles(item)}
      ${verification?.caveat ? `<article class="surface queue-case-note"><p class="eyebrow">Current-stage verification</p><h2>What the public record does—and does not—establish</h2><p>${esc(verification.caveat)}</p></article>` : ""}
      ${item.productCaveat ? `<article class="surface queue-case-note"><p class="eyebrow">Product boundary</p><h2>Current product status</h2><p>${esc(item.productCaveat)}</p></article>` : ""}
      ${item.nonEquitySupportAsReported ? `<article class="surface queue-case-note"><p class="eyebrow">Non-equity support</p><h2>Later public support</h2><p>${esc(item.nonEquitySupportAsReported)}</p></article>` : ""}
      <article class="surface queue-case-unknowns"><div class="surface-heading"><div><p class="eyebrow">Open diligence</p><h2>${esc(item.unknowns?.length || 0)} material unknown${item.unknowns?.length === 1 ? "" : "s"}</h2><p>Missing public evidence raises uncertainty; it is never treated as an adverse founder fact.</p></div></div>${item.unknowns?.length ? `<ul>${item.unknowns.map((unknown) => `<li>${esc(unknown)}</li>`).join("")}</ul>` : "<p>No material unknown was retained in this snapshot.</p>"}</article>
    </div>
    <aside class="surface queue-case-provenance"><p class="eyebrow">Engine provenance</p><h2>${esc(snapshot.researchId || "No research ID")}</h2><dl class="compact-dl"><div><dt>Provider</dt><dd>${esc(snapshot.provider || "Not recorded")}</dd></div><div><dt>Generated</dt><dd>${esc(fmtTime(snapshot.generatedAt))}</dd></div><div><dt>Provider results</dt><dd>${esc(snapshot.sourceCount || item.evidence?.length || 0)}</dd></div><div><dt>Retained citations</dt><dd>${esc(item.evidence?.length || 0)}</dd></div><div><dt>Evidence mode</dt><dd>${esc(snapshot.scoreMode || "PROVISIONAL")}</dd></div></dl><div class="queue-case-side-actions"><button class="button button-primary button-full" data-queue-case-tab="evidence" type="button">Inspect every source</button><button class="button button-full" ${assessed ? `data-open-queued-assessment="${esc(item.assessmentId)}"` : `data-investigate-sourced="${esc(item.id)}"`} type="button">${assessed ? "Open full evidence assessment" : "Refresh current web evidence"}</button></div></aside>
  </section>`;
}

function renderComparisonCard(label, comparison) {
  if (!comparison) return `<article class="surface queue-comparison-card"><p class="eyebrow">${esc(label)}</p><h2>Not assessed</h2><p>No retained comparison cleared the evidence rules.</p></article>`;
  const citations = Array.isArray(comparison.citations) ? comparison.citations : [];
  return `<article class="surface queue-comparison-card"><div class="surface-heading"><div><p class="eyebrow">${esc(label)}</p><h2>${esc(sentenceCase(comparison.status || "NOT_ASSESSED"))}</h2></div>${Number.isFinite(comparison.score) ? statusPill(`${comparison.score} / 100`, "neutral") : ""}</div>${citations.length ? `<div class="queue-comparison-citations">${citations.map((citation) => { const url = safeUrl(citation.sourceUrl || citation.url); return `<div><strong>${url !== "#" ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(citation.title)} ↗</a>` : esc(citation.title)}</strong><p>${esc(citation.excerpt || "No excerpt retained.")}</p></div>`; }).join("")}</div>` : `<p>${esc(comparison.status === "MISSING" ? "The stored automated pass did not retain enough matched evidence for this comparison." : "The frozen snapshot records the comparison state; open Evidence for the retained source trail.")}</p>`}</article>`;
}

function renderQueueCaseScore(item) {
  const snapshot = item.engineSnapshot || {};
  const score = snapshot.opportunityScore;
  const dimensions = snapshot.dimensions || [];
  const band = snapshot.uncertaintyBand;
  const comparisons = snapshot.comparisons || {};
  return `<section class="queue-score-page">
    <article class="surface queue-score-overview"><div><p class="eyebrow">${esc(snapshot.scoreMode || "PROVISIONAL")} opportunity screen</p><h2>${Number.isFinite(score) ? `${esc(score)} / 100` : "Not scored"}</h2><p>${esc(snapshot.scoreMeaning || "Evidence-weighted automated screen, not a probability of success, valuation, or investment decision.")}</p></div><div class="queue-score-metrics"><div><span>Coverage</span><strong>${esc(snapshot.coveragePercentage ?? 0)}%</strong></div><div><span>Uncertainty</span><strong>±${esc(snapshot.uncertaintyPoints ?? "?")}</strong></div><div><span>Uncertainty band</span><strong>${band && Number.isFinite(band.low) ? `${esc(band.low)}–${esc(band.high)}` : "Not retained"}</strong></div><div><span>Criteria covered</span><strong>${snapshot.totalCriteria ? `${esc(snapshot.coveredCriteria)} / ${esc(snapshot.totalCriteria)}` : "Not retained"}</strong></div></div></article>
    <section class="queue-score-dimensions" aria-label="Score dimensions">${dimensions.map((dimension) => { const coverage = Number(dimension.coverage) <= 1 ? Math.round(Number(dimension.coverage || 0) * 100) : Math.round(Number(dimension.coverage || 0)); const confidence = Number(dimension.confidence) <= 1 ? Math.round(Number(dimension.confidence || 0) * 100) : Math.round(Number(dimension.confidence || 0)); return `<article class="surface queue-score-dimension"><div><span>${esc(dimension.label)}</span><strong>${Number.isFinite(dimension.score) ? esc(dimension.score) : "Not covered"}</strong></div><div class="dimension-bar" role="progressbar" aria-label="${esc(dimension.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number.isFinite(dimension.score) ? esc(dimension.score) : 0}"><span style="width:${Number.isFinite(dimension.score) ? esc(dimension.score) : 0}%"></span></div><small>${esc(coverage)}% coverage · ${esc(confidence)}% confidence</small></article>`; }).join("")}</section>
    <section class="queue-comparison-grid" aria-label="Incumbent and academic comparisons">${renderComparisonCard("Incumbent problem alignment", comparisons.incumbentPain)}${renderComparisonCard("Academic research alignment", comparisons.academicResearch)}</section>
    <aside class="queue-score-boundary"><strong>Interpretation boundary</strong><p>Comparison evidence can support problem or technical alignment. It does not establish startup efficacy, customer adoption, revenue, valuation, or future success.</p></aside>
  </section>`;
}

function renderQueueCaseEvidence(item) {
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  const providerCount = item.engineSnapshot?.sourceCount || evidence.length;
  return `<section class="queue-evidence-page"><article class="surface queue-evidence-heading"><div><p class="eyebrow">Complete retained ledger</p><h2>${esc(evidence.length)} retained citation${evidence.length === 1 ? "" : "s"} of ${esc(providerCount)} provider result${providerCount === 1 ? "" : "s"}</h2><p>Proofline stores the citations used by this case; a provider may have returned additional search results that were not retained. Open every source before relying on a claim.</p></div>${statusPill(item.engineSnapshot?.scoreMode === "REVIEWED" ? "Reviewed source pack" : "Unreviewed automated pack", item.engineSnapshot?.scoreMode === "REVIEWED" ? "positive" : "warning")}</article><div class="queue-evidence-ledger">${evidence.length ? evidence.map((source, index) => { const url = safeUrl(source.sourceUrl || source.url); const excerpt = source.excerpt || "Excerpt not retained in this frozen snapshot."; const review = source.reviewState || source.verificationStatus || "UNREVIEWED"; return `<article class="surface queue-evidence-record"><div class="queue-evidence-index">${String(index + 1).padStart(2, "0")}</div><div><div class="queue-evidence-meta"><span>${esc(sentenceCase(source.sourceType || "PUBLIC_WEB"))}</span><span>${esc(sentenceCase(source.captureMethod || source.provider || "PUBLIC_SOURCE"))}</span><span>${esc(fmtTime(source.publishedAt || source.publishedDate || source.capturedAt))}</span></div><h3>${url !== "#" ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(source.title || "Untitled source")} ↗</a>` : esc(source.title || "Untitled source")}</h3><p>${esc(excerpt)}</p><div class="queue-evidence-status">${statusPill(sentenceCase(review), review === "REVIEWED" ? "positive" : "warning")}<span>${esc(source.independenceGroup || source.provider || "Host not retained")}</span></div></div></article>`; }).join("") : `<article class="surface"><h2>No citation retained</h2><p>This is missing coverage, not evidence that the claim is false.</p></article>`}</div></section>`;
}

function queuePolicyCheck(item) {
  if (item.recordType !== "LIVE_ASSESSMENT") return { assessment: null, check: null };
  const assessment = ui.live.assessments.find((candidate) => candidate.id === item.assessmentId) || null;
  if (!assessment?.reviewedScore) return { assessment, check: null };
  try {
    return {
      assessment,
      check: calculatePolicyCheck(assessment.reviewedScore, ui.investmentPolicy, {
        identityConfirmed: assessment.identityConfirmed === true,
        thesisMatch: assessment.thesisMatch === true,
        complianceHold: assessment.complianceHold
      })
    };
  } catch {
    return { assessment, check: null };
  }
}

function gateValue(value) {
  if (value == null) return "Not established";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
  return String(value);
}

function renderCheckOutreachPanel(item, approval) {
  if (!approval) return "";
  const contacts = publicContactsForRecord(item, approval);
  let outreach = null;
  try {
    outreach = projectCheckOutreach(ui.live, item.id);
  } catch (error) {
    if (error?.code !== "CHECK_OUTREACH_NOT_PREPARED") throw error;
  }
  const projected = outreachForRecord(item.id);
  if (!outreach) {
    const storedContactId = ui.outreachContactSelection[item.id];
    const selected = contacts.find((contact) => contact.id === storedContactId) || bestPublicContact(contacts);
    return `<article class="surface queue-outreach-panel"><div class="surface-heading"><div><p class="eyebrow">Approval-gated outreach</p><h2>Generate the approval message</h2><p>The check is approved for outreach. Choose a sourced public professional channel; Proofline will create an editable notice without sending it.</p></div>${outreachStatusMarkup(projected)}</div><form id="queue-outreach-prepare-form" data-record-id="${esc(item.id)}" class="queue-outreach-prepare-form"><label class="field field-wide"><span>Recipient channel</span><select name="contactId"><option value="">No channel selected · generate for manual use</option>${contacts.map((contact) => `<option value="${esc(contact.id)}" ${contact.id === selected?.id ? "selected" : ""}>${esc(contact.subjectName)} · ${esc(contactChannelLabel(contact.channel))} · ${esc(contact.value)}</option>`).join("")}</select><small>${contacts.length ? "Every option was retained with a public source. Verify it before use." : "No public professional channel was retained. You can generate and copy the message, or refresh the evidence search."}</small></label><div class="form-actions field-wide"><p>Generating the message performs no external action and does not reserve funds.</p><button class="button button-primary" type="submit">Generate approval message</button></div></form><div class="outreach-safety-boundary"><strong>Still non-binding</strong><span>No funds are reserved, no transfer is authorized, and Proofline never sends automatically.</span></div></article>`;
  }

  const draft = ui.outreachDrafts[item.id] || {};
  const subject = draft.subject ?? outreach.approvalMessage.subject;
  const body = draft.body ?? outreach.approvalMessage.body;
  const selected = outreach.selectedContact;
  const contacted = outreach.contactStatus === "CONTACTED";
  const responseRecorded = ["ACCEPTED", "DECLINED"].includes(outreach.recipientResponse);
  const canOpenEmail = selected?.channel === "BUSINESS_EMAIL";
  return `<article class="surface queue-outreach-panel"><div class="surface-heading"><div><p class="eyebrow">Approval-gated outreach</p><h2>Contact ${esc(selected?.subjectName || `${item.companyName} team`)}</h2><p>This editable message was generated from the immutable check snapshot. Copy it or open your mail client; Proofline itself does not transmit it.</p></div>${outreachStatusMarkup(projected)}</div>
    <div class="outreach-recipient-summary"><div><span>Selected public channel</span><strong>${selected ? esc(contactChannelLabel(selected.channel)) : "Manual use"}</strong><small>${selected ? esc(selected.value) : "No channel selected when the message was generated"}</small></div><div><span>Check</span><strong>${fmtMoney(outreach.checkSnapshot.amount, outreach.checkSnapshot.currency)}</strong><small>Non-binding · final terms and diligence remain required</small></div></div>
    <div class="queue-outreach-message"><label class="field"><span>Subject</span><input data-outreach-draft="subject" data-record-id="${esc(item.id)}" maxlength="300" value="${esc(subject)}" /></label><label class="field"><span>Automatic approval response</span><textarea data-outreach-draft="body" data-record-id="${esc(item.id)}" rows="12" maxlength="5000">${esc(body)}</textarea></label></div>
    <div class="queue-outreach-actions"><button class="button" data-copy-outreach="${esc(item.id)}" type="button">Copy message</button><button class="button" data-open-mail-outreach="${esc(item.id)}" type="button" ${canOpenEmail ? "" : "disabled"}>Open email app</button><button class="button button-primary" data-mark-contacted="${esc(item.id)}" type="button" ${contacted ? "disabled" : ""}>${contacted ? "Contacted" : "I sent it · mark contacted"}</button></div>
    ${contacted ? responseRecorded ? `<div class="outreach-response-recorded"><span>Recipient response</span><strong>${esc(sentenceCase(outreach.recipientResponse))}</strong>${outreach.recipientResponseNote ? `<p>${esc(outreach.recipientResponseNote)}</p>` : ""}<small>Recorded by ${esc(outreach.events.at(-1)?.actor || outreach.actor)} · no funds moved</small></div>` : `<form id="queue-outreach-response-form" data-record-id="${esc(item.id)}" class="queue-outreach-response-form"><label class="field"><span>Recipient response</span><select name="response"><option value="ACCEPTED">Accepted the check</option><option value="DECLINED">Declined the check</option></select></label><label class="field"><span>Response note · optional</span><input name="note" maxlength="2000" placeholder="How was the response received?" /></label><div class="form-actions field-wide"><p>Record only the startup or founder’s actual response.</p><button class="button button-primary" type="submit">Record response</button></div></form>` : ""}
    <div class="outreach-safety-boundary"><strong>User-controlled delivery</strong><span>Copying or opening a mail app does not prove delivery. Only “I sent it” changes the contact status. Acceptance still does not authorize a transfer.</span></div></article>`;
}

function renderQueueCaseWorkflow(item) {
  const action = queueWorkflowAction(item);
  const history = (ui.live.queueWorkflowEvents || []).filter((event) => event.recordId === item.id).slice().reverse();
  const approval = latestCheckApproval(ui.live, item.id);
  const { assessment, check } = approval
    ? {
        assessment: ui.live.assessments.find((candidate) => candidate.id === item.assessmentId) || null,
        check: null
      }
    : queuePolicyCheck(item);
  const displayedCheck = approval?.policyCheckSnapshot || check;
  const displayedGates = Array.isArray(displayedCheck?.eligibility?.gates) ? displayedCheck.eligibility.gates : null;
  const actionReady = Boolean(action?.eventId && action.code === "POLICY_SCREEN_ELIGIBLE");
  const policyReady = Boolean(check?.eligibility?.eligible && Number.isFinite(check.amount));
  const canRecord = actionReady && policyReady && !approval;
  return `<section class="queue-workflow-page">
    <article class="surface queue-workflow-editor"><div class="surface-heading"><div><p class="eyebrow">Session workflow instruction</p><h2>Edit the next action</h2><p>This append-only instruction controls the diligence queue. It cannot change evidence, score, policy gates, or check amount.</p></div>${statusPill(action.origin === "HUMAN_EDITED" ? "Human edited" : action.origin === "CURATED_DEMO_DEFAULT" ? "Curated demo default" : "Simulated default", action.origin === "HUMAN_EDITED" ? "positive" : "warning")}</div><form id="queue-next-action-form" class="queue-action-form" data-record-id="${esc(item.id)}"><label class="field"><span>Next action</span><select name="actionCode">${Object.values(QUEUE_NEXT_ACTIONS).map((option) => `<option value="${esc(option.code)}" ${option.code === action.code ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label><label class="field"><span>Owner</span><input name="actor" maxlength="200" value="${esc(ui.reviewer || "Mario")}" required /></label><label class="field field-wide"><span>Instruction note</span><textarea name="note" rows="3" maxlength="2000" placeholder="What evidence or review should happen next?">${esc(action.note || "")}</textarea></label><div class="form-actions field-wide"><p>Saving “Policy screen eligible” only opens the policy screen; the engine reruns every gate independently.</p><button class="button button-primary" type="submit">Save next action</button></div></form>${history.length ? `<div class="queue-workflow-history"><span class="field-label">Append-only history</span>${history.map((event) => `<div><strong>${esc(event.actionLabel)}</strong><span>${esc(event.actor)} · ${esc(fmtTime(event.occurredAt))}</span>${event.note ? `<p>${esc(event.note)}</p>` : ""}</div>`).join("")}</div>` : `<div class="queue-workflow-history"><span class="field-label">Append-only history</span><p>No human edit yet. The visible action is a simulated Queue default.</p></div>`}</article>
    <article class="surface queue-policy-screen"><div class="surface-heading"><div><p class="eyebrow">Genuine check policy</p><h2>${approval ? "Non-binding check recorded" : policyReady ? `Policy-eligible ${fmtMoney(check.amount, check.currency)} check` : "Check approval is gated"}</h2><p>${approval ? "The immutable session record below authorizes no transfer or capital reservation." : policyReady ? "Every configured evidence gate clears. A named human may record a non-binding approval after the workflow action and acknowledgements are complete." : "A Queue action cannot override missing reviewed evidence or a failed gate."}</p></div>${statusPill(approval ? "Recorded · non-binding" : policyReady ? "Eligible for human review" : "Evidence required", approval || policyReady ? "positive" : "warning")}</div>
      ${approval ? `<p class="queue-policy-snapshot-note"><strong>Recorded policy snapshot.</strong> These are the gates captured when the check was approved; later Check settings changes do not rewrite them.</p>` : ""}
      ${displayedGates ? `<div class="queue-policy-gates">${displayedGates.map((gate) => `<div class="${gate.passed ? "passed" : "failed"}"><span aria-hidden="true">${gate.passed ? "✓" : "×"}</span><div><strong>${esc(sentenceCase(gate.label))}</strong><small>Actual ${esc(gateValue(gate.actual))} · required ${esc(gateValue(gate.required))}</small></div></div>`).join("")}</div>` : `<div class="queue-policy-unavailable"><strong>Reviewed live assessment required</strong><p>This frozen provisional record has ${esc(item.engineSnapshot?.coveragePercentage ?? 0)}% coverage and cannot be approved from its Queue snapshot. Run a current evidence review first.</p><button class="button button-primary" data-investigate-sourced="${esc(item.id)}" type="button">Run current evidence review</button></div>`}
      ${approval ? `<div class="queue-approval-record"><div><span>Recorded amount</span><strong>${fmtMoney(approval.amount, approval.currency)}</strong></div><dl class="compact-dl"><div><dt>Reviewer</dt><dd>${esc(approval.reviewer)}</dd></div><div><dt>Recorded</dt><dd>${esc(fmtTime(approval.occurredAt))}</dd></div><div><dt>Policy</dt><dd>${esc(approval.policyVersion)} · ${esc(sentenceCase(approval.mode))}</dd></div><div><dt>Research</dt><dd>${esc(approval.researchSnapshot?.researchId || "Not retained")}</dd></div></dl><p>${esc(approval.rationale)}</p><div class="approval-safety-flags"><span>Binding: no</span><span>Funds reserved: no</span><span>Transfer authorized: no</span></div></div>` : assessment ? `<form id="queue-check-approval-form" class="queue-check-form" data-record-id="${esc(item.id)}"><label class="field"><span>Human reviewer</span><input name="reviewer" maxlength="200" value="${esc(ui.reviewer || "Mario")}" required /></label><label class="field field-wide"><span>Approval rationale</span><textarea name="rationale" rows="4" maxlength="4000" required placeholder="Why does this reviewed evidence pack clear the current policy?">${esc(ui.approvalRationale || "")}</textarea></label><fieldset class="queue-check-acknowledgements field-wide"><legend>Required acknowledgements</legend>${NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((ack) => `<label><input type="checkbox" name="acknowledgement" value="${esc(ack.code)}" /><span>${esc(ack.label)}</span></label>`).join("")}</fieldset><div class="form-actions field-wide"><p>${!actionReady ? "First save Policy screen eligible as the Queue action. " : ""}${!policyReady ? "The current evidence gates do not clear. " : ""}No button here transfers funds.</p><button class="button button-primary" type="submit" ${canRecord ? "" : "disabled"}>Record non-binding check approval${policyReady ? ` · ${esc(fmtMoney(check.amount, check.currency))}` : ""}</button></div></form>` : ""}
    </article>
    ${renderCheckOutreachPanel(item, approval)}
  </section>`;
}

function queueWorkflowAction(item) {
  const matchingLead = item.recordType === "LIVE_ASSESSMENT"
    ? SCORED_PIPELINE_LEADS.find((lead) => lead.companyName.toLowerCase() === String(item.companyName || "").toLowerCase())
    : null;
  const fallback = simulatedWorkflowActionForLead(matchingLead?.id || item.id);
  const projected = projectQueueNextAction(ui.live, item.id, { ...fallback, simulation: true });
  if (!projected) return fallback;
  return {
    ...projected,
    explanation: projected.note || fallback.explanation || "Workflow planning only; this does not change evidence, score, or check eligibility."
  };
}

function simulatedActionTone(code) {
  if (code === "POLICY_SCREEN_ELIGIBLE") return "positive";
  if (code === "PASS_CURRENT_THESIS") return "negative";
  return "warning";
}

function summaryCard(label, value, context) {
  return `<article class="surface summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><p>${esc(context)}</p></article>`;
}

function renderCase(state) {
  const item = caseFor(state);
  if (!item) return `<p>No opportunity selected.</p>`;
  const opportunity = item.opportunity;
  const activeContract = opportunity.evidenceContracts.find((contract) =>
    ["PROPOSED", "SENT", "SUBMITTED", "UNDER_REVIEW"].includes(contract.status)
  );
  const headerActionTab = activeContract ? "proof" : "decision";
  const headerActionLabel = activeContract ? "Next best evidence" : "Open policy record";
  return `
    <section class="case-heading">
      <div>
        <button class="back-link" id="back-to-queue" type="button">← Queue</button>
        <p class="eyebrow">${esc(opportunity.direction)} · ${esc(opportunity.sourceLabel)}</p>
        <h1>${esc(opportunity.companyName)}</h1>
        <p>${esc(opportunity.founderName)} · ${esc(opportunity.oneLiner)}</p>
      </div>
      <div class="case-actions">
        ${statusPill(item.decision.label, decisionTone(item.decision.code))}
        <button class="button button-primary" data-tab="${headerActionTab}" type="button">${headerActionLabel}</button>
      </div>
    </section>

    <nav class="tab-list" aria-label="Case sections">
      ${tabButton("overview", "Overview")}
      ${tabButton("claims", `Claims & evidence · ${item.claims.length}`)}
      ${tabButton("proof", `Proof request · ${opportunity.evidenceContracts.length}`)}
      ${tabButton("decision", "Policy record")}
    </nav>

    ${ui.caseTab === "claims" ? renderClaims(item) : ui.caseTab === "proof" ? renderProof(item) : ui.caseTab === "decision" ? renderDecision(item, state) : renderOverview(item)}
  `;
}

function tabButton(tab, label) {
  return `<button class="tab ${ui.caseTab === tab ? "active" : ""}" data-tab="${tab}" type="button" ${ui.caseTab === tab ? 'aria-current="page"' : ""}>${esc(label)}</button>`;
}

function renderOverview(item) {
  const opportunity = item.opportunity;
  const activeContract = opportunity.evidenceContracts.find((contract) =>
    ["PROPOSED", "SENT", "SUBMITTED", "UNDER_REVIEW"].includes(contract.status)
  );
  return `
    <section class="case-grid">
      <div class="case-main">
        <article class="surface action-surface">
          <div><p class="eyebrow">Decision-critical next action</p><h2>${esc(activeContract?.title || item.decision.label)}</h2><p>${esc(activeContract?.question || item.decision.reason)}</p></div>
          <div class="action-meta">
            ${activeContract ? `<span><small>Founder effort</small><strong>${activeContract.timeBudgetMinutes} min</strong></span><span><small>Decision impact</small><strong>${esc(activeContract.expectedDecisionImpact)}</strong></span>` : ""}
            <button class="button button-primary" data-tab="${activeContract ? "proof" : "decision"}" type="button">${activeContract ? "Inspect request" : "Open policy record"}</button>
          </div>
        </article>

        <section class="axis-section">
          <div class="section-heading"><div><p class="eyebrow">No overall score</p><h2>Independent investment axes</h2></div><span>Frozen floors: ${AXES.map((axis) => `${axis === "IDEA_MARKET" ? "Idea" : sentenceCase(axis)} ${fullState().thesis.axisRecommendFloors[axis]}`).join(" · ")}</span></div>
          <div class="axis-grid">${item.axes.map(axisCard).join("")}</div>
        </section>

        <section class="surface">
          <div class="surface-heading"><div><h2>Evidence activity</h2><p>Append-only events; corrections create new states.</p></div></div>
          ${timeline(opportunity.timeline)}
        </section>
      </div>

      <aside class="case-rail">
        <article class="surface founder-score-card">
          <p class="eyebrow">Persistent founder evidence</p>
          <div class="score-line"><strong>${item.founderScore.score ?? "—"}</strong><span>${item.founderScore.score == null ? "Insufficient coverage" : `± ${item.founderScore.uncertaintyBand}`}</span></div>
          ${progressBar((item.founderScore.coverage || 0) * 100, "neutral", "Founder evidence coverage")}
          <p>${fmtPct(item.founderScore.coverage)} coverage · task-relevant evidence only</p>
          <button class="text-button" data-tab="claims" type="button">Inspect score evidence →</button>
        </article>
        <article class="surface">
          <p class="eyebrow">Why this surfaced</p><p>${esc(opportunity.discoveryReason)}</p>
        </article>
        <article class="surface">
          <p class="eyebrow">Open questions</p>
          <ol class="question-list">${opportunity.openQuestions.map((question) => `<li>${esc(question)}</li>`).join("")}</ol>
        </article>
      </aside>
    </section>`;
}

function axisCard(axis) {
  const tone = axisTone(axis);
  const status = !Number.isFinite(axis.score) ? "Unknown" : axis.score >= 70 ? "Strong" : axis.score < 45 ? "Weak" : "Mixed";
  return `
    <article class="surface axis-card axis-${tone}">
      <div class="axis-top"><div><span>${esc(axis.label)}</span><strong>${Number.isFinite(axis.score) ? axis.score : "—"}</strong></div>${statusPill(status, tone)}</div>
      ${progressBar(axis.score || 0, tone, `${axis.label} score`)}
      <div class="axis-meta"><span>${fmtPct(axis.confidence)} confidence</span><span>${fmtPct(axis.coverage)} coverage</span><span>${axis.trend === "UP" ? "↑" : axis.trend === "DOWN" ? "↓" : "↔"} ${sentenceCase(axis.trend)}</span></div>
      <details><summary>Why this axis moved</summary><ul class="dimension-list">${axis.dimensions.map((dimension) => `<li><span>${esc(dimension.label)}</span><strong>${Number.isFinite(dimension.value) ? roundUi(dimension.value) : "Unknown"}</strong></li>`).join("")}</ul></details>
    </article>`;
}

function roundUi(value) {
  return Math.round(Number(value));
}

function timeline(entries = []) {
  if (!entries.length) return `<p class="empty-state">No evidence events yet.</p>`;
  return `<ol class="timeline">${[...entries].reverse().map((entry) => `<li><span class="timeline-mark" aria-hidden="true"></span><div><strong>${esc(entry.label)}</strong><small>${fmtTime(entry.occurredAt)} · ${sentenceCase(entry.type)}</small></div></li>`).join("")}</ol>`;
}

function renderClaims(item) {
  const opportunity = item.opportunity;
  const selectedClaim = item.claims.find((claim) => claim.id === ui.selectedClaimId) || item.claims[0];
  if (selectedClaim) ui.selectedClaimId = selectedClaim.id;
  const openContradictions = opportunity.contradictions.filter((conflict) => conflict.status === "OPEN");
  return `
    ${openContradictions.length ? `<section class="conflict-banner"><div class="conflict-icon">!</div><div><strong>Conflicting evidence remains open</strong><p>${esc(openContradictions[0].title)}. Neither source has been discarded.</p></div></section>` : ""}
    <section class="split-layout claims-layout">
      <div class="surface table-surface">
        <div class="surface-heading"><div><h2>Material claims</h2><p>Trust is per claim. It is an evidence-strength index, not a probability.</p></div></div>
        <div class="table-wrap"><table class="data-table claims-table"><caption class="sr-only">Material claims and their evidence strength</caption><thead><tr><th scope="col">Claim</th><th scope="col">Type</th><th scope="col">Trust</th><th scope="col">Evidence</th><th scope="col">Axis</th></tr></thead><tbody>
          ${item.claims.map((claim) => claimRow(claim, claim.id === selectedClaim?.id)).join("")}
        </tbody></table></div>
      </div>
      ${selectedClaim ? claimInspector(selectedClaim, item) : ""}
    </section>`;
}

function claimRow(claim, selected) {
  const trust = claim.trust;
  const evidenceCount = trust.supporting.length + trust.opposing.length + trust.context.length;
  return `<tr class="selectable-row ${selected ? "selected" : ""}" data-claim-id="${esc(claim.id)}">
    <td><button class="row-title" type="button" data-claim-id="${esc(claim.id)}" aria-pressed="${selected}"><strong>${esc(claim.statement)}</strong><span>${esc(claim.id)} · ${sentenceCase(claim.materiality)} materiality</span></button></td>
    <td>${statusPill(sentenceCase(claim.type), "neutral")}</td>
    <td><div class="trust-cell"><strong>${trust.score}</strong>${statusPill(trust.label, trustTone(trust.status))}</div></td>
    <td><strong>${evidenceCount}</strong><small>${trust.independentSupportingGroups} independent support group${trust.independentSupportingGroups === 1 ? "" : "s"}</small></td>
    <td>${esc(claim.axis === "IDEA_MARKET" ? "Idea vs. market" : sentenceCase(claim.axis))}</td>
  </tr>`;
}

function claimInspector(claim, item) {
  const links = claim.evidenceLinks.map((link) => ({
    link,
    evidence: item.evidenceById.get(link.evidenceId)
  })).filter((entry) => entry.evidence);
  return `<aside class="surface inspector claim-inspector">
    <p class="eyebrow">Selected claim</p><h2>${esc(claim.statement)}</h2>
    <div class="trust-hero"><strong>${claim.trust.score}</strong><div>${statusPill(claim.trust.label, trustTone(claim.trust.status))}<p>Evidence-strength index</p></div></div>
    <dl class="compact-dl">
      <div><dt>Support</dt><dd>${claim.trust.supportingStrength}</dd></div>
      <div><dt>Opposition</dt><dd>${claim.trust.opposingStrength}</dd></div>
      <div><dt>Independent support</dt><dd>${claim.trust.independentSupportingGroups}</dd></div>
      <div><dt>Observed</dt><dd>${fmtTime(claim.observedAt)}</dd></div>
    </dl>
    <div class="evidence-stack">
      ${links.map(({ link, evidence }) => evidenceItem(evidence, link.stance)).join("")}
    </div>
  </aside>`;
}

function evidenceItem(evidence, stance) {
  const quality = evidenceQuality(evidence);
  const tone = stance === "support" ? "positive" : stance === "oppose" ? "negative" : "neutral";
  return `<article class="evidence-item">
    <div><span class="stance-mark stance-${tone}">${stance === "support" ? "+" : stance === "oppose" ? "−" : "·"}</span><div><strong>${esc(evidence.title)}</strong><small>${sentenceCase(evidence.kind)} · captured ${fmtTime(evidence.capturedAt)}</small></div><span class="evidence-quality">Q ${quality}</span></div>
    <p>“${esc(evidence.excerpt)}”</p>
    <a href="${esc(safeUrl(evidence.sourceUrl))}" target="_blank" rel="noreferrer">Open source snapshot ↗</a>
    ${evidence.reviewState === "UNREVIEWED" ? `<div class="lead-warning">${evidence.origin === "EXTERNAL_LIVE_LEAD" ? "External live lead" : "Unreviewed lead"} · excluded from trust and axis calculations</div>` : ""}
  </article>`;
}

function renderProof(item) {
  const opportunity = item.opportunity;
  const contract = opportunity.evidenceContracts[0];
  const live = ui.liveResearch[opportunity.id] || { query: opportunity.liveResearchQuery, results: [] };
  if (!contract) return `<section class="surface"><h2>No evidence request</h2><p>This case has no current decision-critical contract.</p></section>`;

  return `
    <section class="proof-layout">
      <div class="proof-main">
        <article class="surface contract-card">
          <div class="contract-header">
            <div><p class="eyebrow">${esc(contract.rulesetVersion)} · immutable request</p><h2>${esc(contract.title)}</h2><p>${esc(contract.question)}</p></div>
            ${statusPill(sentenceCase(contract.status), contract.status === "VERIFIED" ? "positive" : contract.status === "SUBMITTED" ? "warning" : "neutral")}
          </div>
          <div class="contract-metrics">
            <div><span>Founder effort</span><strong>${contract.timeBudgetMinutes} min</strong></div>
            <div><span>Decision impact</span><strong>${esc(contract.expectedDecisionImpact)}</strong></div>
            <div><span>Privacy risk</span><strong>${esc(contract.privacyRisk)}</strong></div>
          </div>
          <div class="contract-section"><span class="field-label">Requested artifact</span><p>${esc(contract.requestedArtifact)}</p></div>
          <div class="contract-columns">
            <div><span class="field-label">Predeclared success criteria</span><ol>${contract.successCriteria.map((criterion) => `<li>${esc(criterion)}</li>`).join("")}</ol></div>
            <div><span class="field-label">Equivalent route</span><p>${esc(contract.alternativeEvidence)}</p><span class="field-label">If not completed</span><p>${esc(contract.noncompletionSemantics)}</p></div>
          </div>
          <div class="inference-boundary"><div><strong>Allowed inference</strong><p>${esc(contract.allowedInference)}</p></div><div><strong>Never infer</strong><p>${esc(contract.prohibitedInference)}</p></div></div>
          ${renderProofAction(contract, opportunity)}
        </article>

        ${contract.result ? proofResult(contract.result, item) : ""}
      </div>
      <aside class="proof-rail">
        <article class="surface live-research-card">
          <div class="surface-heading"><div><p class="eyebrow">Optional live enrichment</p><h2>Research an open question</h2></div>${statusPill(ui.tavily.configured ? "Tavily ready" : "Offline", ui.tavily.configured ? "positive" : "neutral")}</div>
          <p>Live results arrive as unreviewed leads. They cannot change Trust or an axis until a human verifies and scopes them.</p>
          <label class="field"><span>Research query</span><textarea id="live-query" rows="4">${esc(live.query || opportunity.liveResearchQuery)}</textarea></label>
          <button class="button button-secondary button-full" id="run-live-research" type="button" ${!ui.tavily.configured || live.loading ? "disabled" : ""}>${live.loading ? "Searching…" : "Search live sources · 1 credit"}</button>
          ${live.error ? `<p class="form-error">${esc(live.error)}</p>` : ""}
          ${live.answer ? `<div class="research-answer"><strong>Search synthesis</strong><p>${esc(live.answer)}</p></div>` : ""}
          ${Array.isArray(live.results) && live.results.length ? `<div class="research-results">${live.results.map((result, index) => researchResult(result, index)).join("")}</div>` : ""}
        </article>
      </aside>
    </section>`;
}

function renderProofAction(contract, opportunity) {
  const transition = DEMO_TRANSITIONS[opportunity.id];
  if (contract.status === "PROPOSED" && transition) {
    return `<div class="contract-action"><div><strong>Founder-facing status: ready to send</strong><p>The synthetic demo can load a deterministic submission without an external dependency.</p></div><button class="button button-primary" id="simulate-submission" type="button">Simulate founder submission</button></div>`;
  }
  if (contract.status === "SUBMITTED" && transition) {
    return `<div class="contract-action"><div><strong>Submission received</strong><p>Raw CSV, protocol, and unedited video fixture are ready for rubric review.</p></div><button class="button button-primary" id="verify-submission" type="button">Verify against rubric</button></div>`;
  }
  if (contract.status === "VERIFIED") {
    return `<div class="contract-action contract-complete"><div><strong>Verified without broad founder inference</strong><p>Only the linked technical claim and task-relevant evidence events were updated.</p></div><button class="button button-secondary" data-tab="decision" type="button">Open policy record</button></div>`;
  }
  return "";
}

function proofResult(result, item) {
  const affectedAxes = result.affectedAxes || [];
  const unchangedAxes = result.unchangedAxes || [];
  return `<article class="surface proof-result">
    <div class="result-mark">✓</div><div><p class="eyebrow">Verified result</p><h2>${esc(result.summary || result.note || result.outcome)}</h2><p>${esc(result.validator || "Reviewed against the predeclared rubric")}</p>
    ${result.criteriaTotal ? `<p><strong>${result.criteriaPassed}/${result.criteriaTotal}</strong> criteria satisfied</p>` : ""}
    ${result.artifacts ? `<div class="artifact-list">${result.artifacts.map((artifact) => statusPill(artifact, "neutral")).join("")}</div>` : ""}
    <p class="affected-note">Affected axes: ${affectedAxes.map(esc).join(", ") || "No axis change"}.${unchangedAxes.length ? ` Unchanged: ${unchangedAxes.map(esc).join(", ")}.` : ""}</p></div>
  </article>`;
}

function researchResult(result, index) {
  return `<article class="research-result"><a href="${esc(safeUrl(result.url))}" target="_blank" rel="noreferrer"><strong>${esc(result.title)}</strong></a><p>${esc(result.content)}</p><button class="text-button" data-attach-lead="${index}" type="button">Attach as unreviewed lead</button></article>`;
}

function renderDecision(item, state) {
  const opportunity = item.opportunity;
  const finalDecision = opportunity.finalDecision;
  const displayedCheckAmount = finalDecision?.checkAmount ?? state.thesis.checkSize.max;
  const displayedCheckCurrency = finalDecision?.checkCurrency ?? state.thesis.checkSize.currency;
  const maxSeq = Math.max(...events.map((event) => event.seq));
  const checksComplete = ["axes", "claims", "unknowns"].every((check) => ui.approvalChecks.has(check));
  const canFreeze = item.decision.code === "RECOMMEND" && checksComplete && !finalDecision && ui.replaySeq == null;
  return `
    <section class="decision-layout">
      <div class="decision-main">
        <article class="surface decision-hero decision-${decisionTone(item.decision.code)}">
          <div><p class="eyebrow">Non-binding policy screen · human review required</p><h2>${esc(finalDecision?.label || item.decision.label)}</h2><p>${esc(finalDecision?.rationale || item.decision.reason)}</p></div>
          <div class="decision-amount"><span>${finalDecision ? "Frozen synthetic-thesis check" : "Current synthetic-thesis ceiling"}</span><strong>${fmtMoney(displayedCheckAmount, displayedCheckCurrency)}</strong></div>
        </article>

        <article class="surface">
          <div class="surface-heading"><div><h2>${finalDecision ? "Frozen" : "Current"} policy gates</h2><p>Axes are independently assessed and never averaged.</p></div><span>Thesis v${finalDecision?.thesisVersion || state.thesis.version}</span></div>
          <div class="decision-axis-list">${item.axes.map(decisionAxisRow).join("")}</div>
        </article>

        <article class="surface memo-card">
          <div class="surface-heading"><div><p class="eyebrow">Investment memo</p><h2>Evidence-backed view</h2></div><span>Material factual statements resolve to claims</span></div>
          ${memoSection("Company snapshot", item.opportunity.memoDraft.snapshot, "FACT + FOUNDER STATEMENT")}
          ${memoList("Investment hypotheses", item.opportunity.memoDraft.hypotheses, "CAUSAL HYPOTHESIS")}
          <div class="swot-grid">
            ${memoList("Strengths", item.opportunity.memoDraft.strengths, "ANALYSIS")}
            ${memoList("Weaknesses", item.opportunity.memoDraft.weaknesses, "ANALYSIS")}
            ${memoList("Opportunities", item.opportunity.memoDraft.opportunities, "ANALYSIS")}
            ${memoList("Threats", item.opportunity.memoDraft.threats, "ANALYSIS")}
          </div>
          ${memoSection("Problem & product", item.opportunity.memoDraft.problemProduct, "FACT + ANALYSIS")}
          ${memoSection("Traction & KPIs", item.opportunity.memoDraft.tractionKpis, "FACT + UNKNOWN")}
        </article>

        <article class="surface replay-card">
          <div class="surface-heading"><div><h2>Policy replay</h2><p>Move backward to hide evidence that was not yet observed.</p></div><span>Event ${ui.replaySeq ?? maxSeq} of ${maxSeq}</span></div>
          <label class="range-label" for="replay-range"><span>Evidence-time event</span><strong>${ui.replaySeq ?? maxSeq}</strong></label>
          <input id="replay-range" class="range" type="range" min="1" max="${maxSeq}" value="${ui.replaySeq ?? maxSeq}" />
          <div class="replay-events">${events.map((event) => `<button type="button" data-replay-seq="${event.seq}" class="replay-event ${event.seq === (ui.replaySeq ?? maxSeq) ? "active" : ""}"><span>${event.seq}</span><div><strong>${event.type === "DECISION_FROZEN" ? "Non-binding policy record frozen" : sentenceCase(event.type)}</strong><small>${fmtTime(event.occurredAt)}</small></div></button>`).join("")}</div>
        </article>
      </div>

      <aside class="decision-rail">
        ${finalDecision ? frozenDecisionCard(finalDecision) : approvalCard(item, checksComplete, canFreeze)}
        <article class="surface"><p class="eyebrow">Still unknown</p><ul class="question-list">${opportunity.openQuestions.map((question) => `<li>${esc(question)}</li>`).join("")}</ul></article>
        <article class="surface"><p class="eyebrow">Decision rules fired</p><ul class="rule-list">${item.decision.ruleIds.map((rule) => `<li><code>${esc(rule)}</code></li>`).join("")}</ul></article>
      </aside>
    </section>`;
}

function decisionAxisRow(axis) {
  const tone = axisTone(axis);
  return `<div class="decision-axis-row"><div><span>${esc(axis.label)}</span><small>${fmtPct(axis.confidence)} confidence · ${fmtPct(axis.coverage)} coverage</small></div><strong>${Number.isFinite(axis.score) ? axis.score : "Unknown"}</strong>${statusPill(axis.trend === "UP" ? "↑ improving" : axis.trend === "DOWN" ? "↓ declining" : "↔ stable", tone)}</div>`;
}

function memoSection(title, content, tag) {
  return `<section class="memo-section"><div><h3>${esc(title)}</h3>${statusPill(tag, "neutral")}</div><p>${esc(content)}</p></section>`;
}

function memoList(title, entries, tag) {
  return `<section class="memo-section"><div><h3>${esc(title)}</h3>${statusPill(tag, "neutral")}</div><ul>${entries.map((entry) => `<li>${esc(entry)}</li>`).join("")}</ul></section>`;
}

function approvalCard(item, checksComplete, canFreeze) {
  return `<article class="surface approval-card">
    <p class="eyebrow">Human review gate</p><h2>Freeze non-binding policy record</h2><p>The policy screen cannot be frozen until a named reviewer opens the evidence and acknowledges each gate. Freezing preserves the record; it is not investment approval.</p>
    <div class="check-list">
      ${approvalCheck("axes", "I reviewed all three independent axes")}
      ${approvalCheck("claims", "I reviewed material claims and contradictions")}
      ${approvalCheck("unknowns", "I reviewed remaining unknowns and conditions")}
    </div>
    <label class="field"><span>Reviewer</span><input id="reviewer-name" value="${esc(ui.reviewer)}" /></label>
    <label class="field"><span>Policy-screen rationale</span><textarea id="approval-rationale" rows="4" placeholder="State why this screen is eligible for human review despite the remaining unknowns.">${esc(ui.approvalRationale)}</textarea></label>
    <button class="button button-primary button-full" id="freeze-decision" type="button" ${canFreeze && ui.reviewer.trim() && ui.approvalRationale.trim().length >= 12 ? "" : "disabled"}>Freeze non-binding policy screen</button>
    ${item.decision.code !== "RECOMMEND" ? `<p class="approval-note">The current state is not recommendable: ${esc(item.decision.reason)}</p>` : !checksComplete ? `<p class="approval-note">Complete the evidence review acknowledgements.</p>` : ""}
  </article>`;
}

function approvalCheck(id, label) {
  return `<label class="checkbox-row"><input type="checkbox" data-approval-check="${id}" ${ui.approvalChecks.has(id) ? "checked" : ""}/><span>${esc(label)}</span></label>`;
}

function frozenDecisionCard(decision) {
  return `<article class="surface approval-card frozen-card"><div class="frozen-mark">✓</div><p class="eyebrow">Immutable non-binding policy record</p><h2>${esc(decision.label)}</h2><p>${esc(decision.rationale)}</p><dl class="compact-dl"><div><dt>Check snapshot</dt><dd>${fmtMoney(decision.checkAmount, decision.checkCurrency)}</dd></div><div><dt>Capital status</dt><dd>Not reserved</dd></div><div><dt>Reviewer</dt><dd>${esc(decision.reviewer)}</dd></div><div><dt>Frozen</dt><dd>${fmtTime(decision.frozenAt)}</dd></div><div><dt>Thesis</dt><dd>v${esc(decision.thesisVersion)}</dd></div><div><dt>Version</dt><dd>${esc(decision.version)}</dd></div></dl><small>Binding: no · transfer authorized: no</small></article>`;
}

function renderDecisions(state) {
  const items = state.opportunities.map((opportunity) => computeCaseFromState(state, opportunity));
  return `<section class="page-heading"><div><p class="eyebrow">Human review + immutable history</p><h1>Decisions</h1><p>Current non-binding policy screens and frozen records remain separate.</p></div></section>
    <section class="surface table-surface"><div class="table-wrap"><table class="data-table"><caption class="sr-only">Current and frozen opportunity decisions</caption><thead><tr><th scope="col">Opportunity</th><th scope="col">Founder</th><th scope="col">Current state</th><th scope="col">Axes</th><th scope="col">Record</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>
      ${items.map((item) => `<tr><td><strong>${esc(item.opportunity.companyName)}</strong><small>${esc(item.opportunity.oneLiner)}</small></td><td>${esc(item.opportunity.founderName)}</td><td>${statusPill(item.decision.label, decisionTone(item.decision.code))}<small>${esc(item.decision.reason)}</small></td><td><div class="mini-axes">${item.axes.map((axis) => `<span>${axis.label.split(" ")[0]} <strong>${axis.score ?? "—"}</strong></span>`).join("")}</div></td><td>${item.opportunity.finalDecision ? `Policy record v${item.opportunity.finalDecision.version}` : "Current screen"}</td><td><button class="button button-small" data-open-decision="${esc(item.opportunity.id)}" type="button" aria-label="Open ${esc(item.opportunity.companyName)} policy screen">Open</button></td></tr>`).join("")}
    </tbody></table></div></section>`;
}

function renderSources(state) {
  return `<section class="page-heading"><div><p class="eyebrow">Quality, not volume</p><h1>Source exposure ledger</h1><p>Logging the observation policy now makes future channel learning possible.</p></div></section>
    <section class="surface source-explainer"><strong>Illustrative channel observations only</strong><p>These are synthetic, low-sample events—not evidence of real predictive performance or causal channel lift.</p></section>
    <section class="surface table-surface"><div class="surface-heading"><div><h2>Named eligible universes</h2><p>Unknown missed founders cannot be recovered by inverse weighting.</p></div></div><div class="table-wrap"><table class="data-table source-table"><caption class="sr-only">Synthetic sourcing-channel exposure and outcomes</caption><thead><tr><th scope="col">Source</th><th scope="col">Eligible</th><th scope="col">Exposed</th><th scope="col">Surfaced</th><th scope="col">Reviewed</th><th scope="col">Proof complete</th><th scope="col">Advanced</th><th scope="col">Adjusted observation</th></tr></thead><tbody>
      ${state.sourceChannels.map((channel) => `<tr><td><strong>${esc(channel.name)}</strong><small>${esc(channel.note)}</small></td><td>${channel.eligible}</td><td>${channel.exposed}</td><td>${channel.surfaced}</td><td>${channel.reviewed}</td><td>${channel.proofComplete}</td><td>${channel.advanced}</td><td>${statusPill(channel.adjustedObservation, "neutral")}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}

function renderThesis(state) {
  const thesis = state.thesis;
  return `<section class="page-heading"><div><p class="eyebrow">Configurable policy · version ${thesis.version}</p><h1>Investment thesis</h1><p>Changes recompute current proposals but never rewrite a frozen decision.</p></div></section>
    <form class="surface thesis-form" id="thesis-form">
      <div class="form-grid">
        <label class="field field-wide"><span>Thesis name</span><input name="name" value="${esc(thesis.name)}" required /></label>
        <label class="field field-wide"><span>Sectors · comma separated</span><input name="sectors" value="${esc(thesis.sectors.join(", "))}" required /></label>
        <label class="field"><span>Stages · comma separated</span><input name="stages" value="${esc(thesis.stages.join(", "))}" required /></label>
        <label class="field"><span>Geographies · comma separated</span><input name="geographies" value="${esc(thesis.geographies.join(", "))}" required /></label>
        <label class="field"><span>Check size</span><input name="checkSize" type="number" min="1" value="${thesis.checkSize.max}" required /></label>
        <label class="field"><span>Currency</span><select name="currency"><option ${thesis.checkSize.currency === "USD" ? "selected" : ""}>USD</option><option ${thesis.checkSize.currency === "EUR" ? "selected" : ""}>EUR</option></select></label>
        <label class="field"><span>Ownership minimum %</span><input name="ownershipMinPct" type="number" step="0.1" min="0" value="${thesis.ownershipMinPct}" /></label>
        <label class="field"><span>Ownership maximum %</span><input name="ownershipMaxPct" type="number" step="0.1" min="0" value="${thesis.ownershipMaxPct}" /></label>
        <label class="field field-wide"><span>Risk appetite</span><textarea name="riskAppetite" rows="3">${esc(thesis.riskAppetite)}</textarea></label>
      </div>
      <fieldset><legend>Independent recommendation floors</legend><div class="form-grid floor-grid">
        ${AXES.map((axis) => `<label class="field"><span>${axis === "IDEA_MARKET" ? "Idea vs. market" : sentenceCase(axis)}</span><input name="floor_${axis}" type="number" min="0" max="100" value="${thesis.axisRecommendFloors[axis]}" /></label>`).join("")}
      </div></fieldset>
      <div class="form-actions"><p>Hard evidence-integrity gates are not relaxed by risk appetite.</p><button class="button button-primary" type="submit">Save new thesis version</button></div>
    </form>`;
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.view = button.dataset.view;
      ui.replaySeq = null;
      renderAtTop();
    });
  });
  document.getElementById("return-current")?.addEventListener("click", () => {
    ui.replaySeq = null;
    render();
  });
  document.querySelectorAll("[data-reset-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("Reset only the synthetic demo fixtures? Live research assessments in this session will remain.")) return;
      events = structuredClone(SEED_EVENTS);
      persistEvents();
      ui.replaySeq = null;
      ui.caseTab = "overview";
      ui.selectedOpportunityId = "SYN-C001";
      ui.selectedClaimId = "NUR-C01";
      ui.approvalChecks.clear();
      ui.approvalRationale = "";
      showNotice("Synthetic demo fixtures reset. Live research was preserved.");
    });
  });
}

function bindViewEvents(state) {
  document.getElementById("open-live-discovery")?.addEventListener("click", () => {
    ui.view = "research";
    ui.live.mode = "discover";
    renderAtTop();
  });
  document.getElementById("open-live-investigation")?.addEventListener("click", () => {
    ui.view = "research";
    ui.live.mode = "investigate";
    renderAtTop();
  });
  document.querySelectorAll("[data-open-queue-case]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const recordId = element.dataset.openQueueCase;
      ui.live.selectedQueueId = recordId;
      ui.queueDetailId = recordId;
      ui.queueCaseTab = "overview";
      renderAtTop();
    });
  });
  document.querySelectorAll("[data-open-recorded-check]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const recordId = event.currentTarget.dataset.openRecordedCheck;
      if (!projectLiveQueue(ui.live, SCORED_PIPELINE_LEADS).some((item) => item.id === recordId)) return;
      ui.view = "queue";
      ui.live.selectedQueueId = recordId;
      ui.queueDetailId = recordId;
      ui.queueCaseTab = "workflow";
      renderAtTop();
    });
  });
  document.getElementById("back-to-real-queue")?.addEventListener("click", () => {
    ui.queueDetailId = null;
    renderAtTop();
  });
  document.querySelectorAll("[data-queue-case-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.queueCaseTab = button.dataset.queueCaseTab;
      renderAtTop();
    });
  });
  document.querySelectorAll("[data-investigate-sourced]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const lead = SCORED_PIPELINE_LEADS.find((item) => item.id === event.currentTarget.dataset.investigateSourced);
      if (!lead) return;
      ui.live.intake = {
        companyName: lead.companyName,
        founderNames: lead.founderNames.join(", "),
        links: lead.links.join("\n"),
        context: lead.context,
        allowPlanKeywordsForWebResearch: false,
        crossValidateWithExa: false
      };
      ui.live.mode = "investigate";
      ui.live.error = null;
      ui.view = "research";
      renderAtTop();
    });
  });
  document.querySelectorAll("[data-open-queued-assessment]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const assessmentId = event.currentTarget.dataset.openQueuedAssessment;
      if (!ui.live.assessments.some((item) => item.id === assessmentId)) return;
      ui.live.selectedAssessmentId = assessmentId;
      ui.live.mode = "assessments";
      ui.view = "research";
      renderAtTop();
    });
  });
  document.getElementById("queue-next-action-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const actor = String(data.get("actor") || ui.reviewer || "Mario").trim();
    try {
      setQueueNextAction(
        ui.live,
        event.currentTarget.dataset.recordId,
        String(data.get("actionCode") || ""),
        String(data.get("note") || ""),
        actor
      );
      ui.reviewer = actor;
      ui.queueCaseTab = "workflow";
      showNotice("Next action saved to the append-only session workflow. Evidence, score, and policy eligibility were unchanged.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The Queue action could not be saved.", "warning");
    }
  });
  document.getElementById("queue-check-approval-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reviewer = String(data.get("reviewer") || "").trim();
    const rationale = String(data.get("rationale") || "").trim();
    try {
      const approval = recordNonBindingCheckApproval(ui.live, {
        recordId: event.currentTarget.dataset.recordId,
        policy: ui.investmentPolicy,
        reviewer,
        rationale,
        acknowledgements: data.getAll("acknowledgement")
      });
      ui.reviewer = reviewer;
      ui.approvalRationale = "";
      ui.queueCaseTab = "workflow";
      showNotice(`${fmtMoney(approval.amount, approval.currency)} non-binding check approval recorded and added to Team Activity. No funds were reserved or transferred.`);
    } catch (error) {
      ui.approvalRationale = rationale;
      showNotice(error instanceof Error ? error.message : "The check approval could not be recorded.", "warning");
    }
  });
  document.getElementById("queue-outreach-prepare-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const recordId = event.currentTarget.dataset.recordId;
    const data = new FormData(event.currentTarget);
    const contactId = String(data.get("contactId") || "");
    const approval = latestCheckApproval(ui.live, recordId);
    try {
      if (!approval) throw new Error("A recorded check approval is required before outreach.");
      const contacts = publicContactsForRecord(null, approval);
      const selectedContact = contactId ? contacts.find((contact) => contact.id === contactId) : null;
      if (contactId && !selectedContact) throw new Error("Choose a contact retained in the approved public-source snapshot.");
      ui.outreachContactSelection[recordId] = contactId;
      const prepared = prepareCheckOutreach(ui.live, {
        recordId,
        actor: ui.reviewer || approval.reviewer,
        selectedContact
      });
      ui.outreachDrafts[recordId] = {
        subject: prepared.approvalMessage.subject,
        body: prepared.approvalMessage.body
      };
      showNotice("Approval message generated locally. Nothing was sent and no funds were reserved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The approval message could not be generated.", "warning");
    }
  });
  document.querySelectorAll("[data-outreach-draft]").forEach((field) => {
    field.addEventListener("input", () => {
      const recordId = field.dataset.recordId;
      ui.outreachDrafts[recordId] = {
        ...(ui.outreachDrafts[recordId] || {}),
        [field.dataset.outreachDraft]: field.value
      };
    });
  });
  document.querySelectorAll("[data-copy-outreach]").forEach((button) => {
    button.addEventListener("click", async () => {
      const recordId = button.dataset.copyOutreach;
      try {
        const outreach = projectCheckOutreach(ui.live, recordId);
        const draft = ui.outreachDrafts[recordId] || {};
        const subject = draft.subject ?? outreach.approvalMessage.subject;
        const body = draft.body ?? outreach.approvalMessage.body;
        await copyTextForUser(`Subject: ${subject}\n\n${body}`);
        recordCheckOutreachAction(ui.live, {
          recordId,
          actionCode: CHECK_OUTREACH_ACTIONS.COPY_MESSAGE.code,
          actor: ui.reviewer || outreach.actor
        });
        showNotice("Approval message copied. Copying does not mark the startup as contacted.");
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "The message could not be copied.", "warning");
      }
    });
  });
  document.querySelectorAll("[data-open-mail-outreach]").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.openMailOutreach;
      try {
        const outreach = projectCheckOutreach(ui.live, recordId);
        if (outreach.selectedContact?.channel !== "BUSINESS_EMAIL") throw new Error("Choose a public business email before opening the email app.");
        const draft = ui.outreachDrafts[recordId] || {};
        const subject = draft.subject ?? outreach.approvalMessage.subject;
        const body = draft.body ?? outreach.approvalMessage.body;
        recordCheckOutreachAction(ui.live, {
          recordId,
          actionCode: CHECK_OUTREACH_ACTIONS.OPEN_MAIL_CLIENT.code,
          actor: ui.reviewer || outreach.actor
        });
        window.location.href = `mailto:${outreach.selectedContact.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "The email app could not be opened.", "warning");
      }
    });
  });
  document.querySelectorAll("[data-mark-contacted]").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.markContacted;
      try {
        const outreach = projectCheckOutreach(ui.live, recordId);
        recordCheckOutreachAction(ui.live, {
          recordId,
          actionCode: CHECK_OUTREACH_ACTIONS.MARK_CONTACTED.code,
          actor: ui.reviewer || outreach.actor
        });
        showNotice("Startup/founder marked as contacted. Recipient response is now awaiting confirmation.");
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "The contact status could not be recorded.", "warning");
      }
    });
  });
  document.getElementById("queue-outreach-response-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const recordId = event.currentTarget.dataset.recordId;
    const data = new FormData(event.currentTarget);
    try {
      const outreach = projectCheckOutreach(ui.live, recordId);
      const response = recordCheckRecipientResponse(ui.live, {
        recordId,
        response: String(data.get("response") || ""),
        actor: ui.reviewer || outreach.actor,
        note: String(data.get("note") || "")
      });
      showNotice(`Recipient response recorded: ${sentenceCase(response.recipientResponse)}. This still does not authorize a transfer.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "The recipient response could not be recorded.", "warning");
    }
  });
  document.querySelectorAll("[data-select-opportunity]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      ui.selectedOpportunityId = element.dataset.selectOpportunity;
      render();
    });
  });
  ["open-selected-case", "open-inspector-case"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      ui.view = "case";
      ui.caseTab = "overview";
      renderAtTop();
    });
  });
  document.getElementById("back-to-queue")?.addEventListener("click", () => {
    ui.view = "queue";
    renderAtTop();
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.caseTab = button.dataset.tab;
      renderAtTop();
    });
  });
  document.querySelectorAll("[data-claim-id]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      ui.selectedClaimId = element.dataset.claimId;
      render();
    });
  });
  document.querySelectorAll("[data-open-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedOpportunityId = button.dataset.openDecision;
      ui.view = "case";
      ui.caseTab = "decision";
      renderAtTop();
    });
  });
  bindProofEvents(state);
  bindDecisionEvents(state);
  bindThesisEvents(state);
  bindCheckSettings();
  bindLiveWorkspace({
    live: ui.live,
    thesis: state.thesis,
    tavily: ui.tavily,
    investmentPolicy: ui.investmentPolicy,
    persistSavedTrendsProfile: (profile) => {
      ui.live.savedTrendsProfile = profile;
      persistSavedTrendsProfile(profile);
    },
    rerender: (top = false) => (top ? renderAtTop() : render()),
    notice: (message) => showNotice(message)
  });
}

function bindCheckSettings() {
  document.getElementById("dynamic-check-toggle")?.addEventListener("change", (event) => {
    ui.investmentPolicy = {
      ...ui.investmentPolicy,
      mode: event.currentTarget.checked ? "RISK_ADJUSTED" : "FIXED"
    };
    render();
  });
  document.getElementById("check-policy-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const numberOrCurrent = (name) => {
      const value = data.get(name);
      return value == null || value === "" ? ui.investmentPolicy[name] : Number(value);
    };
    try {
      ui.investmentPolicy = {
        ...validateCheckPolicy({
          mode: data.get("dynamicEnabled") === "on" ? "RISK_ADJUSTED" : "FIXED",
          currency: String(data.get("currency") || "USD"),
          fixedAmount: numberOrCurrent("fixedAmount"),
          baseAmount: numberOrCurrent("baseAmount"),
          minimumAmount: numberOrCurrent("minimumAmount"),
          maximumAmount: numberOrCurrent("maximumAmount"),
          increment: numberOrCurrent("increment")
        })
      };
      persistInvestmentPolicy();
      showNotice("Check policy saved. Unapproved live assessments now show the recalculated non-binding amount; recorded approvals keep their original policy snapshot.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Check policy is invalid.", "warning");
    }
  });
}

function bindProofEvents(state) {
  const opportunity = state.opportunities.find((item) => item.id === ui.selectedOpportunityId);
  const transition = DEMO_TRANSITIONS[opportunity?.id];
  document.getElementById("simulate-submission")?.addEventListener("click", () => {
    if (!transition) return;
    commit("PROOF_SUBMITTED", transition.submit, { kind: "HUMAN", id: opportunity.founderName });
    showNotice("Synthetic evidence package received.");
  });
  document.getElementById("verify-submission")?.addEventListener("click", () => {
    if (!transition) return;
    commit("PROOF_VERIFIED", transition.verify, { kind: "HUMAN", id: "Technical reviewer" });
    showNotice("Evidence verified; linked claims and axes were recomputed.");
  });
  document.getElementById("run-live-research")?.addEventListener("click", runLiveResearch);
  document.querySelectorAll("[data-attach-lead]").forEach((button) => {
    button.addEventListener("click", () => attachLiveLead(Number(button.dataset.attachLead), state));
  });
}

async function runLiveResearch() {
  const opportunityId = ui.selectedOpportunityId;
  const queryElement = document.getElementById("live-query");
  const query = queryElement?.value.trim() || "";
  const current = ui.liveResearch[opportunityId] || {};
  ui.liveResearch[opportunityId] = { ...current, query, loading: true, error: null };
  render();
  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Live research failed.");
    ui.liveResearch[opportunityId] = {
      query,
      loading: false,
      error: null,
      answer: payload.answer,
      results: payload.results || [],
      requestId: payload.requestId
    };
  } catch (error) {
    ui.liveResearch[opportunityId] = {
      ...ui.liveResearch[opportunityId],
      loading: false,
      error: error instanceof Error ? error.message : "Live research failed."
    };
  }
  render();
}

function attachLiveLead(index, state) {
  const opportunity = state.opportunities.find((item) => item.id === ui.selectedOpportunityId);
  const result = ui.liveResearch[opportunity.id]?.results?.[index];
  if (!result) return;
  const marketClaim = opportunity.claims.find((claim) => claim.axis === "MARKET") || opportunity.claims[0];
  commit(
    "LIVE_LEAD_ATTACHED",
    {
      opportunityId: opportunity.id,
      claimId: marketClaim.id,
      evidence: {
        id: `LIVE-${Date.now()}-${index}`,
        kind: "REPUTABLE_SECONDARY",
        title: result.title,
        sourceUrl: result.url,
        excerpt: result.content,
        capturedAt: new Date().toISOString(),
        independenceGroup: result.url,
        entityMatchConfidence: 0.5,
        directness: 0.45,
        temporalFit: 0.6,
        sourceReliability: 0.5,
        recency: 0.7,
        syntheticFixture: false
      }
    },
    { kind: "HUMAN", id: ui.reviewer || "Reviewer" }
  );
  showNotice("Attached as an unreviewed lead; no score changed.");
}

function bindDecisionEvents(state) {
  document.querySelectorAll("[data-approval-check]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) ui.approvalChecks.add(checkbox.dataset.approvalCheck);
      else ui.approvalChecks.delete(checkbox.dataset.approvalCheck);
      render();
    });
  });
  document.getElementById("reviewer-name")?.addEventListener("input", (event) => {
    ui.reviewer = event.target.value;
    updateFreezeButton();
  });
  document.getElementById("approval-rationale")?.addEventListener("input", (event) => {
    ui.approvalRationale = event.target.value;
    updateFreezeButton();
  });
  document.getElementById("freeze-decision")?.addEventListener("click", () => {
    const currentState = fullState();
    const item = caseFor(currentState);
    if (!item || item.decision.code !== "RECOMMEND") return;
    commit(
      "DECISION_FROZEN",
      {
        opportunityId: item.opportunity.id,
        rationale: ui.approvalRationale.trim(),
        acknowledgements: [...ui.approvalChecks]
      },
      { kind: "HUMAN", id: ui.reviewer.trim() }
    );
    showNotice("Non-binding policy record frozen. No capital is reserved; future changes must be appended as amendments.");
  });
  document.getElementById("replay-range")?.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    const max = Math.max(...events.map((entry) => entry.seq));
    ui.replaySeq = value === max ? null : value;
    render();
  });
  document.querySelectorAll("[data-replay-seq]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = Number(button.dataset.replaySeq);
      const max = Math.max(...events.map((entry) => entry.seq));
      ui.replaySeq = value === max ? null : value;
      renderAtTop();
    });
  });
}

function updateFreezeButton() {
  const button = document.getElementById("freeze-decision");
  if (!button) return;
  const checksComplete = ["axes", "claims", "unknowns"].every((check) => ui.approvalChecks.has(check));
  const item = caseFor(fullState());
  button.disabled = !(
    item?.decision.code === "RECOMMEND" &&
    checksComplete &&
    ui.reviewer.trim() &&
    ui.approvalRationale.trim().length >= 12
  );
}

function bindThesisEvents(state) {
  document.getElementById("thesis-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const split = (name) => String(data.get(name) || "").split(",").map((item) => item.trim()).filter(Boolean);
    const current = state.thesis;
    commit("THESIS_UPDATED", {
      thesis: {
        name: String(data.get("name") || current.name),
        sectors: split("sectors"),
        stages: split("stages"),
        geographies: split("geographies"),
        checkSize: {
          min: Number(data.get("checkSize")),
          max: Number(data.get("checkSize")),
          currency: String(data.get("currency"))
        },
        ownershipMinPct: Number(data.get("ownershipMinPct")),
        ownershipMaxPct: Number(data.get("ownershipMaxPct")),
        riskAppetite: String(data.get("riskAppetite") || ""),
        axisRecommendFloors: Object.fromEntries(
          AXES.map((axis) => [axis, Number(data.get(`floor_${axis}`))])
        )
      }
    });
    showNotice("New thesis version saved; current proposals recomputed.");
  });
}

async function detectLiveResearch() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const payload = await response.json();
    ui.tavily = {
      configured: Boolean(payload.liveResearchConfigured),
      provider: payload.provider,
      exaConfigured: Boolean(payload.crossValidationConfigured),
      checked: true
    };
    try {
      const capabilityResponse = await fetch("/api/capabilities", { cache: "no-store" });
      ui.live.capabilities = capabilityResponse.ok ? await capabilityResponse.json() : null;
    } catch {
      ui.live.capabilities = null;
    }
  } catch {
    ui.tavily = { configured: false, provider: null, exaConfigured: false, checked: true };
    ui.live.capabilities = null;
  }
  render();
}

render();
detectLiveResearch();
