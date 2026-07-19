import {
  projectRecordedCheckActivity as projectRecordedCheckActivityV3,
  projectTeamActivity as projectTeamActivityV3
} from "./team-activity-v3.mjs";
import { projectCheckOutreach } from "./check-outreach-v1.mjs";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function statusFromProjection(outreach) {
  if (outreach.recipientResponse === "ACCEPTED") {
    return { code: "CHECK_ACCEPTED", label: "Check accepted", tone: "positive" };
  }
  if (outreach.recipientResponse === "DECLINED") {
    return { code: "CHECK_DECLINED", label: "Check declined", tone: "negative" };
  }
  if (outreach.contactStatus === "CONTACTED") {
    return { code: "CONTACTED_AWAITING_RESPONSE", label: "Contacted · awaiting response", tone: "warning" };
  }
  return { code: "READY_TO_CONTACT", label: "Ready to contact", tone: "positive" };
}

function outreachForApprovedRecord(live, recordId) {
  try {
    const outreach = projectCheckOutreach(live, recordId);
    return deepFreeze({
      ...outreach,
      status: statusFromProjection(outreach),
      approvedToSendMessage: true,
      checkStillNonBinding: true
    });
  } catch (error) {
    if (error?.code !== "CHECK_OUTREACH_NOT_PREPARED") throw error;
    return deepFreeze({
      outreachId: null,
      recordId,
      contactStatus: null,
      recipientResponse: null,
      selectedContact: null,
      approvalMessage: null,
      events: [],
      status: {
        code: "APPROVED_TO_CONTACT",
        label: "Approved to contact",
        tone: "positive"
      },
      approvedToSendMessage: true,
      checkStillNonBinding: true,
      binding: false,
      fundsReserved: false,
      transferAuthorized: false,
      externalTransmissionPerformed: false
    });
  }
}

export function projectRecordedCheckActivity(live) {
  return Object.freeze(projectRecordedCheckActivityV3(live).map((item) => deepFreeze({
    ...item,
    outreach: outreachForApprovedRecord(live, item.recordId)
  })));
}

export function projectTeamActivity(live) {
  const recorded = projectRecordedCheckActivity(live);
  const simulated = projectTeamActivityV3(live).filter((item) => item.simulation === true);
  return Object.freeze([...recorded, ...simulated]);
}
