import {
  EMOVO_DEMO_TEMPLATE,
  createEmovoDemoAssessment as createEmovoDemoAssessmentV1
} from "./demo-data.mjs";

export { EMOVO_DEMO_TEMPLATE };

export const EMOVO_PUBLIC_PROFESSIONAL_CONTACTS = Object.freeze([
  Object.freeze({
    id: "CONTACT-EMOVO-BUSINESS-EMAIL",
    subjectType: "STARTUP",
    subjectName: "Emovo Care",
    channel: "BUSINESS_EMAIL",
    label: "Emovo Care · public business email",
    value: "hello@emovocare.com",
    sourceUrl: "https://www.emovocare.com/",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  }),
  Object.freeze({
    id: "CONTACT-EMOVO-BUSINESS-PHONE",
    subjectType: "STARTUP",
    subjectName: "Emovo Care",
    channel: "BUSINESS_PHONE",
    label: "Emovo Care · public business phone",
    value: "+41 21 588 18 75",
    sourceUrl: "https://www.emovocare.com/",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  }),
  Object.freeze({
    id: "CONTACT-EMOVO-CONTACT-PAGE",
    subjectType: "STARTUP",
    subjectName: "Emovo Care",
    channel: "CONTACT_PAGE",
    label: "Emovo Care · official contact page",
    value: "https://www.emovocare.com/contact-form",
    sourceUrl: "https://www.emovocare.com/contact-form",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  }),
  Object.freeze({
    id: "CONTACT-EMOVO-OFFICIAL-WEBSITE",
    subjectType: "STARTUP",
    subjectName: "Emovo Care",
    channel: "OFFICIAL_WEBSITE",
    label: "Emovo Care · official website",
    value: "https://www.emovocare.com/",
    sourceUrl: "https://www.emovocare.com/",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  }),
  Object.freeze({
    id: "CONTACT-EMOVO-LINKEDIN",
    subjectType: "STARTUP",
    subjectName: "Emovo Care",
    channel: "LINKEDIN",
    label: "Emovo Care · LinkedIn",
    value: "https://www.linkedin.com/company/emovocare",
    sourceUrl: "https://www.emovocare.com/about",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  }),
  Object.freeze({
    id: "CONTACT-EMOVO-LUCA-LINKEDIN",
    subjectType: "FOUNDER",
    subjectName: "Luca Randazzo",
    channel: "LINKEDIN",
    label: "Luca Randazzo · LinkedIn",
    value: "https://www.linkedin.com/in/lucarandazzo/",
    sourceUrl: "https://www.emovocare.com/about",
    verificationState: "REVIEWED_OFFICIAL_SOURCE",
    captureMethod: "CURATED_OFFICIAL_PUBLIC_SOURCE",
    publicProfessional: true
  })
]);

export function createEmovoDemoAssessment() {
  const assessment = createEmovoDemoAssessmentV1();
  const publicContacts = structuredClone(EMOVO_PUBLIC_PROFESSIONAL_CONTACTS);
  assessment.publicContacts = publicContacts;
  assessment.contactDiscovery = {
    version: "public-contacts-v1",
    status: "PUBLIC_PROFESSIONAL_CHANNELS_FOUND",
    contactCount: publicContacts.length,
    searchedExistingEvidenceOnly: true,
    additionalProviderCalls: 0,
    policy: {
      publicProfessionalChannelsOnly: true,
      inferredEmailsAllowed: false,
      searchSnippetContactValuesAllowed: false,
      loginGatedContentAccessed: false,
      personalOrHomeDataAllowed: false,
      humanVerificationRequiredBeforeOutreach: true
    },
    limitations: [
      "Contact details can change; open the cited official source before outreach.",
      "No contact channel is permission to send funds or bypass final diligence."
    ]
  };
  assessment.research.publicContacts = structuredClone(publicContacts);
  assessment.research.contactDiscovery = structuredClone(assessment.contactDiscovery);
  return assessment;
}
