import {
  DEFAULT_CHECK_POLICY,
  calculatePolicyCheck,
  validateCheckPolicy
} from "./investment-policy.mjs";

export const QUEUE_NEXT_ACTIONS = Object.freeze({
  REQUEST_EVIDENCE: Object.freeze({ code: "REQUEST_EVIDENCE", label: "Request evidence" }),
  PASS_CURRENT_THESIS: Object.freeze({ code: "PASS_CURRENT_THESIS", label: "Pass current thesis" }),
  POLICY_SCREEN_ELIGIBLE: Object.freeze({ code: "POLICY_SCREEN_ELIGIBLE", label: "Policy screen eligible" })
});

export const QUEUE_NEXT_ACTION_CODES = Object.freeze(Object.keys(QUEUE_NEXT_ACTIONS));

export const NON_BINDING_CHECK_ACKNOWLEDGEMENTS = Object.freeze([
  Object.freeze({
    code: "EVIDENCE_REVIEWED",
    label: "I reviewed the cited evidence and entity match."
  }),
  Object.freeze({
    code: "TERMS_AND_DILIGENCE_REQUIRED",
    label: "Terms, legal, financial, compliance, and investment-committee diligence remain required."
  }),
  Object.freeze({
    code: "NON_BINDING_NO_FUNDS",
    label: "This record is non-binding and does not reserve or transfer funds."
  })
]);

const REQUIRED_ACKNOWLEDGEMENT_CODES = Object.freeze(
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((item) => item.code)
);

function normalizedCompanyName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function requireLiveState(live) {
  if (!live || typeof live !== "object" || !Array.isArray(live.assessments)) {
    throw new Error("A live workspace state with assessments is required.");
  }
  if (!Array.isArray(live.queueEvents)) live.queueEvents = [];
  if (!Array.isArray(live.queueWorkflowEvents)) live.queueWorkflowEvents = [];
  if (!Array.isArray(live.queueCheckApprovals)) live.queueCheckApprovals = [];
}

function requiredText(value, label, maximum = 2_000) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return text;
}

function optionalText(value, label, maximum = 2_000) {
  const text = String(value || "").trim();
  if (text.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return text;
}

function isoTimestamp(value, label) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(value).toISOString();
}

function codedError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

/**
 * Produces a stable key for public HTTP evidence. Tracking parameters,
 * fragments, default ports, a leading www, and a trailing path slash do not
 * create duplicate citations. HTTP and HTTPS variants are treated as the same
 * public resource.
 */
export function normalizedHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if ((url.protocol === "https:" && url.port === "443") || url.port === "80") url.port = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href.replace(/\?$/, "");
  } catch {
    return null;
  }
}

function evidenceUrl(item) {
  return normalizedHttpUrl(item?.sourceUrl || item?.url);
}

function dedupeEvidence(items) {
  const seenUrls = new Set();
  const seenLocalIds = new Set();
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = evidenceUrl(item);
    if (url) {
      if (seenUrls.has(url)) return [];
      seenUrls.add(url);
      return [item];
    }
    const localId = String(item.id || "").trim();
    if (localId && seenLocalIds.has(localId)) return [];
    if (localId) seenLocalIds.add(localId);
    return [item];
  });
}

