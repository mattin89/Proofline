import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECK_OUTREACH_ACTIONS,
  CHECK_OUTREACH_CONTACT_STATUSES,
  CHECK_OUTREACH_RESPONSE_STATUSES,
  PUBLIC_PROFESSIONAL_CONTACT_CHANNELS,
  prepareCheckOutreach,
  projectCheckOutreach,
  recordCheckOutreachAction,
  recordCheckRecipientResponse
} from "../src/check-outreach-v1.mjs";
import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import {
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS,
  queueAssessment,
  recordNonBindingCheckApproval,
  setQueueNextAction
} from "../src/live-queue.mjs";

const ACKNOWLEDGEMENTS = NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((item) => item.code);

function approvedLive() {
  const assessment = createEmovoDemoAssessment();
  const live = {
    assessments: [assessment],
    queueEvents: [],
    selectedQueueId: null
  };
  queueAssessment(live, assessment.id, "2026-07-19T09:00:00.000Z");
  const recordId = `ASSESSMENT-${assessment.id}`;
  setQueueNextAction(
    live,
    recordId,
    "POLICY_SCREEN_ELIGIBLE",
    "Advance to policy screen.",
    "Mario",
    "2026-07-19T09:30:00.000Z"
  );
  const approval = recordNonBindingCheckApproval(live, {
    recordId,
    policy: DEFAULT_CHECK_POLICY,
    reviewer: "Mario",
    rationale: "The reviewed evidence clears all policy gates; remaining diligence is acknowledged.",
    acknowledgements: ACKNOWLEDGEMENTS,
    occurredAt: "2026-07-19T10:00:00.000Z"
  });
  return { live, assessment, recordId, approval };
}

function businessEmail() {
  return {
    id: "CONTACT-EMOVO-FOUNDERS-EMAIL",
    subjectType: "FOUNDER",
    subjectName: "Luca Randazzo",
    channel: "BUSINESS_EMAIL",
    label: "Public founder business email",
    value: "luca@example.org",
    sourceUrl: "https://www.emovocare.com/contact",
    verificationState: "SOURCE_MATCHED",
    captureMethod: "PUBLIC_WEB_RESEARCH",
    publicProfessional: true
  };
}

test("outreach creation and projection are both unavailable before a genuine check approval", () => {
  const assessment = createEmovoDemoAssessment();
  const live = {
    assessments: [assessment],
    queueEvents: [],
    checkOutreachEvents: [{
      type: "CHECK_OUTREACH_PREPARED",
      recordId: `ASSESSMENT-${assessment.id}`,
      contactStatus: "CONTACTED"
    }]
  };
  const options = {
    recordId: `ASSESSMENT-${assessment.id}`,
    actor: "Mario",
    occurredAt: "2026-07-19T10:05:00.000Z"
  };

  assert.throws(
    () => prepareCheckOutreach(live, options),
    (error) => error.code === "CHECK_APPROVAL_REQUIRED"
  );
  assert.throws(
    () => projectCheckOutreach(live, options.recordId),
    (error) => error.code === "CHECK_APPROVAL_REQUIRED"
  );
});

