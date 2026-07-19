import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createLiveWorkspaceState } from "../src/live-workspace.mjs";
import {
  EMOVO_PUBLIC_PROFESSIONAL_CONTACTS,
  createEmovoDemoAssessment
} from "../src/demo-data-v2.mjs";
import {
  NON_BINDING_CHECK_ACKNOWLEDGEMENTS,
  projectLiveQueue,
  queueAssessment,
  recordNonBindingCheckApproval,
  setQueueNextAction
} from "../src/live-queue.mjs";
import {
  prepareCheckOutreach,
  recordCheckOutreachAction,
  recordCheckRecipientResponse
} from "../src/check-outreach-v1.mjs";
import {
  projectRecordedCheckActivity,
  projectTeamActivity
} from "../src/team-activity-v4.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";

const RECORD_ID = "ASSESSMENT-DEMO-EMOVO-2026-07-19";

function approvedLive() {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  queueAssessment(live, assessment.id, "2026-07-19T10:00:00.000Z");
  setQueueNextAction(
    live,
    RECORD_ID,
    "POLICY_SCREEN_ELIGIBLE",
    "Reviewed pack is ready for the human policy screen.",
    "Mario",
    "2026-07-19T10:01:00.000Z"
  );
  const approval = recordNonBindingCheckApproval(live, {
    recordId: RECORD_ID,
    policy: DEFAULT_CHECK_POLICY,
    reviewer: "Mario",
    rationale: "The reviewed public evidence clears every configured fixed-check gate.",
    acknowledgements: NON_BINDING_CHECK_ACKNOWLEDGEMENTS.map((item) => item.code),
    occurredAt: "2026-07-19T10:02:00.000Z"
  });
  return { live, assessment, approval };
}

