import { latestCheckApproval } from "./live-queue.mjs";

export const CHECK_OUTREACH_CONTACT_STATUSES = Object.freeze([
  "READY_TO_CONTACT",
  "CONTACTED"
]);

export const CHECK_OUTREACH_RESPONSE_STATUSES = Object.freeze([
  "AWAITING_RESPONSE",
  "ACCEPTED",
  "DECLINED"
]);

export const CHECK_OUTREACH_ACTIONS = Object.freeze({
  COPY_MESSAGE: Object.freeze({
    code: "COPY_MESSAGE",
    label: "Copy approval message"
  }),
  OPEN_MAIL_CLIENT: Object.freeze({
    code: "OPEN_MAIL_CLIENT",
    label: "Open mail client"
  }),
  MARK_CONTACTED: Object.freeze({
    code: "MARK_CONTACTED",
    label: "Mark as contacted"
  })
});

export const PUBLIC_PROFESSIONAL_CONTACT_CHANNELS = Object.freeze([
  "OFFICIAL_WEBSITE",
  "CONTACT_PAGE",
  "BUSINESS_EMAIL",
  "BUSINESS_PHONE",
  "LINKEDIN",
  "PUBLIC_SOCIAL_PROFILE"
]);

const SUBJECT_TYPES = Object.freeze(["STARTUP", "FOUNDER"]);
const PREPARE_KEYS = new Set(["recordId", "actor", "selectedContact", "occurredAt"]);
const ACTION_KEYS = new Set(["recordId", "actionCode", "actor", "occurredAt", "idempotencyKey"]);
const RESPONSE_KEYS = new Set(["recordId", "response", "actor", "note", "occurredAt"]);
const CONTACT_KEYS = new Set([
  "id",
  "subjectType",
  "subjectName",
  "channel",
  "label",
  "value",
  "sourceUrl",
  "verificationState",
  "captureMethod",
  "publicProfessional"
]);
const MACHINE_ACTORS = new Set([
  "AI",
  "AUTOMATION",
  "LOCAL_HUMAN_SESSION",
  "PROOFLINE",
  "SYSTEM"
]);

function codedError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertKnownKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw codedError(`${label} must be a plain object.`, "INVALID_INPUT_SHAPE");
  const unknownFields = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownFields.length) {
    throw codedError(
      `${label} contains unsupported fields: ${unknownFields.join(", ")}.`,
      "UNKNOWN_INPUT_FIELDS",
      { unknownFields: Object.freeze([...unknownFields]) }
    );
  }
}

function requiredText(value, label, maximum = 2_000) {
  if (typeof value !== "string") throw codedError(`${label} must be text.`, "INVALID_INPUT");
  const text = value.trim();
  if (!text) throw codedError(`${label} is required.`, "INVALID_INPUT");
  if (text.length > maximum) throw codedError(`${label} must be ${maximum} characters or fewer.`, "INVALID_INPUT");
  return text;
}

function optionalText(value, label, maximum = 2_000) {
  if (value == null) return null;
  if (typeof value !== "string") throw codedError(`${label} must be text.`, "INVALID_INPUT");
  const text = value.trim();
  if (text.length > maximum) throw codedError(`${label} must be ${maximum} characters or fewer.`, "INVALID_INPUT");
  return text || null;
}

function namedActor(value) {
  const actor = requiredText(value, "Named actor", 200);
  if (/[\u0000-\u001f\u007f]/.test(actor)) {
    throw codedError("A named human actor must be a single line of text.", "NAMED_HUMAN_ACTOR_REQUIRED");
  }
  if (MACHINE_ACTORS.has(actor.toUpperCase())) {
    throw codedError("A named human actor is required.", "NAMED_HUMAN_ACTOR_REQUIRED");
  }
  return actor;
}

function isoTimestamp(value, label) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw codedError(`${label} must be a valid timestamp.`, "INVALID_TIMESTAMP");
  }
  return new Date(value).toISOString();
}

function unsafeHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(?:0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return /^(?:::|::1|fc|fd|fe8|fe9|fea|feb)/i.test(host);
}

