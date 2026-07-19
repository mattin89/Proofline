import { createHash } from "node:crypto";

export const PUBLIC_CONTACTS_VERSION = "public-contacts-v1";

export const PUBLIC_CONTACT_LIMITS = Object.freeze({
  maxContacts: 12,
  maxContactsPerSubject: 6,
  maxSourceUrlLength: 2_048,
  maxValueLength: 320
});

const SOCIAL_HOSTS = Object.freeze({
  "linkedin.com": "LINKEDIN",
  "www.linkedin.com": "LINKEDIN",
  "x.com": "PUBLIC_SOCIAL_PROFILE",
  "www.x.com": "PUBLIC_SOCIAL_PROFILE",
  "twitter.com": "PUBLIC_SOCIAL_PROFILE",
  "www.twitter.com": "PUBLIC_SOCIAL_PROFILE",
  "instagram.com": "PUBLIC_SOCIAL_PROFILE",
  "www.instagram.com": "PUBLIC_SOCIAL_PROFILE",
  "facebook.com": "PUBLIC_SOCIAL_PROFILE",
  "www.facebook.com": "PUBLIC_SOCIAL_PROFILE",
  "youtube.com": "PUBLIC_SOCIAL_PROFILE",
  "www.youtube.com": "PUBLIC_SOCIAL_PROFILE",
  "github.com": "PUBLIC_SOCIAL_PROFILE",
  "www.github.com": "PUBLIC_SOCIAL_PROFILE"
});

const CONTACT_PATH = /(?:^|\/)(?:contact(?:-us)?|connect|reach-us|get-in-touch|talk-to-us)(?:\/|$)/i;
const ENTITY_QUERY_KINDS = new Set([
  "ENTITY_AND_TRACTION",
  "STARTUP_DISCOVERY",
  "FUNDING_AND_FOUNDER_CROSSCHECK",
  "DIRECT_LINK_EXTRACT"
]);
const ROLE_MAILBOX = /^(?:bizdev|business|careers?|contact|founders?|hello|info|invest(?:or|ors)?|media|office|partnerships?|press|sales|support|team)$/i;
const CONSUMER_EMAIL_HOST = /^(?:gmail|googlemail|hotmail|icloud|live|outlook|protonmail|proton|yahoo)\.[a-z.]+$/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,190}\.[A-Z]{2,24}\b/gi;
const PHONE_PATTERN = /(?:\btel:|\b(?:business|call|contact|investor relations|office|partnerships?|phone|press|sales|support|telephone)\s*(?:number)?\s*[:\-])\s*(\+?[\d][\d\s().-]{6,24}\d)/gi;