test("preparation generates one deterministic, editable approval notice from immutable approval snapshots", () => {
  const { live, assessment, recordId, approval } = approvedLive();
  const contact = businessEmail();
  const first = prepareCheckOutreach(live, {
    recordId,
    actor: "Mario",
    selectedContact: contact,
    occurredAt: "2026-07-19T10:05:00.000Z"
  });
  const duplicate = prepareCheckOutreach(live, {
    recordId,
    actor: "A different caller cannot rewrite the message",
    occurredAt: "2026-07-19T11:00:00.000Z"
  });

  assert.equal(first, duplicate);
  assert.equal(live.checkOutreachEvents.length, 1);
  assert.equal(first.contactStatus, "READY_TO_CONTACT");
  assert.equal(first.recipientResponse, "AWAITING_RESPONSE");
  assert.equal(first.actor, "Mario");
  assert.equal(first.selectedContact.value, "luca@example.org");
  assert.equal(first.opportunitySnapshot.companyName, "Emovo Care");
  assert.deepEqual(first.founderSnapshot.names, ["Luca Randazzo", "Iselin Frøybu"]);
  assert.equal(first.checkSnapshot.approvalId, approval.approvalId);
  assert.equal(first.checkSnapshot.amount, 100_000);
  assert.equal(first.checkSnapshot.currency, "USD");
  assert.deepEqual(first.checkSnapshot.scoreSnapshot, approval.scoreSnapshot);
  assert.deepEqual(first.checkSnapshot.researchSnapshot, approval.researchSnapshot);
  assert.equal(first.approvalMessage.templateId, "CHECK_APPROVAL_NOTICE_V1");
  assert.equal(first.approvalMessage.subject, "Proofline check approval — Emovo Care");
  assert.match(first.approvalMessage.body, /^Hello Luca Randazzo,/);
  assert.match(first.approvalMessage.body, /non-binding check of USD 100,000/);
  assert.match(first.approvalMessage.body, /does not reserve funds, authorize a transfer, or guarantee an investment/);
  assert.match(first.approvalMessage.body, /Best,\nMario$/);
  assert.equal(first.approvalMessage.editableBeforeUse, true);
  assert.equal(first.approvalMessage.externallySent, false);
  assert.equal(first.sessionLocal, true);
  assert.equal(first.messageDelivery, "USER_CONTROLLED");
  assert.equal(first.binding, false);
  assert.equal(first.fundsReserved, false);
  assert.equal(first.transferAuthorized, false);
  assert.equal(first.externalTransmissionPerformed, false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.selectedContact), true);
  assert.equal(Object.isFrozen(first.checkSnapshot.scoreSnapshot), true);

  contact.value = "mutated@example.org";
  assessment.companyName = "Mutated company";
  assessment.founderNames.push("Mutated founder");
  assert.equal(first.selectedContact.value, "luca@example.org");
  assert.equal(first.opportunitySnapshot.companyName, "Emovo Care");
  assert.deepEqual(first.founderSnapshot.names, ["Luca Randazzo", "Iselin Frøybu"]);
});

test("only the public-professional contact contract is accepted and caller overrides are rejected", () => {
  const { live, recordId } = approvedLive();
  assert.deepEqual(CHECK_OUTREACH_CONTACT_STATUSES, ["READY_TO_CONTACT", "CONTACTED"]);
  assert.deepEqual(CHECK_OUTREACH_RESPONSE_STATUSES, ["AWAITING_RESPONSE", "ACCEPTED", "DECLINED"]);
  assert.deepEqual(Object.keys(CHECK_OUTREACH_ACTIONS), ["COPY_MESSAGE", "OPEN_MAIL_CLIENT", "MARK_CONTACTED"]);
  assert.ok(PUBLIC_PROFESSIONAL_CONTACT_CHANNELS.includes("LINKEDIN"));

  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      amount: 5_000_000,
      message: "You are guaranteed an investment."
    }),
    (error) => error.code === "UNKNOWN_INPUT_FIELDS" && error.unknownFields.includes("amount")
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      selectedContact: { ...businessEmail(), publicProfessional: false }
    }),
    (error) => error.code === "INVALID_PUBLIC_CONTACT"
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      selectedContact: { ...businessEmail(), sourceUrl: "mailto:private@example.org" }
    }),
    (error) => error.code === "INVALID_PUBLIC_CONTACT"
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      selectedContact: { ...businessEmail(), sourceUrl: "http://127.0.0.1/private" }
    }),
    (error) => error.code === "INVALID_PUBLIC_CONTACT"
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      selectedContact: { ...businessEmail(), subjectName: "Unrelated Founder" }
    }),
    (error) => error.code === "CONTACT_SUBJECT_MISMATCH"
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "SYSTEM",
      selectedContact: businessEmail()
    }),
    (error) => error.code === "NAMED_HUMAN_ACTOR_REQUIRED"
  );
  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario\nInjected signature",
      selectedContact: businessEmail()
    }),
    (error) => error.code === "NAMED_HUMAN_ACTOR_REQUIRED"
  );
});