test("the versioned Emovo profile retains only sourced public professional startup and founder contacts", () => {
  const assessment = createEmovoDemoAssessment();
  assert.equal(assessment.publicContacts.length, 6);
  assert.deepEqual(assessment.publicContacts, structuredClone(EMOVO_PUBLIC_PROFESSIONAL_CONTACTS));
  assert.ok(assessment.publicContacts.some((item) => item.subjectType === "STARTUP" && item.channel === "BUSINESS_EMAIL" && item.value === "hello@emovocare.com"));
  assert.ok(assessment.publicContacts.some((item) => item.subjectType === "FOUNDER" && item.subjectName === "Luca Randazzo" && item.channel === "LINKEDIN"));
  for (const contact of assessment.publicContacts) {
    assert.equal(contact.publicProfessional, true);
    assert.match(contact.sourceUrl, /^https:\/\//);
    assert.ok(contact.verificationState);
    assert.ok(contact.captureMethod);
  }
  assert.equal(assessment.contactDiscovery.additionalProviderCalls, 0);
  assert.equal(assessment.contactDiscovery.policy.inferredEmailsAllowed, false);
  assert.equal(assessment.contactDiscovery.policy.personalOrHomeDataAllowed, false);
});

test("Queue and the immutable approval snapshot retain the searched startup and founder profiles", () => {
  const { live, assessment, approval } = approvedLive();
  const queued = projectLiveQueue(live).find((item) => item.assessmentId === assessment.id);
  assert.equal(queued.publicContacts.length, 6);
  assert.equal(approval.opportunitySnapshot.publicContacts.length, 6);
  assert.equal(Object.isFrozen(approval.opportunitySnapshot.publicContacts), true);
  assert.equal(Object.isFrozen(approval.opportunitySnapshot.publicContacts[0]), true);

  assessment.publicContacts[0].value = "changed@example.invalid";
  assert.equal(approval.opportunitySnapshot.publicContacts[0].value, "hello@emovocare.com");
});

test("outreach values exist only for recorded checks and progress through contact and recipient response", () => {
  const emptyLive = createLiveWorkspaceState();
  const demosOnly = projectTeamActivity(emptyLive);
  assert.equal(demosOnly.length, 5);
  assert.ok(demosOnly.every((item) => item.simulation === true && !("outreach" in item)));

  const { live, approval } = approvedLive();
  let activity = projectRecordedCheckActivity(live)[0];
  assert.equal(activity.outreach.status.code, "APPROVED_TO_CONTACT");
  assert.equal(activity.outreach.approvedToSendMessage, true);

  const email = approval.opportunitySnapshot.publicContacts.find((item) => item.channel === "BUSINESS_EMAIL");
  prepareCheckOutreach(live, {
    recordId: RECORD_ID,
    actor: "Mario",
    selectedContact: email,
    occurredAt: "2026-07-19T10:03:00.000Z"
  });
  activity = projectRecordedCheckActivity(live)[0];
  assert.equal(activity.outreach.status.code, "READY_TO_CONTACT");
  assert.match(activity.outreach.approvalMessage.body, /non-binding check of USD 100,000/);

  recordCheckOutreachAction(live, {
    recordId: RECORD_ID,
    actionCode: "MARK_CONTACTED",
    actor: "Mario",
    occurredAt: "2026-07-19T10:04:00.000Z"
  });
  activity = projectRecordedCheckActivity(live)[0];
  assert.equal(activity.outreach.status.code, "CONTACTED_AWAITING_RESPONSE");

  recordCheckRecipientResponse(live, {
    recordId: RECORD_ID,
    response: "ACCEPTED",
    actor: "Mario",
    note: "Confirmed by reply from the sourced business email.",
    occurredAt: "2026-07-19T10:05:00.000Z"
  });
  activity = projectRecordedCheckActivity(live)[0];
  assert.equal(activity.outreach.status.code, "CHECK_ACCEPTED");
  assert.equal(activity.outreach.binding, false);
  assert.equal(activity.outreach.fundsReserved, false);
  assert.equal(activity.outreach.transferAuthorized, false);
  assert.equal(activity.outreach.externalTransmissionPerformed, false);
});

test("a real recipient decline maps to Check declined without authorizing capital", () => {
  const { live, approval } = approvedLive();
  const contactPage = approval.opportunitySnapshot.publicContacts.find((item) => item.channel === "CONTACT_PAGE");
  prepareCheckOutreach(live, {
    recordId: RECORD_ID,
    actor: "Mario",
    selectedContact: contactPage,
    occurredAt: "2026-07-19T10:03:00.000Z"
  });
  recordCheckOutreachAction(live, {
    recordId: RECORD_ID,
    actionCode: "MARK_CONTACTED",
    actor: "Mario",
    occurredAt: "2026-07-19T10:04:00.000Z"
  });
  recordCheckRecipientResponse(live, {
    recordId: RECORD_ID,
    response: "DECLINED",
    actor: "Mario",
    occurredAt: "2026-07-19T10:05:00.000Z"
  });
  const activity = projectRecordedCheckActivity(live)[0];
  assert.equal(activity.outreach.status.code, "CHECK_DECLINED");
  assert.equal(activity.outreach.checkStillNonBinding, true);
});

test("the UI gates outreach behind approval and exposes user-controlled message actions", async () => {
  const appSource = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");
  const liveSource = await readFile(new URL("../src/live-workspace.mjs", import.meta.url), "utf8");
  assert.match(appSource, /function renderCheckOutreachPanel\(item, approval\) \{\s+if \(!approval\) return "";/);
  assert.match(appSource, /Generate approval message/);
  assert.match(appSource, /data-copy-outreach/);
  assert.match(appSource, /data-open-mail-outreach/);
  assert.match(appSource, /I sent it · mark contacted/);
  assert.match(appSource, /Accepted the check/);
  assert.match(appSource, /Declined the check/);
  assert.match(liveSource, /Public professional contacts/);
  assert.match(liveSource, /It never guesses email addresses/);
});