function clean(value, max = PUBLIC_CONTACT_LIMITS.maxValueLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeHost(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function hostIdentityText(hostname) {
  const labels = normalizeHost(hostname).split(".").filter(Boolean);
  if (labels.length <= 1) return labels.join(" ");
  const countrySecondLevel = labels.length >= 3 && /^(?:ac|co|com|edu|gov|net|org)$/.test(labels.at(-2)) && /^[a-z]{2}$/.test(labels.at(-1));
  return labels.slice(0, countrySecondLevel ? -2 : -1).join(" ");
}

function unsafeHost(hostname) {
  const host = normalizeHost(hostname).replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(?:0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  if (/^(?:::|::1|fc|fd|fe8|fe9|fea|feb)/i.test(host)) return true;
  return false;
}

function publicUrl(value) {
  if (typeof value !== "string" || value.length > PUBLIC_CONTACT_LIMITS.maxSourceUrlLength) return null;
  try {
    const parsed = new URL(value.trim());
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || unsafeHost(parsed.hostname)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function socialChannel(url) {
  try {
    const host = normalizeHost(new URL(url).hostname);
    for (const [socialHost, channel] of Object.entries(SOCIAL_HOSTS)) {
      const root = normalizeHost(socialHost);
      if (host === root || host.endsWith(`.${root}`)) return channel;
    }
    return null;
  } catch {
    return null;
  }
}

function nameTokens(value) {
  return clean(value, 160)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^(?:aerospace|biotech|care|climate|company|data|deeptech|energy|group|health|labs?|medical|mobility|neuro|pharma|quantum|robots?|robotics?|software|space|systems?|technologies|technology|therapeutics|ventures?)$/.test(token));
}

function matchesName(value, name) {
  const haystack = clean(value, 4_000).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tokens = nameTokens(name);
  if (!tokens.length) return false;
  return tokens.some((token) => haystack.includes(token));
}

function urlText(url) {
  try {
    const parsed = new URL(url);
    return `${normalizeHost(parsed.hostname)} ${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return "";
  }
}

function founderForUrl(url, founderNames) {
  const text = urlText(url);
  const matches = founderNames.filter((name) => matchesName(text, name));
  if (matches.length === 1) return matches[0];
  if (/\/in\//i.test(text) && founderNames.length === 1) return founderNames[0];
  return null;
}

function subjectForUrl(url, companyName, founderNames) {
  let parsed;
  try { parsed = new URL(url); }
  catch { return null; }
  const social = Boolean(socialChannel(url));
  const matchText = social ? urlText(url) : hostIdentityText(parsed.hostname);
  const founder = social
    ? founderForUrl(url, founderNames)
    : founderNames.find((name) => matchesName(matchText, name)) || null;
  if (founder) return { subjectType: "FOUNDER", subjectName: founder };
  if (companyName && matchesName(matchText, companyName)) return { subjectType: "STARTUP", subjectName: companyName };
  return null;
}

function isOfficialEntitySite(url, companyName, founderNames) {
  if (socialChannel(url)) return false;
  return Boolean(subjectForUrl(url, companyName, founderNames));
}

function contactId(contact) {
  return `CONTACT-${createHash("sha256")
    .update([contact.subjectType, contact.subjectName, contact.channel, contact.value, contact.sourceUrl].join("\n").toLowerCase())
    .digest("hex")
    .slice(0, 16)}`;
}

function immutableContact(contact) {
  const normalized = {
    id: contactId(contact),
    subjectType: contact.subjectType,
    subjectName: clean(contact.subjectName, 160),
    channel: contact.channel,
    label: clean(contact.label, 120),
    value: clean(contact.value),
    sourceUrl: contact.sourceUrl,
    verificationState: contact.verificationState,
    captureMethod: contact.captureMethod,
    publicProfessional: true
  };
  return Object.freeze(normalized);
}

function nameNear(text, index, founderNames) {
  const window = String(text || "").slice(Math.max(0, index - 180), index + 180);
  const matches = founderNames.filter((name) => matchesName(window, name));
  return matches.length === 1 ? matches[0] : null;
}

function emailHostMatchesOfficialSite(email, officialHosts) {
  const host = normalizeHost(String(email).split("@")[1]);
  if (!host || CONSUMER_EMAIL_HOST.test(host)) return false;
  return [...officialHosts].some((officialHost) => host === officialHost || officialHost.endsWith(`.${host}`) || host.endsWith(`.${officialHost}`));
}

function extractBusinessEmails({ evidence, companyName, founderNames, officialHosts }) {
  const text = String(evidence.excerpt || "");
  const contacts = [];
  EMAIL_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    const email = clean(match[0].replace(/[.,;:]+$/, ""), 254).toLowerCase();
    const [local] = email.split("@");
    if (!ROLE_MAILBOX.test(local) && !emailHostMatchesOfficialSite(email, officialHosts)) continue;
    const founder = nameNear(text, match.index ?? 0, founderNames);
    const subject = founder
      ? { subjectType: "FOUNDER", subjectName: founder }
      : { subjectType: "STARTUP", subjectName: companyName };
    if (!subject.subjectName) continue;
    contacts.push({
      ...subject,
      channel: "BUSINESS_EMAIL",
      label: founder ? `${founder} · public business email` : "Public business email",
      value: email,
      sourceUrl: evidence.url,
      verificationState: "UNREVIEWED_PUBLIC_SOURCE",
      captureMethod: evidence.captureMethod
    });
  }
  return contacts;
}

function extractBusinessPhones({ evidence, companyName, founderNames }) {
  const text = String(evidence.excerpt || "");
  const contacts = [];
  PHONE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const value = clean(match[1], 80).replace(/[.,;:]+$/, "");
    const digitCount = value.replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) continue;
    const founder = nameNear(text, match.index ?? 0, founderNames);
    const subject = founder
      ? { subjectType: "FOUNDER", subjectName: founder }
      : { subjectType: "STARTUP", subjectName: companyName };
    if (!subject.subjectName) continue;
    contacts.push({
      ...subject,
      channel: "BUSINESS_PHONE",
      label: founder ? `${founder} · public business phone` : "Public business phone",
      value,
      sourceUrl: evidence.url,
      verificationState: "UNREVIEWED_PUBLIC_SOURCE",
      captureMethod: evidence.captureMethod
    });
  }
  return contacts;
}

function routeContact({ url, subject, submitted, captureMethod }) {
  const channel = socialChannel(url) || (CONTACT_PATH.test(new URL(url).pathname) ? "CONTACT_PAGE" : "OFFICIAL_WEBSITE");
  const label = channel === "LINKEDIN"
    ? `${subject.subjectName} · LinkedIn`
    : channel === "PUBLIC_SOCIAL_PROFILE"
      ? `${subject.subjectName} · public profile`
      : channel === "CONTACT_PAGE"
        ? `${subject.subjectName} · contact page`
        : `${subject.subjectName} · official website`;
  return {
    ...subject,
    channel,
    label,
    value: url,
    sourceUrl: url,
    verificationState: submitted ? "SUBMITTED_PUBLIC_LINK" : "UNREVIEWED_PUBLIC_SOURCE",
    captureMethod
  };
}

function contactPriority(contact) {
  return ({ BUSINESS_EMAIL: 0, BUSINESS_PHONE: 1, CONTACT_PAGE: 2, LINKEDIN: 3, PUBLIC_SOCIAL_PROFILE: 4, OFFICIAL_WEBSITE: 5 })[contact.channel] ?? 9;
}

function deduplicateAndBound(contacts) {
  const seen = new Set();
  const perSubject = new Map();
  const result = [];
  for (const contact of contacts.sort((left, right) => contactPriority(left) - contactPriority(right))) {
    const key = [contact.subjectType, contact.subjectName, contact.channel, contact.value].join("|").toLowerCase();
    if (seen.has(key)) continue;
    const subjectKey = `${contact.subjectType}|${contact.subjectName}`.toLowerCase();
    const count = perSubject.get(subjectKey) || 0;
    if (count >= PUBLIC_CONTACT_LIMITS.maxContactsPerSubject) continue;
    seen.add(key);
    perSubject.set(subjectKey, count + 1);
    result.push(immutableContact(contact));
    if (result.length >= PUBLIC_CONTACT_LIMITS.maxContacts) break;
  }
  return Object.freeze(result);
}

/**
 * Projects public professional contact channels from evidence already captured by
 * Proofline. This function performs no network requests. Email and phone values
 * are accepted only from a direct first-party extract of an entity-matched,
 * user-submitted site; provider search snippets can never create those values.
 */
export function discoverPublicProfessionalContacts({
  companyName = null,
  founderNames = [],
  submittedLinks = [],
  evidence = []
} = {}) {
  const startup = clean(companyName, 160) || null;
  const founders = [...new Set((Array.isArray(founderNames) ? founderNames : []).map((name) => clean(name, 160)).filter(Boolean))].slice(0, 5);
  const links = [...new Set((Array.isArray(submittedLinks) ? submittedLinks : []).map(publicUrl).filter(Boolean))].slice(0, 5);
  const safeEvidence = (Array.isArray(evidence) ? evidence : []).map((item) => {
    const url = publicUrl(item?.url);
    return url ? { ...item, url } : null;
  }).filter(Boolean);
  const officialLinks = links.filter((url) => isOfficialEntitySite(url, startup, founders));
  const officialHosts = new Set(officialLinks.map((url) => normalizeHost(new URL(url).hostname)));
  const contacts = [];

  for (const url of links) {
    const subject = subjectForUrl(url, startup, founders);
    if (!subject) continue;
    if (!socialChannel(url) && !officialHosts.has(normalizeHost(new URL(url).hostname))) continue;
    contacts.push(routeContact({ url, subject, submitted: true, captureMethod: "USER_SUBMITTED_PUBLIC_LINK" }));
  }

  for (const item of safeEvidence) {
    if (!ENTITY_QUERY_KINDS.has(String(item.queryKind || ""))) continue;
    const subject = subjectForUrl(item.url, startup, founders);
    const sourceText = `${item.title || ""} ${item.excerpt || ""} ${urlText(item.url)}`;
    const entityTextMatch = Boolean(
      (startup && matchesName(sourceText, startup)) || founders.some((name) => matchesName(sourceText, name))
    );
    if (subject && entityTextMatch && (socialChannel(item.url) || CONTACT_PATH.test(new URL(item.url).pathname) || isOfficialEntitySite(item.url, startup, founders))) {
      contacts.push(routeContact({ url: item.url, subject, submitted: links.includes(item.url), captureMethod: clean(item.captureMethod, 80) || "PUBLIC_RESEARCH_RESULT" }));
    }

    const itemHost = normalizeHost(new URL(item.url).hostname);
    const textContactEligible =
      item.captureMethod === "TAVILY_EXTRACT" &&
      item.sourceType === "FIRST_PARTY" &&
      officialHosts.has(itemHost);
    if (!textContactEligible) continue;
    contacts.push(...extractBusinessEmails({ evidence: item, companyName: startup, founderNames: founders, officialHosts }));
    contacts.push(...extractBusinessPhones({ evidence: item, companyName: startup, founderNames: founders }));
  }

  const publicContacts = deduplicateAndBound(contacts);
  const contactDiscovery = Object.freeze({
    version: PUBLIC_CONTACTS_VERSION,
    status: publicContacts.length ? "PUBLIC_PROFESSIONAL_CHANNELS_FOUND" : "NO_PUBLIC_PROFESSIONAL_CHANNELS_FOUND",
    contactCount: publicContacts.length,
    searchedExistingEvidenceOnly: true,
    additionalProviderCalls: 0,
    policy: Object.freeze({
      publicProfessionalChannelsOnly: true,
      inferredEmailsAllowed: false,
      searchSnippetContactValuesAllowed: false,
      loginGatedContentAccessed: false,
      personalOrHomeDataAllowed: false,
      humanVerificationRequiredBeforeOutreach: true
    }),
    limitations: Object.freeze([
      "Public contact coverage is incomplete and can be stale or incorrectly matched.",
      "A discovered channel is unreviewed until a human opens the source and confirms the entity and contact details.",
      "No contact found means unknown coverage, not that the startup or founder is unreachable."
    ])
  });
  return Object.freeze({ publicContacts, contactDiscovery });
}