function dedupeStrings(items) {
  const seen = new Set();
  return items.flatMap((item) => {
    const value = String(item || "").trim();
    if (!value) return [];
    const key = value.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

function dedupePublicLinks(items) {
  const seen = new Set();
  return items.flatMap((item) => {
    const key = normalizedHttpUrl(item);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [String(item)];
  });
}

const PUBLIC_CONTACT_CHANNELS = new Set([
  "OFFICIAL_WEBSITE",
  "CONTACT_PAGE",
  "BUSINESS_EMAIL",
  "BUSINESS_PHONE",
  "LINKEDIN",
  "PUBLIC_SOCIAL_PROFILE"
]);

function boundedContactText(value, maximum = 2_000) {
  const text = String(value || "").trim();
  return text && text.length <= maximum ? text : null;
}

function publicContactSnapshots(assessment) {
  const source = assessment?.publicContacts || assessment?.research?.publicContacts;
  if (!Array.isArray(source)) return [];
  const companyName = boundedContactText(assessment.companyName, 300);
  const founders = new Set((assessment.founderNames || []).map((name) => String(name).trim().toLowerCase()));
  const seen = new Set();
  const contacts = [];
  for (const item of source) {
    if (!item || item.publicProfessional !== true) continue;
    const id = boundedContactText(item.id, 300);
    const subjectType = boundedContactText(item.subjectType, 20)?.toUpperCase();
    const subjectName = boundedContactText(item.subjectName, 300);
    const channel = boundedContactText(item.channel, 40)?.toUpperCase();
    const label = boundedContactText(item.label, 300);
    const sourceUrl = normalizedHttpUrl(item.sourceUrl);
    let value = boundedContactText(item.value);
    const subjectMatches = subjectType === "STARTUP"
      ? Boolean(companyName && subjectName?.toLowerCase() === companyName.toLowerCase())
      : subjectType === "FOUNDER" && founders.has(String(subjectName || "").toLowerCase());
    if (!id || !subjectMatches || !PUBLIC_CONTACT_CHANNELS.has(channel) || !sourceUrl || !value) continue;
    if (channel === "BUSINESS_EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue;
    if (channel === "BUSINESS_PHONE" && !/^\+?[0-9().\-\s]{7,30}$/.test(value)) continue;
    if (["OFFICIAL_WEBSITE", "CONTACT_PAGE", "LINKEDIN", "PUBLIC_SOCIAL_PROFILE"].includes(channel)) {
      value = normalizedHttpUrl(value);
      if (!value) continue;
    }
    const key = `${subjectType}|${subjectName}|${channel}|${value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({
      id,
      subjectType,
      subjectName,
      channel,
      label,
      value,
      sourceUrl,
      verificationState: boundedContactText(item.verificationState, 100),
      captureMethod: boundedContactText(item.captureMethod, 100),
      publicProfessional: true
    });
    if (contacts.length >= 12) break;
  }
  return contacts;
}

function canonicalRecordId(live, value) {
  const recordId = requiredText(value, "Queue record ID", 300);
  const queueEvent = live.queueEvents.find((event) =>
    event?.type === "LIVE_ASSESSMENT_QUEUED" &&
    (event.assessmentId === recordId || `ASSESSMENT-${event.assessmentId}` === recordId)
  );
  return queueEvent ? `ASSESSMENT-${queueEvent.assessmentId}` : recordId;
}

function assessmentQueueEvent(live, recordId) {
  return live.queueEvents.find((event) =>
    event?.type === "LIVE_ASSESSMENT_QUEUED" && `ASSESSMENT-${event.assessmentId}` === recordId
  ) || null;
}

export function isAssessmentQueued(live, assessmentId) {
  return Array.isArray(live?.queueEvents) && live.queueEvents.some((event) =>
    event.type === "LIVE_ASSESSMENT_QUEUED" && event.assessmentId === assessmentId
  );
}

export function queueAssessment(live, assessmentId, occurredAt = new Date().toISOString()) {
  requireLiveState(live);
  const assessment = live.assessments.find((item) => item.id === assessmentId);
  if (!assessment) throw new Error("Only an existing session assessment can be added to the Queue.");
  const existing = live.queueEvents.find((event) =>
    event.type === "LIVE_ASSESSMENT_QUEUED" && event.assessmentId === assessmentId
  );
  if (existing) return existing;
  const normalizedTime = isoTimestamp(occurredAt, "Queue event time");
  const event = Object.freeze({
    eventId: `QUEUE-${assessmentId}-${Date.parse(normalizedTime)}`,
    type: "LIVE_ASSESSMENT_QUEUED",
    assessmentId,
    occurredAt: normalizedTime,
    actor: "LOCAL_HUMAN_SESSION"
  });
  live.queueEvents = [event, ...live.queueEvents];
  live.selectedQueueId = `ASSESSMENT-${assessmentId}`;
  return event;
}

export function removeQueuedAssessment(live, assessmentId) {
  requireLiveState(live);
  const before = live.queueEvents.length;
  live.queueEvents = live.queueEvents.filter((event) => !(
    event.type === "LIVE_ASSESSMENT_QUEUED" && event.assessmentId === assessmentId
  ));
  return live.queueEvents.length !== before;
}

function selectedQueueScore(assessment) {
  if (assessment.demoSnapshot && assessment.reviewedScore?.mode === "REVIEWED") {
    return assessment.reviewedScore;
  }
  return assessment.provisionalScore;
}

function assessmentRecord(assessment, event, frozenLead = null) {
  const score = selectedQueueScore(assessment);
  const assessmentEvidence = Array.isArray(assessment.evidence) ? assessment.evidence : [];
  const frozenEvidence = Array.isArray(frozenLead?.evidence) ? frozenLead.evidence : [];
  const evidence = dedupeEvidence([...assessmentEvidence, ...frozenEvidence]);
  const evidenceLinks = evidence.map((item) => item.sourceUrl || item.url);
  const frozenLinks = Array.isArray(frozenLead?.links) ? frozenLead.links : [];
  const links = dedupePublicLinks([...evidenceLinks, ...frozenLinks]);
  const unknowns = dedupeStrings([
    ...(assessment.research?.caveats || []),
    ...(frozenLead?.unknowns || [])
  ]);
  const sourceCount = Number(assessment.research?.sourceCount) || assessmentEvidence.length;
  const publicContacts = publicContactSnapshots(assessment);
  return Object.freeze({
    ...(frozenLead || {}),
    id: `ASSESSMENT-${assessment.id}`,
    recordType: "LIVE_ASSESSMENT",
    assessmentId: assessment.id,
    companyName: assessment.companyName || frozenLead?.companyName || "Unidentified startup",
    founderNames: Object.freeze(dedupeStrings([
      ...(assessment.founderNames || []),
      ...(frozenLead?.founderNames || [])
    ])),
    // A matching frozen sourced lead remains the authority for its historical
    // sector, financing stage, and financing statement. A live refresh must
    // not silently replace those facts with generic placeholders.
    sector: frozenLead?.sector || assessment.sector || "Live assessment",
    stage: frozenLead?.stage || assessment.stage || "NOT_ESTABLISHED",
    fundingAsReported: frozenLead?.fundingAsReported || assessment.fundingAsReported || "Not established by this assessment",
    summary: assessment.research?.summary || frozenLead?.summary || "Current public-source assessment added from this session.",
    context: frozenLead?.context || assessment.context || null,
    sourceDate: frozenLead?.sourceDate || event.occurredAt.slice(0, 10),
    verificationStatus: score?.mode === "REVIEWED" ? "REVIEWED" : "UNREVIEWED",
    currentVerification: frozenLead?.currentVerification || null,
    unknowns: Object.freeze(unknowns),
    publicContacts: Object.freeze(publicContacts.map((contact) => Object.freeze(contact))),
    contactDiscovery: assessment.contactDiscovery || assessment.research?.contactDiscovery
      ? immutableClone(assessment.contactDiscovery || assessment.research?.contactDiscovery)
      : null,
    evidence: Object.freeze(evidence),
    engineSnapshot: Object.freeze({
      researchId: assessment.research?.researchId || assessment.id,
      provider: assessment.research?.provider || "Frozen public-source snapshot",
      sourceCount,
      retainedCitationCount: evidence.length,
      scoreMode: score?.mode || "PROVISIONAL",
      opportunityScore: Number.isFinite(score?.opportunityScore) ? score.opportunityScore : null,
      coveragePercentage: Number(score?.coverage?.percentage) || 0,
      uncertaintyPoints: Number.isFinite(score?.uncertainty?.points)
        ? score.uncertainty.points
        : null,
      uncertaintyLevel: score?.uncertainty?.level || null,
      uncertaintyBand: score?.uncertainty?.band ? immutableClone(score.uncertainty.band) : null,
      scoreMeaning: "Evidence-weighted opportunity screen, not a success probability, valuation, or investment decision.",
      coveredCriteria: Number(score?.coverage?.coveredCriteria) || 0,
      totalCriteria: Number(score?.coverage?.totalCriteria) || 0,
      dimensions: Object.freeze((score?.dimensions || []).map((dimension) => Object.freeze({
        key: dimension.key,
        label: dimension.label,
        score: Number.isFinite(dimension.score) ? dimension.score : null,
        coverage: Number(dimension.coverage) || 0,
        confidence: Number(dimension.confidence) || 0
      }))),
      comparisons: score?.comparisons ? immutableClone(score.comparisons) : null,
      generatedAt: assessment.research?.generatedAt || event.occurredAt
    }),
    sourceLeadId: frozenLead?.id || null,
    frozenLeadSnapshot: frozenLead,
    priorEngineSnapshot: frozenLead?.engineSnapshot || null,
    links: Object.freeze(links),
    queueEvent: event
  });
}

export function projectLiveQueue(live, sourcedLeads = []) {
  requireLiveState(live);
  const assessed = live.queueEvents.flatMap((event) => {
    if (event.type !== "LIVE_ASSESSMENT_QUEUED") return [];
    const assessment = live.assessments.find((item) => item.id === event.assessmentId);
    if (!assessment) return [];
    const frozenLead = sourcedLeads.find((lead) =>
      normalizedCompanyName(lead.companyName) === normalizedCompanyName(assessment.companyName)
    ) || null;
    return [assessmentRecord(assessment, event, frozenLead)];
  });
  const assessedNames = new Set(assessed.map((item) => normalizedCompanyName(item.companyName)));
  return [
    ...assessed,
    ...sourcedLeads.filter((lead) => !assessedNames.has(normalizedCompanyName(lead.companyName)))
  ];
}

function actionDefinition(actionCode) {
  const action = QUEUE_NEXT_ACTIONS[String(actionCode || "").trim()];
  if (!action) {
    throw new Error(`Queue action must be one of ${QUEUE_NEXT_ACTION_CODES.join(", ")}.`);
  }
  return action;
}

/**
 * Appends a human workflow instruction. POLICY_SCREEN_ELIGIBLE here only means
 * "send this record to the policy screen"; it is never itself a policy result.
 */
export function setQueueNextAction(
  live,
  recordId,
  actionCode,
  note = "",
  actor = "LOCAL_HUMAN_SESSION",
  occurredAt = new Date().toISOString()
) {
  requireLiveState(live);
  const canonicalId = canonicalRecordId(live, recordId);
  const action = actionDefinition(actionCode);
  const normalizedNote = optionalText(note, "Queue action note");
  const normalizedActor = requiredText(actor, "Queue action actor", 200);
  const normalizedTime = isoTimestamp(occurredAt, "Queue action time");
  const event = Object.freeze({
    eventId: `QUEUE-ACTION-${Date.parse(normalizedTime)}-${live.queueWorkflowEvents.length + 1}`,
    type: "QUEUE_NEXT_ACTION_SET",
    recordId: canonicalId,
    actionCode: action.code,
    actionLabel: action.label,
    note: normalizedNote,
    actor: normalizedActor,
    occurredAt: normalizedTime,
    origin: normalizedActor === "PROOFLINE_CURATED_PUBLIC_DEMO" ? "CURATED_DEMO_DEFAULT" : "HUMAN_EDITED",
    policyResult: false,
    binding: false
  });
  live.queueWorkflowEvents = [...live.queueWorkflowEvents, event];
  return event;
}

function fallbackActionProjection(fallbackAction) {
  if (!fallbackAction) return null;
  const code = typeof fallbackAction === "string"
    ? fallbackAction
    : fallbackAction.code || fallbackAction.actionCode;
  const action = actionDefinition(code);
  return Object.freeze({
    eventId: null,
    actionCode: action.code,
    code: action.code,
    label: fallbackAction.label || action.label,
    note: fallbackAction.note || "",
    actor: fallbackAction.actor || null,
    occurredAt: fallbackAction.occurredAt || null,
    origin: fallbackAction.simulation ? "SIMULATED_DEFAULT" : "DEFAULT",
    policyResult: false,
    binding: false
  });
}

export function projectQueueNextAction(live, recordId, fallbackAction = null) {
  requireLiveState(live);
  const canonicalId = canonicalRecordId(live, recordId);
  for (let index = live.queueWorkflowEvents.length - 1; index >= 0; index -= 1) {
    const event = live.queueWorkflowEvents[index];
    if (event.type !== "QUEUE_NEXT_ACTION_SET" || event.recordId !== canonicalId) continue;
    return Object.freeze({
      ...event,
      code: event.actionCode,
      label: event.actionLabel
    });
  }
  return fallbackActionProjection(fallbackAction);
}

function acknowledgedCodes(value) {
  if (Array.isArray(value)) return new Set(value.map((item) => String(item)));
  if (value && typeof value === "object") {
    return new Set(Object.entries(value).filter(([, checked]) => checked === true).map(([code]) => code));
  }
  return new Set();
}

function researchSnapshot(assessment) {
  const research = assessment.research || {};
  const evidence = dedupeEvidence(assessment.evidence || []).map((item) => ({
    id: item.id || null,
    title: item.title || null,
    url: item.sourceUrl || item.url || null,
    publishedAt: item.publishedAt || null,
    capturedAt: item.capturedAt || null,
    reviewState: item.reviewState || null,
    sourceType: item.sourceType || null
  }));
  return immutableClone({
    researchId: research.researchId || assessment.id,
    generatedAt: research.generatedAt || null,
    provider: research.provider || null,
    summary: research.summary || null,
    sourceCount: Number(research.sourceCount) || evidence.length,
    retainedCitationCount: evidence.length,
    caveats: [...(research.caveats || [])],
    usage: research.usage || null,
    crossValidation: research.crossValidation || null,
    evidence,
    reviewEventIds: (assessment.reviewEvents || []).map((event) => event.id),
    demoSnapshot: assessment.demoSnapshot || null
  });
}

function approvedOpportunitySnapshot(assessment) {
  const evidenceLinks = (Array.isArray(assessment.evidence) ? assessment.evidence : [])
    .map((item) => item?.sourceUrl || item?.url);
  const assessmentLinks = Array.isArray(assessment.links) ? assessment.links : [];
  const publicContacts = publicContactSnapshots(assessment);
  return {
    companyName: String(assessment.companyName || "Unidentified startup").trim() || "Unidentified startup",
    founderNames: dedupeStrings(assessment.founderNames || []),
    sector: String(assessment.sector || "Not established").trim() || "Not established",
    stage: String(assessment.stage || "NOT_ESTABLISHED").trim() || "NOT_ESTABLISHED",
    fundingAsReported: String(
      assessment.fundingAsReported || "Not established by this assessment"
    ).trim() || "Not established by this assessment",
    context: String(assessment.context || "").trim() || null,
    summary: String(
      assessment.research?.summary || "Reviewed public-source assessment."
    ).trim() || "Reviewed public-source assessment.",
    verificationStatus: assessment.reviewedScore?.mode === "REVIEWED" ? "REVIEWED" : "UNREVIEWED",
    links: dedupePublicLinks([...assessmentLinks, ...evidenceLinks]),
    ...(publicContacts.length ? { publicContacts } : {})
  };
}

export function latestCheckApproval(live, recordId) {
  requireLiveState(live);
  const canonicalId = canonicalRecordId(live, recordId);
  for (let index = live.queueCheckApprovals.length - 1; index >= 0; index -= 1) {
    const approval = live.queueCheckApprovals[index];
    if (approval.type === "NON_BINDING_CHECK_APPROVAL_RECORDED" && approval.recordId === canonicalId) {
      return approval;
    }
  }
  return null;
}

/**
 * Records an immutable, non-binding policy-screen result. The amount is always
 * recomputed from the queued assessment's reviewed score and the validated
 * policy; caller-supplied amount/context fields are deliberately ignored.
 */
export function recordNonBindingCheckApproval(live, options = {}) {
  requireLiveState(live);
  const canonicalId = canonicalRecordId(live, options.recordId);
  const existing = latestCheckApproval(live, canonicalId);
  if (existing) return existing;

  const queueEvent = assessmentQueueEvent(live, canonicalId);
  if (!queueEvent) {
    throw codedError(
      "Only a queued live reviewed assessment can record a check approval.",
      "QUEUED_REVIEWED_ASSESSMENT_REQUIRED"
    );
  }
  const assessment = live.assessments.find((item) => item.id === queueEvent.assessmentId);
  if (!assessment || assessment.reviewedScore?.mode !== "REVIEWED") {
    throw codedError(
      "A reviewed assessment score is required before a check can be recorded.",
      "REVIEWED_SCORE_REQUIRED"
    );
  }

  const savedAction = projectQueueNextAction(live, canonicalId);
  if (savedAction?.actionCode !== "POLICY_SCREEN_ELIGIBLE" || !savedAction.eventId) {
    throw codedError(
      "Save Policy screen eligible as the next action before recording a check.",
      "POLICY_SCREEN_ACTION_REQUIRED"
    );
  }

  const reviewer = requiredText(options.reviewer, "Reviewer", 200);
  const rationale = requiredText(options.rationale, "Approval rationale", 4_000);
  const acknowledgementSet = acknowledgedCodes(options.acknowledgements);
  const missingAcknowledgements = REQUIRED_ACKNOWLEDGEMENT_CODES.filter((code) => !acknowledgementSet.has(code));
  if (missingAcknowledgements.length) {
    throw codedError(
      `All non-binding check acknowledgements are required: ${missingAcknowledgements.join(", ")}.`,
      "CHECK_ACKNOWLEDGEMENTS_REQUIRED",
      { missingAcknowledgements }
    );
  }

  const policy = validateCheckPolicy(options.policy || DEFAULT_CHECK_POLICY);
  const policyContext = {
    identityConfirmed: assessment.identityConfirmed === true,
    thesisMatch: assessment.thesisMatch === true,
    complianceHold: assessment.complianceHold
  };
  const check = calculatePolicyCheck(assessment.reviewedScore, policy, policyContext);
  if (!check.eligibility.eligible || !Number.isFinite(check.amount)) {
    throw codedError(
      `The reviewed assessment does not clear the current policy gates: ${check.eligibility.failed.join(", ")}.`,
      "POLICY_GATES_FAILED",
      { failedGates: [...check.eligibility.failed], policyCheck: immutableClone(check) }
    );
  }
  if (check.binding !== false || check.fundsReserved !== false || check.transferAuthorized !== false) {
    throw codedError("The policy engine did not return a non-binding result.", "UNSAFE_POLICY_RESULT");
  }

  const occurredAt = isoTimestamp(options.occurredAt || new Date().toISOString(), "Check approval time");
  const event = deepFreeze({
    approvalId: `CHECK-APPROVAL-${Date.parse(occurredAt)}-${live.queueCheckApprovals.length + 1}`,
    type: "NON_BINDING_CHECK_APPROVAL_RECORDED",
    status: "NON_BINDING_RECORDED",
    recordId: canonicalId,
    assessmentId: assessment.id,
    queueEventId: queueEvent.eventId,
    workflowEventId: savedAction.eventId,
    reviewer,
    rationale,
    acknowledgements: [...REQUIRED_ACKNOWLEDGEMENT_CODES],
    occurredAt,
    amount: check.amount,
    currency: check.currency,
    mode: check.mode,
    riskIndex: check.riskIndex,
    riskBand: check.riskBand,
    policyVersion: check.policyVersion,
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    policySnapshot: immutableClone(policy),
    policyCheckSnapshot: immutableClone(check),
    scoreSnapshot: immutableClone(assessment.reviewedScore),
    researchSnapshot: researchSnapshot(assessment),
    opportunitySnapshot: approvedOpportunitySnapshot(assessment)
  });
  live.queueCheckApprovals = [...live.queueCheckApprovals, event];
  return event;
}