function httpUrl(value, label) {
  try {
    const url = new URL(requiredText(value, label, 2_000));
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      unsafeHost(url.hostname)
    ) throw new Error("not public HTTP");
    url.hash = "";
    return url.href;
  } catch {
    throw codedError(`${label} must be a public HTTP or HTTPS URL.`, "INVALID_PUBLIC_CONTACT");
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function immutableClone(value) {
  return deepFreeze(structuredClone(value));
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function requireLiveState(live) {
  if (!isPlainObject(live) || !Array.isArray(live.assessments)) {
    throw codedError("A live workspace state with assessments is required.", "LIVE_STATE_REQUIRED");
  }
  if (!Array.isArray(live.checkOutreachEvents)) live.checkOutreachEvents = [];
  return live;
}

function genuineApproval(live, recordId) {
  requireLiveState(live);
  const normalizedRecordId = requiredText(recordId, "Queue record ID", 300);
  const approval = latestCheckApproval(live, normalizedRecordId);
  if (!approval) {
    throw codedError(
      "Outreach is unavailable until a genuine non-binding check approval has been recorded.",
      "CHECK_APPROVAL_REQUIRED"
    );
  }

  const queueEvent = live.queueEvents?.find((event) =>
    event?.eventId === approval.queueEventId &&
    event?.type === "LIVE_ASSESSMENT_QUEUED" &&
    event?.assessmentId === approval.assessmentId
  );
  const workflowEvent = live.queueWorkflowEvents?.find((event) =>
    event?.eventId === approval.workflowEventId &&
    event?.type === "QUEUE_NEXT_ACTION_SET" &&
    event?.recordId === approval.recordId &&
    event?.actionCode === "POLICY_SCREEN_ELIGIBLE"
  );
  const requiredSnapshots = [
    approval.opportunitySnapshot,
    approval.policySnapshot,
    approval.policyCheckSnapshot,
    approval.scoreSnapshot,
    approval.researchSnapshot
  ];
  const isSafeApproval =
    approval.type === "NON_BINDING_CHECK_APPROVAL_RECORDED" &&
    approval.status === "NON_BINDING_RECORDED" &&
    typeof approval.approvalId === "string" &&
    approval.approvalId.length > 0 &&
    typeof approval.reviewer === "string" &&
    approval.reviewer.trim().length > 0 &&
    Number.isFinite(approval.amount) &&
    approval.amount > 0 &&
    typeof approval.currency === "string" &&
    /^[A-Z]{3}$/.test(approval.currency) &&
    approval.binding === false &&
    approval.fundsReserved === false &&
    approval.transferAuthorized === false &&
    approval.policyCheckSnapshot?.binding === false &&
    approval.policyCheckSnapshot?.fundsReserved === false &&
    approval.policyCheckSnapshot?.transferAuthorized === false &&
    approval.policyCheckSnapshot?.amount === approval.amount &&
    approval.policyCheckSnapshot?.currency === approval.currency &&
    requiredSnapshots.every((snapshot) => isPlainObject(snapshot)) &&
    isDeepFrozen(approval) &&
    queueEvent &&
    workflowEvent;

  if (!isSafeApproval) {
    throw codedError(
      "The check record is incomplete, mutable, or does not prove the required approval workflow.",
      "INVALID_CHECK_APPROVAL"
    );
  }
  return approval;
}

function normalizedEntityName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function messageLine(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function contactSnapshot(value, approval) {
  if (value == null) return null;
  assertKnownKeys(value, CONTACT_KEYS, "Selected public contact");
  if (value.publicProfessional !== true) {
    throw codedError(
      "A selected contact must be explicitly classified as public professional information.",
      "INVALID_PUBLIC_CONTACT"
    );
  }
  const subjectType = requiredText(value.subjectType, "Contact subject type", 20).toUpperCase();
  if (!SUBJECT_TYPES.includes(subjectType)) {
    throw codedError(`Contact subject type must be one of ${SUBJECT_TYPES.join(", ")}.`, "INVALID_PUBLIC_CONTACT");
  }
  const channel = requiredText(value.channel, "Contact channel", 40).toUpperCase();
  if (!PUBLIC_PROFESSIONAL_CONTACT_CHANNELS.includes(channel)) {
    throw codedError(
      `Contact channel must be one of ${PUBLIC_PROFESSIONAL_CONTACT_CHANNELS.join(", ")}.`,
      "INVALID_PUBLIC_CONTACT"
    );
  }
  const contactValue = requiredText(value.value, "Contact value", 2_000);
  if (channel === "BUSINESS_EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
    throw codedError("A business-email contact must contain a valid email address.", "INVALID_PUBLIC_CONTACT");
  }
  if (channel === "BUSINESS_PHONE" && !/^\+?[0-9().\-\s]{7,30}$/.test(contactValue)) {
    throw codedError("A business-phone contact must contain a valid public business number.", "INVALID_PUBLIC_CONTACT");
  }
  if (["OFFICIAL_WEBSITE", "CONTACT_PAGE", "LINKEDIN", "PUBLIC_SOCIAL_PROFILE"].includes(channel)) {
    httpUrl(contactValue, "Contact value");
  }
  const subjectName = requiredText(value.subjectName, "Contact subject name", 300);
  if (/[\u0000-\u001f\u007f]/.test(subjectName)) {
    throw codedError("Contact subject name must be a single line of text.", "INVALID_PUBLIC_CONTACT");
  }
  const approvedSubjectNames = subjectType === "STARTUP"
    ? [approval.opportunitySnapshot.companyName]
    : approval.opportunitySnapshot.founderNames;
  if (!approvedSubjectNames.some((name) => normalizedEntityName(name) === normalizedEntityName(subjectName))) {
    throw codedError(
      "The selected contact must belong to the approved startup or one of its approved founders.",
      "CONTACT_SUBJECT_MISMATCH"
    );
  }
  return immutableClone({
    id: requiredText(value.id, "Contact ID", 300),
    subjectType,
    subjectName,
    channel,
    label: optionalText(value.label, "Contact label", 300),
    value: contactValue,
    sourceUrl: httpUrl(value.sourceUrl, "Contact source URL"),
    verificationState: optionalText(value.verificationState, "Contact verification state", 100),
    captureMethod: optionalText(value.captureMethod, "Contact capture method", 100),
    publicProfessional: true
  });
}

function moneyText(amount, currency) {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
}

function approvalMessage(approval, actor, contact) {
  const companyName = messageLine(approval.opportunitySnapshot.companyName) || "the approved startup";
  const greeting = contact
    ? `Hello ${messageLine(contact.subjectName)},`
    : `Hello ${companyName} team,`;
  const amount = moneyText(approval.amount, approval.currency);
  return immutableClone({
    templateId: "CHECK_APPROVAL_NOTICE_V1",
    subject: `Proofline check approval — ${companyName}`,
    body: [
      greeting,
      "",
      `Following our review, I’m pleased to let you know that ${companyName} has been approved for a non-binding check of ${amount}, subject to final terms and legal, financial, compliance, and investment-committee diligence.`,
      "",
      "This approval does not reserve funds, authorize a transfer, or guarantee an investment. We would like to arrange a conversation to confirm the details and discuss next steps.",
      "",
      "Please reply if you would like to continue.",
      "",
      "Best,",
      actor
    ].join("\n"),
    generatedFromApprovalId: approval.approvalId,
    editableBeforeUse: true,
    externallySent: false
  });
}

function outreachId(approval) {
  return `CHECK-OUTREACH-${approval.approvalId}`;
}

function preparationEvent(live, approval) {
  const id = outreachId(approval);
  return live.checkOutreachEvents.find((event) =>
    event?.type === "CHECK_OUTREACH_PREPARED" &&
    event?.outreachId === id &&
    event?.approvalId === approval.approvalId
  ) || null;
}

function requirePrepared(live, approval) {
  const prepared = preparationEvent(live, approval);
  if (!prepared) {
    throw codedError(
      "Prepare the approval message before viewing or recording outreach activity.",
      "CHECK_OUTREACH_NOT_PREPARED"
    );
  }
  return prepared;
}

function appendEvent(live, event) {
  const frozen = deepFreeze(event);
  live.checkOutreachEvents = [...live.checkOutreachEvents, frozen];
  return frozen;
}

/**
 * Creates the one session-local outreach record allowed for an immutable check
 * approval. It generates message content but performs no clipboard, mail-client,
 * network, reservation, or transfer side effect.
 */
export function prepareCheckOutreach(live, options = {}) {
  assertKnownKeys(options, PREPARE_KEYS, "Check outreach options");
  const approval = genuineApproval(live, options.recordId);
  const existing = preparationEvent(live, approval);
  if (existing) return existing;

  const actor = namedActor(options.actor);
  const selectedContact = contactSnapshot(options.selectedContact, approval);
  const occurredAt = isoTimestamp(options.occurredAt || new Date().toISOString(), "Outreach preparation time");
  const id = outreachId(approval);
  const opportunitySnapshot = immutableClone(approval.opportunitySnapshot);
  const founderSnapshot = immutableClone({ names: approval.opportunitySnapshot.founderNames });
  const checkSnapshot = immutableClone({
    approvalId: approval.approvalId,
    recordId: approval.recordId,
    assessmentId: approval.assessmentId,
    reviewer: approval.reviewer,
    rationale: approval.rationale,
    acknowledgements: approval.acknowledgements,
    occurredAt: approval.occurredAt,
    amount: approval.amount,
    currency: approval.currency,
    mode: approval.mode,
    riskIndex: approval.riskIndex,
    riskBand: approval.riskBand,
    policyVersion: approval.policyVersion,
    policySnapshot: approval.policySnapshot,
    policyCheckSnapshot: approval.policyCheckSnapshot,
    scoreSnapshot: approval.scoreSnapshot,
    researchSnapshot: approval.researchSnapshot,
    binding: false,
    fundsReserved: false,
    transferAuthorized: false
  });

  return appendEvent(live, {
    eventId: `${id}-PREPARED`,
    type: "CHECK_OUTREACH_PREPARED",
    outreachId: id,
    approvalId: approval.approvalId,
    recordId: approval.recordId,
    assessmentId: approval.assessmentId,
    actor,
    occurredAt,
    contactStatus: "READY_TO_CONTACT",
    recipientResponse: "AWAITING_RESPONSE",
    selectedContact,
    opportunitySnapshot,
    founderSnapshot,
    checkSnapshot,
    approvalMessage: approvalMessage(approval, actor, selectedContact),
    sessionLocal: true,
    messageDelivery: "USER_CONTROLLED",
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    externalTransmissionPerformed: false
  });
}

/**
 * Records a local UI action. OPEN_MAIL_CLIENT means only that the user opened a
 * composer; it is not evidence that a message was transmitted.
 */
export function recordCheckOutreachAction(live, options = {}) {
  assertKnownKeys(options, ACTION_KEYS, "Check outreach action options");
  const approval = genuineApproval(live, options.recordId);
  const prepared = requirePrepared(live, approval);
  const actionCode = requiredText(options.actionCode, "Outreach action", 50).toUpperCase();
  const action = CHECK_OUTREACH_ACTIONS[actionCode];
  if (!action) {
    throw codedError(
      `Outreach action must be one of ${Object.keys(CHECK_OUTREACH_ACTIONS).join(", ")}.`,
      "INVALID_OUTREACH_ACTION"
    );
  }
  if (actionCode === "OPEN_MAIL_CLIENT" && prepared.selectedContact?.channel !== "BUSINESS_EMAIL") {
    throw codedError(
      "Open mail client requires a selected public business-email contact.",
      "BUSINESS_EMAIL_CONTACT_REQUIRED"
    );
  }
  const actor = namedActor(options.actor);
  const idempotencyKey = optionalText(options.idempotencyKey, "Idempotency key", 200) || actionCode;
  const existing = live.checkOutreachEvents.find((event) =>
    event?.type === "CHECK_OUTREACH_ACTION_RECORDED" &&
    event?.outreachId === prepared.outreachId &&
    event?.idempotencyKey === idempotencyKey
  );
  if (existing) {
    if (existing.actionCode !== actionCode) {
      throw codedError("The idempotency key is already associated with another action.", "IDEMPOTENCY_CONFLICT");
    }
    return existing;
  }
  if (actionCode === "MARK_CONTACTED") {
    const contacted = live.checkOutreachEvents.find((event) =>
      event?.type === "CHECK_OUTREACH_ACTION_RECORDED" &&
      event?.outreachId === prepared.outreachId &&
      event?.actionCode === "MARK_CONTACTED"
    );
    if (contacted) return contacted;
  }
  const occurredAt = isoTimestamp(options.occurredAt || new Date().toISOString(), "Outreach action time");
  return appendEvent(live, {
    eventId: `${prepared.outreachId}-ACTION-${live.checkOutreachEvents.length + 1}`,
    type: "CHECK_OUTREACH_ACTION_RECORDED",
    outreachId: prepared.outreachId,
    approvalId: approval.approvalId,
    recordId: approval.recordId,
    actionCode,
    actionLabel: action.label,
    actor,
    occurredAt,
    idempotencyKey,
    contactStatus: actionCode === "MARK_CONTACTED" ? "CONTACTED" : "READY_TO_CONTACT",
    contactReportedByActor: actionCode === "MARK_CONTACTED",
    messageSentByProofline: false,
    sessionLocal: true,
    messageDelivery: "USER_CONTROLLED",
    externalTransmissionPerformed: false,
    binding: false,
    fundsReserved: false,
    transferAuthorized: false
  });
}

export function recordCheckRecipientResponse(live, options = {}) {
  assertKnownKeys(options, RESPONSE_KEYS, "Check recipient-response options");
  const approval = genuineApproval(live, options.recordId);
  const prepared = requirePrepared(live, approval);
  const contacted = live.checkOutreachEvents.find((event) =>
    event?.type === "CHECK_OUTREACH_ACTION_RECORDED" &&
    event?.outreachId === prepared.outreachId &&
    event?.actionCode === "MARK_CONTACTED"
  );
  if (!contacted) {
    throw codedError("A recipient response cannot be recorded before contact is marked.", "CONTACT_REQUIRED");
  }
  const response = requiredText(options.response, "Recipient response", 30).toUpperCase();
  if (!CHECK_OUTREACH_RESPONSE_STATUSES.includes(response) || response === "AWAITING_RESPONSE") {
    throw codedError("Recipient response must be ACCEPTED or DECLINED.", "INVALID_RECIPIENT_RESPONSE");
  }
  const existing = live.checkOutreachEvents.find((event) =>
    event?.type === "CHECK_OUTREACH_RECIPIENT_RESPONSE_RECORDED" &&
    event?.outreachId === prepared.outreachId
  );
  if (existing) {
    if (existing.recipientResponse !== response) {
      throw codedError("A different recipient response is already recorded.", "RECIPIENT_RESPONSE_CONFLICT");
    }
    return existing;
  }
  const actor = namedActor(options.actor);
  const note = optionalText(options.note, "Recipient response note", 2_000);
  const occurredAt = isoTimestamp(options.occurredAt || new Date().toISOString(), "Recipient response time");
  return appendEvent(live, {
    eventId: `${prepared.outreachId}-RESPONSE`,
    type: "CHECK_OUTREACH_RECIPIENT_RESPONSE_RECORDED",
    outreachId: prepared.outreachId,
    approvalId: approval.approvalId,
    recordId: approval.recordId,
    recipientResponse: response,
    note,
    actor,
    occurredAt,
    sessionLocal: true,
    messageDelivery: "USER_CONTROLLED",
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    externalTransmissionPerformed: false
  });
}

/**
 * Projects state only after both the underlying approval and preparation event
 * pass their integrity checks. This intentionally throws rather than exposing
 * an outreach status for an unapproved Queue record.
 */
export function projectCheckOutreach(live, recordId) {
  const approval = genuineApproval(live, recordId);
  const prepared = requirePrepared(live, approval);
  const events = live.checkOutreachEvents.filter((event) => event?.outreachId === prepared.outreachId);
  const contacted = events.find((event) =>
    event.type === "CHECK_OUTREACH_ACTION_RECORDED" && event.actionCode === "MARK_CONTACTED"
  ) || null;
  const response = events.find((event) => event.type === "CHECK_OUTREACH_RECIPIENT_RESPONSE_RECORDED") || null;
  return immutableClone({
    outreachId: prepared.outreachId,
    approvalId: approval.approvalId,
    recordId: approval.recordId,
    assessmentId: approval.assessmentId,
    actor: prepared.actor,
    preparedAt: prepared.occurredAt,
    contactStatus: contacted ? "CONTACTED" : "READY_TO_CONTACT",
    recipientResponse: response?.recipientResponse || "AWAITING_RESPONSE",
    recipientResponseNote: response?.note || null,
    selectedContact: prepared.selectedContact,
    opportunitySnapshot: prepared.opportunitySnapshot,
    founderSnapshot: prepared.founderSnapshot,
    checkSnapshot: prepared.checkSnapshot,
    approvalMessage: prepared.approvalMessage,
    events,
    sessionLocal: true,
    messageDelivery: "USER_CONTROLLED",
    binding: false,
    fundsReserved: false,
    transferAuthorized: false,
    externalTransmissionPerformed: false
  });
}