test("copy, mail-client, contact, and response events are append-only, idempotent, and never claim external sending", () => {
  const { live, recordId } = approvedLive();
  const prepared = prepareCheckOutreach(live, {
    recordId,
    actor: "Mario",
    selectedContact: businessEmail(),
    occurredAt: "2026-07-19T10:05:00.000Z"
  });
  const copied = recordCheckOutreachAction(live, {
    recordId,
    actionCode: "COPY_MESSAGE",
    actor: "Mario",
    idempotencyKey: "copy-click-1",
    occurredAt: "2026-07-19T10:06:00.000Z"
  });
  const duplicateCopy = recordCheckOutreachAction(live, {
    recordId,
    actionCode: "COPY_MESSAGE",
    actor: "Mario",
    idempotencyKey: "copy-click-1",
    occurredAt: "2026-07-19T10:07:00.000Z"
  });
  const mailClient = recordCheckOutreachAction(live, {
    recordId,
    actionCode: "OPEN_MAIL_CLIENT",
    actor: "Mario",
    occurredAt: "2026-07-19T10:08:00.000Z"
  });
  const contacted = recordCheckOutreachAction(live, {
    recordId,
    actionCode: "MARK_CONTACTED",
    actor: "Mario",
    occurredAt: "2026-07-19T10:09:00.000Z"
  });
  const duplicateContact = recordCheckOutreachAction(live, {
    recordId,
    actionCode: "MARK_CONTACTED",
    actor: "Another caller",
    idempotencyKey: "another-key",
    occurredAt: "2026-07-19T11:09:00.000Z"
  });
  const accepted = recordCheckRecipientResponse(live, {
    recordId,
    response: "ACCEPTED",
    actor: "Mario",
    note: "Founder asked to schedule the diligence call.",
    occurredAt: "2026-07-20T09:00:00.000Z"
  });
  const duplicateAccepted = recordCheckRecipientResponse(live, {
    recordId,
    response: "ACCEPTED",
    actor: "Different caller",
    occurredAt: "2026-07-20T10:00:00.000Z"
  });
  const projected = projectCheckOutreach(live, recordId);

  assert.equal(duplicateCopy, copied);
  assert.equal(duplicateContact, contacted);
  assert.equal(duplicateAccepted, accepted);
  assert.equal(live.checkOutreachEvents.length, 5);
  assert.deepEqual(live.checkOutreachEvents, [prepared, copied, mailClient, contacted, accepted]);
  assert.equal(projected.contactStatus, "CONTACTED");
  assert.equal(projected.recipientResponse, "ACCEPTED");
  assert.equal(projected.recipientResponseNote, "Founder asked to schedule the diligence call.");
  assert.equal(projected.events.length, 5);
  assert.equal(projected.externalTransmissionPerformed, false);
  assert.equal(projected.sessionLocal, true);
  assert.equal(projected.messageDelivery, "USER_CONTROLLED");
  for (const event of projected.events) {
    assert.equal(event.binding, false);
    assert.equal(event.fundsReserved, false);
    assert.equal(event.transferAuthorized, false);
    assert.equal(event.externalTransmissionPerformed, false);
    assert.equal(Object.isFrozen(event), true);
  }
  assert.equal(copied.contactReportedByActor, false);
  assert.equal(mailClient.contactReportedByActor, false);
  assert.equal(contacted.contactReportedByActor, true);
  assert.equal(contacted.messageSentByProofline, false);
  assert.throws(
    () => recordCheckOutreachAction(live, {
      recordId,
      actionCode: "COPY_MESSAGE",
      actor: "Mario",
      transferAuthorized: true
    }),
    (error) => error.code === "UNKNOWN_INPUT_FIELDS"
  );
  assert.throws(
    () => recordCheckRecipientResponse(live, {
      recordId,
      response: "ACCEPTED",
      actor: "Mario",
      fundsReserved: true
    }),
    (error) => error.code === "UNKNOWN_INPUT_FIELDS"
  );
  assert.throws(
    () => recordCheckRecipientResponse(live, {
      recordId,
      response: "DECLINED",
      actor: "Mario"
    }),
    (error) => error.code === "RECIPIENT_RESPONSE_CONFLICT"
  );
});

test("response requires prior contact, mail-client requires business email, and preparation supports no selected contact", () => {
  const { live, recordId } = approvedLive();
  const prepared = prepareCheckOutreach(live, {
    recordId,
    actor: "Mario",
    occurredAt: "2026-07-19T10:05:00.000Z"
  });
  assert.equal(prepared.selectedContact, null);
  assert.match(prepared.approvalMessage.body, /^Hello Emovo Care team,/);
  assert.throws(
    () => recordCheckRecipientResponse(live, {
      recordId,
      response: "ACCEPTED",
      actor: "Mario"
    }),
    (error) => error.code === "CONTACT_REQUIRED"
  );
  assert.throws(
    () => recordCheckOutreachAction(live, {
      recordId,
      actionCode: "OPEN_MAIL_CLIENT",
      actor: "Mario"
    }),
    (error) => error.code === "BUSINESS_EMAIL_CONTACT_REQUIRED"
  );
});

test("a mutable or detached approval clone cannot unlock outreach", () => {
  const { live, recordId, approval } = approvedLive();
  live.queueCheckApprovals = [structuredClone(approval)];

  assert.throws(
    () => prepareCheckOutreach(live, {
      recordId,
      actor: "Mario",
      occurredAt: "2026-07-19T10:05:00.000Z"
    }),
    (error) => error.code === "INVALID_CHECK_APPROVAL"
  );
});
