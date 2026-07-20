import { createHash } from "node:crypto";
import { existsSync, readFileSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { basename, dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  TREND_COMPANY_DISCOVERY_BOUNDARIES,
  TREND_COMPANY_DISCOVERY_LIMITS,
  TREND_COMPANY_DISCOVERY_VERSION,
  TrendCompanyDiscoveryInputError,
  buildTrendCompanyDiscoveryPlan,
  githubCoverageFromSearchPayload,
  githubSignalsFromSearchPayload,
  mergeGithubSignals,
  validateTrendCompanyDiscoveryInput
} from "./src/trend-company-discovery-v1.mjs";
import { discoverPublicProfessionalContacts } from "./src/public-contacts-v1.mjs";
import {
  OPEN_DATA_DATASET_CATALOG,
  OPEN_DATA_PROVIDER_LIMITS,
  collectOfficialOpenData
} from "./src/open-data-providers-v1.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4173;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARACTERS = 120_000;
const MAX_LINKS = 5;
const MAX_SEARCH_QUERIES = 3;
const MAX_RESULTS_PER_QUERY = 5;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_UNITS = 12;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_PARSER_TIMEOUT_MS = 12_000;
const DEFAULT_PUBLIC_DEMO_MAX_RESEARCH_UNITS = 200;
const PACKAGED_DEMO_SHA256 = "02c244dbcc317f9f558623e072ec6debd8c54a377f0008171ea3f9e9869efec3";
const PACKAGED_DEMO_ID = "DEMO-EMOVO-2026-07-19";
const COMPARATOR_EXCLUDED_DOMAINS = Object.freeze([
  "linkedin.com",
  "crunchbase.com",
  "pitchbook.com",
  "dealroom.co",
  "wellfound.com",
  "medium.com",
  "substack.com"
]);
const ACADEMIC_SEARCH_DOMAINS = Object.freeze([
  "doi.org",
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "clinicaltrials.gov",
  "ieee.org",
  "dl.acm.org",
  "arxiv.org",
  "biorxiv.org",
  "medrxiv.org",
  "nature.com",
  "science.org",
  "springer.com",
  "sciencedirect.com"
]);
const TREND_SIGNAL_DOMAINS = Object.freeze([
  "iea.org",
  "ifr.org",
  "oecd.org",
  "weforum.org",
  "stanford.edu",
  "who.int",
  "esa.int"
]);
const TREND_CHALLENGE_DOMAINS = Object.freeze([
  "iea.org",
  "nist.gov",
  "gao.gov",
  "europa.eu",
  "oecd.org",
  "weforum.org",
  "cisa.gov"
]);
const TREND_ANCHOR_GROUPS = Object.freeze([
  Object.freeze({
    kind: "CURRENT_INTERNET_TRENDS",
    anchors: Object.freeze([
      Object.freeze({
        title: "Top 5 Global Robotics Trends 2026",
        url: "https://ifr.org/ifr-press-releases/news/top-5-global-robotics-trends-2026",
        publishedDate: "2026-01-08",
        sourceRole: "INDUSTRY_BODY"
      }),
      Object.freeze({
        title: "Data centre electricity use surged in 2025, even with tightening bottlenecks",
        url: "https://www.iea.org/news/data-centre-electricity-use-surged-in-2025-even-with-tightening-bottlenecks-driving-a-scramble-for-solutions",
        publishedDate: "2026-04-16",
        sourceRole: "INTERGOVERNMENTAL_AGENCY"
      })
    ])
  }),
  Object.freeze({
    kind: "COMPANY_OPERATING_CHALLENGES",
    anchors: Object.freeze([
      Object.freeze({
        title: "NIST SP 1800-41: Responding to and Recovering from a Cyber Attack",
        url: "https://www.nist.gov/news-events/news/2026/05/now-available-nist-sp-1800-41-responding-and-recovering-cyber-attack",
        publishedDate: null,
        sourceRole: "GOVERNMENT_TECHNICAL_GUIDANCE"
      }),
      Object.freeze({
        title: "Brain-Computer Interfaces: Applications, Challenges, and Policy Options",
        url: "https://www.gao.gov/products/gao-25-106952",
        publishedDate: null,
        sourceRole: "GOVERNMENT_ACCOUNTABILITY_REVIEW"
      }),
      Object.freeze({
        title: "Crossed Wires: Grid Capacity Could Block EU Energy Security",
        url: "https://managenergy.ec.europa.eu/publications/crossed-wires-grid-capacity-could-block-eu-energy-security_en",
        publishedDate: null,
        sourceRole: "EU_INSTITUTIONAL_ANALYSIS"
      })
    ])
  }),
  Object.freeze({
    kind: "RESEARCH_FRONTIERS",
    anchors: Object.freeze([
      Object.freeze({
        title: "Long-term independent use of an intracortical brain-computer interface for speech and cursor control",
        url: "https://www.nature.com/articles/s41591-026-04414-6",
        publishedDate: null,
        sourceRole: "PEER_REVIEWED_STUDY"
      }),
      Object.freeze({
        title: "Soft robotics for personalized and sustainable wearables",
        url: "https://www.nature.com/articles/s44222-025-00359-6",
        publishedDate: null,
        sourceRole: "PEER_REVIEWED_REVIEW"
      }),
      Object.freeze({
        title: "AI data centres as grid-interactive assets",
        url: "https://www.nature.com/articles/s41560-025-01927-1",
        publishedDate: null,
        sourceRole: "PEER_REVIEWED_STUDY"
      }),
      Object.freeze({
        title: "Long-duration electricity storage needs for coping with Dunkelflaute events in Europe",
        url: "https://www.nature.com/articles/s41467-026-72681-5",
        publishedDate: null,
        sourceRole: "PEER_REVIEWED_MODELING_STUDY"
      })
    ])
  })
]);

export const LIVE_RESEARCH_LIMITS = Object.freeze({
  maxDocumentBytes: MAX_DOCUMENT_BYTES,
  maxLinks: MAX_LINKS,
  maxSearchQueries: MAX_SEARCH_QUERIES,
  maxResultsPerQuery: MAX_RESULTS_PER_QUERY,
  rateWindowMs: DEFAULT_RATE_WINDOW_MS,
  rateUnits: DEFAULT_RATE_UNITS,
  maxConcurrent: DEFAULT_MAX_CONCURRENT,
  parserTimeoutMs: DEFAULT_PARSER_TIMEOUT_MS
});

const TEXT_TYPES = new Map([
  [".txt", ["text/plain"]],
  [".md", ["text/markdown", "text/plain", "text/x-markdown"]],
  [".html", ["text/html"]],
  [".htm", ["text/html"]],
  [".json", ["application/json", "text/json", "text/plain"]],
  [".csv", ["text/csv", "application/csv", "text/plain"]]
]);
const OPTIONAL_BINARY_TYPES = new Map([
  [".pdf", ["application/pdf"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};
const PUBLIC_STATIC_FILES = new Set([
  "index.html",
  "styles.css",
  "live-styles.css",
  "output/pdf/emovo-care-public-source-business-plan_v1.pdf"
]);
const PUBLIC_BROWSER_MODULE = /^src\/[a-z0-9-]+\.mjs$/;

const STOP_WORDS = new Set(
  "about after again against also among because before being between business could does doing during each from further have having into itself more most other over same should startup such than that their theirs them then there these they this those through under very what when where which while will with would your product company market solution founder founders customers customer revenue technology platform service services using used based need needs problem problems confidential private secret password credential credentials account accounts address addresses email emails phone phones banking bank iban swift customername".split(" ")
);

class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseEnvText(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadLocalEnvironment(root = ROOT) {
  const candidates = [
    join(root, "..", ".env"),
    join(root, "..", ".env.txt"),
    join(root, ".env"),
    join(root, ".env.txt")
  ];
  const loaded = {};
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    Object.assign(loaded, parseEnvText(readFileSync(candidate, "utf8")));
  }
  return loaded;
}

const localEnvironment = loadLocalEnvironment();
const defaultTavilyKey =
  process.env.TAVILY_API_KEY ||
  process.env.TAVILY_API ||
  localEnvironment.TAVILY_API_KEY ||
  localEnvironment.TAVILY_API ||
  "";
const defaultExaKey =
  process.env.EXA_API_KEY ||
  process.env.EXA_API ||
  localEnvironment.EXA_API_KEY ||
  localEnvironment.EXA_API ||
  "";
const defaultGithubToken =
  process.env.GITHUB_TOKEN ||
  localEnvironment.GITHUB_TOKEN ||
  "";

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extraHeaders
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const contentType = String(request.headers["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      reject(new HttpError(415, "Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE"));
      request.resume();
      return;
    }

    let received = 0;
    let oversized = false;
    const chunks = [];
    request.on("data", (chunk) => {
      received += chunk.length;
      if (received > MAX_JSON_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        return;
      }
      if (!oversized) chunks.push(chunk);
    });
    request.on("end", () => {
      if (oversized) {
        reject(new HttpError(413, "Request body is too large.", "BODY_TOO_LARGE"));
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, "Request body must be a JSON object.", "INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });
}

function assertKnownKeys(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object.`, "INVALID_SHAPE");
  }
  const unknown = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unknown) {
    throw new HttpError(400, `${label} contains unsupported field \"${unknown}\".`, "UNKNOWN_FIELD");
  }
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultilineText(value, maxLength = 2_000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .split("\n")
    .map((line) => cleanText(line, maxLength))
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);
}

function requireString(value, label, min, max) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} must be text.`, "INVALID_TEXT");
  }
  const cleaned = cleanText(value, max + 1);
  if (cleaned.length < min || cleaned.length > max) {
    throw new HttpError(400, `${label} must contain between ${min} and ${max} characters.`, "INVALID_TEXT_LENGTH");
  }
  return cleaned;
}

function optionalString(value, label, max) {
  if (value === undefined || value === null || value === "") return "";
  return requireString(value, label, 2, max);
}

function stringList(value, label, maxItems, maxLength) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(400, `${label} must be an array with at most ${maxItems} items.`, "INVALID_LIST");
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`, 2, maxLength));
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const value = ipv6ToBigInt(normalized);
  if (value == null) return true;

  // Only globally routable unicast literals are admissible. This deliberately
  // rejects mapped/compatible IPv4, multicast, NAT64, link/site-local, and
  // other special-purpose forms rather than trying to enumerate every alias.
  if (!ipv6InCidr(value, "2000::", 3)) return true;
  return [
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20]
  ].some(([network, prefix]) => ipv6InCidr(value, network, prefix));
}

function ipv6ToBigInt(address) {
  let normalized = String(address || "").toLowerCase();
  if (normalized.includes(".")) {
    const splitAt = normalized.lastIndexOf(":");
    const ipv4 = normalized.slice(splitAt + 1);
    if (isIP(ipv4) !== 4) return null;
    const octets = ipv4.split(".").map(Number);
    normalized = `${normalized.slice(0, splitAt)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n);
}

function ipv6InCidr(value, network, prefix) {
  const base = ipv6ToBigInt(network);
  if (base == null) return false;
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (base >> shift);
}

function normalizedLoopbackAuthority(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(`http://${value.trim()}`);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const loopbackIpv4 = isIP(hostname) === 4 && Number(hostname.split(".")[0]) === 127;
  if (hostname !== "localhost" && !loopbackIpv4 && hostname !== "::1") return null;
  return parsed.host.toLowerCase().replace(/\.$/, "");
}

function normalizedHostedOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }
  try {
    return new URL(normalizePublicUrl(parsed.origin, "public application origin")).origin;
  } catch {
    return null;
  }
}

function assertLocalRequestBoundary(request) {
  const authority = normalizedLoopbackAuthority(request.headers.host);
  if (!authority) {
    throw new HttpError(403, "Request host is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
  const origin = request.headers.origin;
  if (origin == null || origin === "") return;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(String(origin));
  } catch {
    throw new HttpError(403, "Request origin is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
  if (parsedOrigin.protocol !== "http:" || normalizedLoopbackAuthority(parsedOrigin.host) !== authority) {
    throw new HttpError(403, "Request origin is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
}

function assertHostedRequestBoundary(request, publicOrigin) {
  const expected = new URL(publicOrigin);
  const host = typeof request.headers.host === "string" ? request.headers.host.trim().toLowerCase() : "";
  if (!host || host !== expected.host.toLowerCase()) {
    throw new HttpError(403, "Request host is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
  const origin = request.headers.origin;
  if (origin == null || origin === "") return;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(String(origin));
  } catch {
    throw new HttpError(403, "Request origin is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
  if (
    parsedOrigin.origin !== expected.origin ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash ||
    parsedOrigin.username ||
    parsedOrigin.password
  ) {
    throw new HttpError(403, "Request origin is not allowed.", "FORBIDDEN_REQUEST_ORIGIN");
  }
}

function positiveInteger(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function deploymentSettings(options = {}) {
  const renderHosted = process.env.RENDER === "true";
  const publicDemo = options.publicDemo ?? (renderHosted || process.env.PROOFLINE_PUBLIC_DEMO === "true");
  const originCandidate =
    options.publicOrigin ??
    process.env.PROOFLINE_PUBLIC_ORIGIN ??
    process.env.RENDER_EXTERNAL_URL ??
    (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : "");
  const publicOrigin = publicDemo ? normalizedHostedOrigin(originCandidate) : null;
  if (publicDemo && !publicOrigin) {
    throw new Error("Hosted Proofline requires an exact HTTPS public origin via RENDER_EXTERNAL_URL or PROOFLINE_PUBLIC_ORIGIN.");
  }
  return {
    mode: publicDemo ? "HOSTED_PUBLIC_DEMO" : "LOCAL_ONLY",
    publicDemo,
    publicOrigin,
    bindHost: publicDemo ? "0.0.0.0" : "127.0.0.1",
    maxResearchUnits: publicDemo
      ? positiveInteger(
        options.publicDemoMaxResearchUnits ?? process.env.PROOFLINE_PUBLIC_DEMO_MAX_RESEARCH_UNITS,
        DEFAULT_PUBLIC_DEMO_MAX_RESEARCH_UNITS
      )
      : null
  };
}

function assertRequestBoundary(request, deployment) {
  if (deployment.publicDemo) assertHostedRequestBoundary(request, deployment.publicOrigin);
  else assertLocalRequestBoundary(request);
}

export function normalizePublicUrl(value, label = "link") {
  if (typeof value !== "string" || value.length > 2_048) {
    throw new HttpError(400, `${label} must be a valid public http(s) URL.`, "INVALID_URL");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, `${label} must be a valid public http(s) URL.`, "INVALID_URL");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(400, `${label} must use http(s) and cannot contain credentials.`, "INVALID_URL");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpError(400, `${label} must reference a public host.`, "PRIVATE_URL");
  }
  const ipVersion = isIP(host.replace(/^\[|\]$/g, ""));
  if ((ipVersion === 4 && isPrivateIpv4(host)) || (ipVersion === 6 && isPrivateIpv6(host))) {
    throw new HttpError(400, `${label} cannot reference a private or reserved IP address.`, "PRIVATE_URL");
  }
  url.hash = "";
  const retained = [...url.searchParams.entries()]
    .filter(([key]) => !/^(?:utm_.+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref|referrer|source|tracking)$/i.test(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    );
  url.search = "";
  for (const [key, entry] of retained) url.searchParams.append(key, entry);
  return url.toString();
}

function validatedLinks(value, label = "links") {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LINKS) {
    throw new HttpError(400, `${label} must contain at most ${MAX_LINKS} links.`, "INVALID_LINKS");
  }
  return [...new Set(value.map((link, index) => normalizePublicUrl(link, `${label}[${index}]`)))];
}

function compactQuery(parts) {
  // Tavily recommends keeping search queries below 400 characters.
  // Leave a small margin for every generated or ad-hoc request.
  return cleanText(parts.filter(Boolean).join(" "), 380);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function neutralComparisonFocus(text, excludedValues = []) {
  let value = String(text || "").replace(/https?:\/\/\S+/gi, " ");
  for (const excluded of excludedValues) {
    const phrase = cleanText(excluded || "", 180);
    if (phrase.length >= 3) value = value.replace(new RegExp(escapeRegExp(phrase), "gi"), " ");
  }
  const generic = new Set([
    ...STOP_WORDS,
    "venture",
    "ventures",
    "funding",
    "funded",
    "fundraise",
    "traction",
    "pilot",
    "pilots",
    "launch",
    "launched",
    "profile",
    "website"
  ]);
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !generic.has(token));
  return cleanText(tokens.join(" "), 240);
}

function sufficientComparisonFocus(value) {
  return new Set(String(value || "").split(/\s+/).filter(Boolean)).size >= 3;
}

const TECHNICAL_FOCUS_TERM = /(?:actuat|algorithm|assistive|biomaterial|clinical|device|diagnos|exoskeleton|exosuit|feasibility|finger|flexion|glove|hand|impairment|material|mechanism|motor|neuro|rehabilitation|robot|sensor|soft|stroke|therapy|trial|wearable)/i;
const BUYER_FOCUS_TERM = /(?:annual|budget|buyer|capacity|clinic|compliance|constraint|cost|demand|downtime|earnings|enterprise|hospital|incumbent|labor|operator|procurement|provider|reimbursement|risk|session|shortage|spending|staff|system|therapist|workforce)/i;

function targetedComparisonFocus(value, pattern, maxTokens = 18) {
  const tokens = String(value || "").split(/\s+/).filter(Boolean);
  const selected = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!pattern.test(token) || seen.has(token)) continue;
    selected.push(token);
    seen.add(token);
    if (selected.length >= maxTokens) break;
  }
  if (selected.length < 4) {
    for (const token of tokens) {
      if (seen.has(token)) continue;
      selected.push(token);
      seen.add(token);
      if (selected.length >= Math.min(maxTokens, 12)) break;
    }
  }
  return selected.join(" ");
}

function stableId(prefix, ...parts) {
  return `${prefix}-${createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16)}`;
}

function classifySource(url, submittedHosts = new Set()) {
  const host = new URL(url).hostname.toLowerCase();
  if (submittedHosts.has(host)) return "FIRST_PARTY";
  if (/(^|\.)(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com)$/.test(host)) return "SOCIAL_PROFILE";
  if (/(^|\.)(crunchbase\.com|pitchbook\.com|dealroom\.co|wellfound\.com)$/.test(host)) return "COMPANY_DATABASE";
  if (/\.edu$|\.ac\.[a-z]{2}$|(^|\.)(arxiv\.org|doi\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov|biorxiv\.org|medrxiv\.org|ieee\.org|acm\.org|nature\.com|science\.org|springer\.com|sciencedirect\.com)$/.test(host)) return "ACADEMIC_RESEARCH";
  return "PUBLIC_WEB";
}

function evidenceFromSearchResult(result, query, kind, submittedHosts) {
  let url;
  try {
    url = normalizePublicUrl(String(result?.url || ""), "upstream result URL");
  } catch {
    return null;
  }
  const title = cleanText(result?.title || "Untitled public source", 240);
  const excerpt = cleanText(result?.content || "", 1_600);
  if (!excerpt && !title) return null;
  return {
    id: stableId("WEB", url, excerpt),
    title,
    url,
    excerpt,
    relevance: Number.isFinite(result?.score) ? Math.max(0, Math.min(1, Number(result.score))) : null,
    publishedDate: cleanText(result?.published_date || "", 80) || null,
    query,
    queryKind: kind,
    sourceType: classifySource(url, submittedHosts),
    captureMethod: "TAVILY_SEARCH",
    provider: "Tavily",
    verificationStatus: "UNREVIEWED",
    assertionType: "THIRD_PARTY_OR_UNKNOWN",
    origin: "EXTERNAL_LIVE_RESEARCH",
    syntheticFixture: false
  };
}

function evidenceFromExtractResult(result, submittedHosts) {
  let url;
  try {
    url = normalizePublicUrl(String(result?.url || ""), "upstream extract URL");
  } catch {
    return null;
  }
  const excerpt = cleanText(result?.raw_content || "", 2_400);
  if (!excerpt) return null;
  return {
    id: stableId("EXT", url, excerpt),
    title: `Direct link inspection: ${new URL(url).hostname}`,
    url,
    excerpt,
    relevance: null,
    publishedDate: null,
    query: "Direct inspection of a user-submitted public link",
    queryKind: "DIRECT_LINK_EXTRACT",
    sourceType: classifySource(url, submittedHosts),
    captureMethod: "TAVILY_EXTRACT",
    provider: "Tavily",
    verificationStatus: "UNREVIEWED",
    assertionType: "FIRST_PARTY_OR_PROFILE_CONTENT",
    origin: "EXTERNAL_LIVE_RESEARCH",
    syntheticFixture: false
  };
}

function providerCredits(data) {
  const credits = Number(data?.usage?.credits);
  return Number.isFinite(credits) && credits >= 0 ? credits : null;
}

function providerCostDollars(data) {
  const total = Number(data?.costDollars?.total);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function evidenceFromExaResult(result, query, kind, submittedHosts) {
  let url;
  try {
    url = normalizePublicUrl(String(result?.url || ""), "Exa result URL");
  } catch {
    return null;
  }
  const title = cleanText(result?.title || "Untitled public source", 240);
  const highlights = Array.isArray(result?.highlights)
    ? result.highlights.map((item) => cleanText(item, 600)).filter(Boolean).join(" ")
    : "";
  const excerpt = cleanText(highlights || result?.text || result?.summary || "", 1_600);
  if (!excerpt && !title) return null;
  return {
    id: stableId("WEB", url, excerpt),
    title,
    url,
    excerpt,
    relevance: null,
    publishedDate: cleanText(result?.publishedDate || "", 80) || null,
    query,
    queryKind: kind,
    sourceType: classifySource(url, submittedHosts),
    captureMethod: "EXA_SEARCH",
    provider: "Exa",
    verificationStatus: "UNREVIEWED",
    assertionType: "THIRD_PARTY_OR_UNKNOWN",
    origin: "EXTERNAL_LIVE_RESEARCH",
    syntheticFixture: false
  };
}

async function postExa(body, runtime) {
  let response;
  try {
    response = await runtime.fetchImpl("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": runtime.exaKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18_000)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut ? "Exa cross-validation timed out." : "Exa cross-validation is unavailable.",
      timedOut ? "EXA_UPSTREAM_TIMEOUT" : "EXA_UPSTREAM_UNAVAILABLE"
    );
  }
  if (!response.ok) {
    if (response.status === 402) {
      throw new HttpError(402, "Exa account budget or prepaid credits are unavailable.", "EXA_UPSTREAM_BUDGET");
    }
    if (response.status === 429) {
      throw new HttpError(429, "Exa cross-validation rate limit reached.", "EXA_UPSTREAM_RATE_LIMIT");
    }
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, "Exa rejected the server credential.", "EXA_UPSTREAM_AUTH");
    }
    throw new HttpError(502, `Exa cross-validation failed with status ${response.status}.`, "EXA_UPSTREAM_FAILURE");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpError(502, "Exa returned an invalid response.", "EXA_UPSTREAM_INVALID_RESPONSE");
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.results)) {
    throw new HttpError(502, "Exa returned an invalid response.", "EXA_UPSTREAM_INVALID_RESPONSE");
  }
  return data;
}

async function searchExa(plan, runtime, submittedHosts) {
  const query = compactQuery([plan.query]);
  const includeDomains = [...new Set((plan.includeDomains || []).map((item) => String(item).toLowerCase()))];
  const excludeDomains = [...new Set([
    ...(plan.excludeSubmittedHosts ? submittedHosts : []),
    ...(plan.excludeDomains || []).map((item) => String(item).toLowerCase())
  ])].filter((item) => !includeDomains.includes(item));
  const requestBody = {
    query,
    type: "auto",
    numResults: MAX_RESULTS_PER_QUERY,
    contents: { highlights: true },
    moderation: true
  };
  if (includeDomains.length) requestBody.includeDomains = includeDomains;
  if (excludeDomains.length) requestBody.excludeDomains = excludeDomains;
  if (/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate || "")) {
    requestBody.startPublishedDate = `${plan.startDate}T00:00:00.000Z`;
  }
  const data = await postExa(requestBody, runtime);
  return {
    kind: plan.kind,
    query,
    requestId: cleanText(data?.requestId || "", 120) || null,
    reportedCostDollars: providerCostDollars(data),
    evidence: data.results
      .slice(0, MAX_RESULTS_PER_QUERY)
      .map((item) => evidenceFromExaResult(item, query, plan.kind, submittedHosts))
      .filter(Boolean)
  };
}

async function postTavily(path, body, runtime) {
  let response;
  try {
    response = await runtime.fetchImpl(`https://api.tavily.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        "Content-Type": "application/json",
        "X-Project-ID": "proofline-live-research"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18_000)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new HttpError(timedOut ? 504 : 502, timedOut ? "Live research provider timed out." : "Live research provider is unavailable.", timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE");
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new HttpError(429, "Live research provider rate limit reached. Try again later.", "UPSTREAM_RATE_LIMIT");
    }
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, "Live research provider rejected the server credential.", "UPSTREAM_AUTH");
    }
    throw new HttpError(502, `Live research provider failed with status ${response.status}.`, "UPSTREAM_FAILURE");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpError(502, "Live research provider returned an invalid response.", "UPSTREAM_INVALID_RESPONSE");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError(502, "Live research provider returned an invalid response.", "UPSTREAM_INVALID_RESPONSE");
  }
  return data;
}

async function searchTavily(plan, runtime, submittedHosts) {
  const query = compactQuery([plan.query]);
  const includeDomains = [...new Set((plan.includeDomains || []).map((item) => String(item).toLowerCase()))];
  const excludeDomains = [...new Set([
    ...(plan.excludeSubmittedHosts ? submittedHosts : []),
    ...(plan.excludeDomains || []).map((item) => String(item).toLowerCase())
  ])].filter((item) => !includeDomains.includes(item));
  const requestBody = {
    query,
    search_depth: "basic",
    topic: plan.topic === "news" ? "news" : "general",
    max_results: MAX_RESULTS_PER_QUERY,
    include_answer: plan.includeAnswer !== false,
    include_raw_content: false,
    include_images: false,
    include_usage: true
  };
  if (includeDomains.length) requestBody.include_domains = includeDomains;
  if (excludeDomains.length) requestBody.exclude_domains = excludeDomains;
  if (/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate || "")) requestBody.start_date = plan.startDate;
  const data = await postTavily("/search", requestBody, runtime);
  if (!Array.isArray(data.results)) {
    throw new HttpError(502, "Live research provider returned an invalid search response.", "UPSTREAM_INVALID_RESPONSE");
  }
  const providerQuery = typeof data.query === "string" ? cleanText(data.query, 500) : null;
  return {
    kind: plan.kind,
    query,
    includeDomains,
    excludeDomains,
    includeAnswer: requestBody.include_answer,
    topic: requestBody.topic,
    startDate: requestBody.start_date || null,
    providerQuery: providerQuery && providerQuery !== query ? providerQuery : null,
    answer: cleanMultilineText(data?.answer || "", 2_000),
    requestId: cleanText(data?.request_id || "", 120) || null,
    responseTime: data?.response_time != null && Number.isFinite(Number(data.response_time)) ? Number(data.response_time) : null,
    reportedCredits: providerCredits(data),
    evidence: Array.isArray(data?.results)
      ? data.results.slice(0, MAX_RESULTS_PER_QUERY).map((item) => evidenceFromSearchResult(item, query, plan.kind, submittedHosts)).filter(Boolean)
      : []
  };
}

async function extractTavily(
  links,
  runtime,
  submittedHosts,
  extractionQuery = "company founders product customers traction and independently checkable claims"
) {
  if (!links.length) return { evidence: [], failures: [], reportedCredits: null, requestId: null };
  const requested = new Set(links);
  const data = await postTavily("/extract", {
    urls: links,
    query: extractionQuery,
    chunks_per_source: 3,
    extract_depth: "basic",
    include_images: false,
    include_favicon: false,
    format: "markdown",
    timeout: 12,
    include_usage: true
  }, runtime);
  if (!Array.isArray(data.results) || (data.failed_results != null && !Array.isArray(data.failed_results))) {
    throw new HttpError(502, "Live research provider returned an invalid extraction response.", "UPSTREAM_INVALID_RESPONSE");
  }
  const evidence = [];
  for (const result of Array.isArray(data?.results) ? data.results.slice(0, MAX_LINKS) : []) {
    let normalized;
    try {
      normalized = normalizePublicUrl(String(result?.url || ""), "upstream extract URL");
    } catch {
      continue;
    }
    if (!requested.has(normalized)) continue;
    const item = evidenceFromExtractResult(result, submittedHosts);
    if (item) evidence.push(item);
  }
  const successUrls = new Set(evidence.map((item) => item.url));
  const providerFailures = new Map();
  for (const failure of Array.isArray(data?.failed_results) ? data.failed_results.slice(0, MAX_LINKS) : []) {
    try {
      const normalized = normalizePublicUrl(String(failure?.url || ""), "failed extract URL");
      if (requested.has(normalized)) providerFailures.set(normalized, cleanText(failure?.error || "Tavily could not extract this link.", 180));
    } catch {
      // Ignore malformed provider output.
    }
  }
  return {
    evidence,
    failures: links.filter((link) => !successUrls.has(link)).map((link) => ({
      url: link,
      status: "NOT_ACCESSED",
      reason: providerFailures.get(link) || "Tavily did not return extractable content; indexed-search fallback was used."
    })),
    reportedCredits: providerCredits(data),
    requestId: cleanText(data?.request_id || "", 120) || null
  };
}

function createResearchGuard(options) {
  const buckets = new Map();
  let active = 0;
  let totalUnits = 0;
  const rateUnits = options.rateUnits ?? DEFAULT_RATE_UNITS;
  const rateWindowMs = options.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS;
  const maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const maxTotalUnits = positiveInteger(options.maxTotalUnits, null);
  const now = options.now;
  return {
    async run(clientId, units, task) {
      const currentTime = now();
      let bucket = buckets.get(clientId);
      if (!bucket || currentTime - bucket.startedAt >= rateWindowMs) {
        bucket = { startedAt: currentTime, units: 0 };
        buckets.set(clientId, bucket);
      }
      if (bucket.units + units > rateUnits) {
        const retryAfter = Math.max(1, Math.ceil((rateWindowMs - (currentTime - bucket.startedAt)) / 1_000));
        const error = new HttpError(429, "Proofline live-research rate limit reached. Try again later.", "LOCAL_RATE_LIMIT");
        error.retryAfter = retryAfter;
        throw error;
      }
      if (active >= maxConcurrent) {
        const error = new HttpError(429, "Proofline is already running the maximum number of live-research jobs.", "LOCAL_CONCURRENCY_LIMIT");
        error.retryAfter = 2;
        throw error;
      }
      if (maxTotalUnits != null && totalUnits + units > maxTotalUnits) {
        throw new HttpError(
          429,
          "The public Proofline demo has reached its bounded research budget. The frozen evidence demo remains available.",
          "PUBLIC_DEMO_BUDGET_EXHAUSTED"
        );
      }
      bucket.units += units;
      totalUnits += units;
      active += 1;
      try {
        return await task();
      } finally {
        active -= 1;
      }
    },
    status() {
      return {
        maxTotalUnits,
        usedTotalUnits: totalUnits,
        remainingTotalUnits: maxTotalUnits == null ? null : Math.max(0, maxTotalUnits - totalUnits)
      };
    }
  };
}

function canonicalEvidenceKey(value) {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  if (url.hostname === "arxiv.org") {
    const match = url.pathname.match(/^\/(?:abs|pdf)\/([^/]+?)(?:\.pdf)?$/i);
    if (match) url.pathname = `/abs/${match[1]}`;
  }
  return url.toString();
}

function deduplicateEvidence(items) {
  const byUrl = new Map();
  for (const item of items) {
    const canonicalKey = canonicalEvidenceKey(item.url);
    const prior = byUrl.get(canonicalKey);
    if (!prior) {
      byUrl.set(canonicalKey, { ...item, observedBy: [item.provider || "Unknown"] });
      continue;
    }
    const providers = new Set([...(prior.observedBy || []), item.provider || "Unknown"]);
    const replace =
      (item.captureMethod === "TAVILY_EXTRACT" && prior.captureMethod !== "TAVILY_EXTRACT") ||
      (prior.captureMethod !== "TAVILY_EXTRACT" && item.excerpt.length > prior.excerpt.length);
    byUrl.set(canonicalKey, {
      ...(replace ? item : prior),
      observedBy: [...providers].sort(),
      crossProviderRetrievalMatch: providers.has("Tavily") && providers.has("Exa")
    });
  }
  return [...byUrl.values()];
}

function usageSummary(searches, extraction, estimatedUpperBound, exaSearches = [], exaRequested = false, exaAttempts = 0) {
  const reported = [...searches.map((item) => item.reportedCredits), extraction?.reportedCredits]
    .filter((item) => Number.isFinite(item));
  const exaCosts = exaSearches.map((item) => item.reportedCostDollars).filter((item) => Number.isFinite(item));
  return {
    reportedCredits: reported.length ? reported.reduce((sum, item) => sum + item, 0) : null,
    estimatedCreditsUpperBound: estimatedUpperBound,
    estimateBasis: "Basic Tavily Search is estimated at one credit per query; one batched basic Extract request is conservatively estimated at one credit. Provider-reported usage takes precedence.",
    exa: {
      requested: exaRequested,
      reportedCostDollars: exaCosts.length ? Math.round(exaCosts.reduce((sum, item) => sum + item, 0) * 1_000_000) / 1_000_000 : null,
      estimatedCostUpperBoundDollars: exaRequested ? Math.round(exaAttempts * 0.007 * 1_000_000) / 1_000_000 : 0,
      estimateBasis: "Pricing snapshot checked 2026-07-19: Exa auto search is $0.007 per request for up to ten results and highlights are bundled. Provider-reported cost is authoritative when returned."
    }
  };
}

async function conductResearch({ mode, queryPlan, links = [], runtime, clientId, crossValidateWithExa = false }) {
  const boundedQueries = queryPlan.slice(0, MAX_SEARCH_QUERIES);
  const exaWillRun = crossValidateWithExa && Boolean(runtime.exaKey);
  const costUnits = boundedQueries.length + (exaWillRun ? boundedQueries.length : 0) + (links.length ? 1 : 0);
  return runtime.guard.run(clientId, Math.max(1, costUnits), async () => {
    const submittedHosts = new Set(links.map((link) => new URL(link).hostname.toLowerCase()));
    const extraction = await extractTavily(
      links,
      runtime,
      submittedHosts,
      "company founders product customers traction independently checkable claims official contact page and explicitly public professional business contact channels"
    );
    const searches = [];
    for (const plan of boundedQueries) {
      searches.push(await searchTavily(plan, runtime, submittedHosts));
    }
    const exaSearches = [];
    const exaWarnings = [];
    if (exaWillRun) {
      for (const plan of boundedQueries) {
        try {
          exaSearches.push(await searchExa(plan, runtime, submittedHosts));
        } catch (error) {
          const code = error instanceof HttpError && String(error.code).startsWith("EXA_UPSTREAM_")
            ? error.code
            : "EXA_UPSTREAM_FAILURE";
          exaWarnings.push({
            queryKind: plan.kind,
            code,
            message: "Exa could not corroborate this query. Tavily evidence was preserved and no negative signal was recorded."
          });
        }
      }
    }
    const evidence = deduplicateEvidence([
      ...extraction.evidence,
      ...searches.flatMap((item) => item.evidence),
      ...exaSearches.flatMap((item) => item.evidence)
    ]);
    const retrievalOverlap = evidence.filter((item) => item.crossProviderRetrievalMatch).length;
    const uniqueExaSources = evidence.filter(
      (item) => item.observedBy?.includes("Exa") && !item.observedBy?.includes("Tavily")
    ).length;
    const answers = searches.map((item) => item.answer).filter(Boolean);
    return {
      researchId: stableId("RES", mode, String(runtime.now()), ...boundedQueries.map((item) => item.query)),
      mode,
      generatedAt: new Date(runtime.now()).toISOString(),
      provider: exaSearches.length ? "Tavily + Exa" : "Tavily",
      summary: answers.join(" ").slice(0, 3_000),
      queries: searches.map(({ kind, query, includeDomains, excludeDomains, includeAnswer, startDate, providerQuery, requestId, responseTime }) => ({
        kind,
        query,
        includeDomains,
        excludeDomains,
        includeAnswer,
        startDate,
        providerQuery,
        requestId,
        responseTime
      })),
      evidence,
      sourceCount: evidence.length,
      linkInspection: {
        requested: links.length,
        extracted: extraction.evidence.length,
        failures: extraction.failures,
        fallbackSearchUsed: extraction.failures.length > 0
      },
      usage: usageSummary(
        searches,
        extraction,
        boundedQueries.length + (links.length ? 1 : 0),
        exaSearches,
        crossValidateWithExa,
        exaWillRun ? boundedQueries.length : 0
      ),
      crossValidation: {
        requested: crossValidateWithExa,
        configured: Boolean(runtime.exaKey),
        provider: "Exa",
        status: !crossValidateWithExa
          ? "NOT_REQUESTED"
          : !runtime.exaKey
            ? "NOT_CONFIGURED"
            : exaWarnings.length === boundedQueries.length
              ? "FAILED_OPEN"
              : exaWarnings.length
                ? "PARTIAL"
                : "COMPLETED",
        queriesAttempted: exaWillRun ? boundedQueries.length : 0,
        queriesCompleted: exaSearches.length,
        retrievalOverlapUrls: retrievalOverlap,
        uniqueSourcesAdded: uniqueExaSources,
        warnings: exaWarnings,
        interpretation: "Provider overlap is a retrieval cross-check only. The same URL is counted once and does not become an independent source."
      },
      scoringPolicy: {
        canAffectScore: false,
        reason: "All live results are UNREVIEWED leads. Proofline must investigate entity match, independence, and claim support before scoring."
      },
      caveats: [
        "Search and extraction coverage is incomplete and can contain stale or incorrect claims.",
        "A failed link extraction means not accessed; it is not evidence that the page or claim does not exist.",
        ...(crossValidateWithExa && !runtime.exaKey ? ["Exa cross-validation was requested but is not configured."] : []),
        ...exaWarnings.map((item) => item.message)
      ],
      _providerAnswers: answers
    };
  });
}

function candidateEvidenceIds(companyName, website, evidence) {
  const name = cleanText(companyName, 120);
  const lowSpecificity = name.length <= 2 || /^(?:ai|tech|labs?|systems?|solutions?|company|startup|ventures?|group)$/i.test(name);
  const escapedPhrase = escapeRegExp(name).replace(/\s+/g, "\\s+");
  const entityPattern = escapedPhrase
    ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapedPhrase}(?=$|[^\\p{L}\\p{N}])`, "iu")
    : null;
  let websiteHost = "";
  try { websiteHost = website ? new URL(website).hostname.toLowerCase().replace(/^www\./, "") : ""; } catch { /* no host */ }
  return evidence
    .filter((item) => {
      let sourceHost = "";
      try { sourceHost = new URL(item.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* no host */ }
      const websiteMatch = Boolean(websiteHost && sourceHost === websiteHost);
      if (lowSpecificity) return websiteMatch;
      return websiteMatch || Boolean(entityPattern?.test(`${item.title} ${item.excerpt}`));
    })
    .map((item) => item.id)
    .slice(0, 5);
}

function parseDiscoveryCandidates(answers, evidence, limit) {
  const candidates = [];
  for (const answer of answers) {
    for (const rawLine of answer.split(/\r?\n/)) {
      const normalizedLine = rawLine
        .replace(/^\s*[-*\d.)]+\s*/, "")
        .trim()
        .replace(/^\|\s*/, "")
        .replace(/\s*\|$/, "");
      const parts = normalizedLine.split("|").map((item) => cleanText(item, 300));
      if (parts.length < 4) continue;
      if (parts.every((part) => /^:?-{3,}:?$/.test(part))) continue;
      const companyName = cleanText(parts[0], 120);
      if (
        companyName.length < 2 ||
        /company\s*name/i.test(companyName) ||
        /^(?:company|startup|startup name|organization|organisation|name)$/i.test(companyName)
      ) continue;
      const founderNames = /unknown|not found|n\/?a/i.test(parts[1])
        ? []
        : parts[1].split(/,|&|\band\b/i).map((item) => cleanText(item, 100)).filter((item) => item.length >= 2).slice(0, 5);
      let website = null;
      const websiteMatch = parts[2].match(/https?:\/\/[^\s)]+/i);
      if (websiteMatch) {
        try { website = normalizePublicUrl(websiteMatch[0], "candidate website"); } catch { website = null; }
      }
      const sourceEvidenceIds = candidateEvidenceIds(companyName, website, evidence);
      if (!sourceEvidenceIds.length) continue;
      candidates.push({
        id: stableId("CAND", companyName.toLowerCase(), website || ""),
        companyName,
        founderNames,
        website,
        reason: cleanText(parts.slice(3).join(" | "), 420) || "Candidate named in provider synthesis.",
        sourceEvidenceIds,
        discoveryMethod: "PROVIDER_ANSWER_PARSED",
        verificationStatus: "UNREVIEWED"
      });
    }
  }

  for (const item of evidence) {
    if (candidates.length >= limit) break;
    if (item.sourceType === "ACADEMIC_RESEARCH") continue;
    const title = cleanText(item.title, 180);
    if (/^(?:\d+|top\b|best\b)|\b(?:startups? to watch|startup list|venture capital|\bVCs?\b|investors?|ecosystem report)\b/i.test(title)) continue;
    const fundingMatch = title.match(/^(.{2,80}?)\s+(?:raises?|raised|secures?|secured|closes?|closed|lands?|launches?|unveils?|emerges?)\b/i);
    const startupMatch = title.match(/\b(?:startup|spin[- ]?out)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,3})\s+(?:raises?|secures?|launches?|unveils?|wins?|lands?)\b/);
    // A list/report title is not a company. Only infer a public-web company
    // from a title when the title itself contains a financing/launch pattern;
    // first-party pages may still identify their own entity conservatively.
    if (!fundingMatch && !startupMatch && item.sourceType !== "FIRST_PARTY") continue;
    const segment = title.split(/\s+[|—–]\s+|\s+-\s+/)[0];
    let companyName = cleanText(startupMatch?.[1] || fundingMatch?.[1] || segment, 120);
    const words = companyName.split(/\s+/).filter(Boolean);
    if (
      companyName.length < 2 ||
      companyName.length > 80 ||
      words.length > 6 ||
      /^(?:home|about|profile|startup|company|new startup|european startup|funding news)$/i.test(companyName)
    ) continue;
    candidates.push({
      id: stableId("CAND", companyName.toLowerCase(), item.url),
      companyName,
      founderNames: [],
      website: item.sourceType === "FIRST_PARTY" ? item.url : null,
      reason: `Conservative lead inferred from the indexed source \"${item.title}\"; founder identity and company status are not yet verified.`,
      sourceEvidenceIds: [item.id],
      discoveryMethod: "SOURCE_TITLE_INFERENCE",
      verificationStatus: "UNREVIEWED"
    });
  }
  const seen = new Set();
  return candidates.filter((item) => {
    const key = item.companyName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function discoveryInput(body) {
  assertKnownKeys(body, ["thesis", "sectors", "geographies", "stage", "limit", "crossValidateWithExa"], "discovery request");
  if (body.crossValidateWithExa !== undefined && typeof body.crossValidateWithExa !== "boolean") {
    throw new HttpError(400, "crossValidateWithExa must be true or false.", "INVALID_CROSS_VALIDATION_FLAG");
  }
  const thesis = requireString(body.thesis, "thesis", 20, 1_000);
  const sectors = stringList(body.sectors, "sectors", 6, 80);
  const geographies = stringList(body.geographies, "geographies", 6, 80);
  const stage = optionalString(body.stage, "stage", 60) || "pre-seed or seed";
  const limit = body.limit === undefined ? 8 : Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    throw new HttpError(400, "limit must be an integer from 1 to 12.", "INVALID_LIMIT");
  }
  const year = new Date().getUTCFullYear();
  const focus = [sectors.join(", "), geographies.join(", "), stage].filter(Boolean).join("; ");
  const thesisFocus = cleanText(thesis, 150);
  return {
    limit,
    crossValidateWithExa: body.crossValidateWithExa === true,
    queryPlan: [
      {
        kind: "STARTUP_DISCOVERY",
        query: compactQuery([
          `${year - 1}-${year} startup funding launch announcement at ${stage} stage with named founder and product.`,
          thesisFocus,
          focus,
          `Return up to ${limit} entries, one per line, exactly as: Company | Founder(s) | https://website-or-N/A | evidence-based fit reason. Do not invent missing facts.`
        ])
      },
      {
        kind: "FUNDING_AND_FOUNDER_CROSSCHECK",
        query: compactQuery([
          `European accelerator cohort, university spinout, or ${stage} funding announcement ${year - 1}-${year} with startup and founder names.`,
          thesisFocus,
          focus,
          "Prefer official startup pages, accelerator cohorts, university announcements, and reputable funding news."
        ])
      }
    ]
  };
}

function trendsInput(body, now = Date.now) {
  assertKnownKeys(body, ["focus"], "trends request");
  const focus = optionalString(body.focus, "focus", 300) || "AI, medical technology, robotics, advanced materials, climate technology, and space";
  return { focus, requestedAt: new Date(now()).toISOString() };
}

function openDataInput(body) {
  assertKnownKeys(body, ["companyName", "founderNames"], "open-data request");
  return {
    companyName: requireString(body.companyName, "companyName", 2, OPEN_DATA_PROVIDER_LIMITS.maxCompanyNameLength),
    founderNames: stringList(body.founderNames, "founderNames", OPEN_DATA_PROVIDER_LIMITS.maxFounderNames, 120)
  };
}

async function conductTrendRadar({ focus, runtime, clientId }) {
  return runtime.guard.run(clientId, TREND_ANCHOR_GROUPS.length, async () => {
    const batches = [];
    for (const group of TREND_ANCHOR_GROUPS) {
      const links = group.anchors.map((anchor) => anchor.url);
      const extraction = await extractTavily(links, runtime, new Set());
      const anchorsByUrl = new Map(group.anchors.map((anchor) => [canonicalEvidenceKey(anchor.url), anchor]));
      const evidence = extraction.evidence.map((item) => {
        const anchor = anchorsByUrl.get(canonicalEvidenceKey(item.url));
        return {
          ...item,
          id: stableId("WEB", group.kind, item.url, item.excerpt),
          title: anchor?.title || item.title,
          publishedDate: anchor?.publishedDate || null,
          query: "Curated current-radar anchor refreshed through Tavily Extract.",
          queryKind: group.kind,
          sourceRole: anchor?.sourceRole || "CURATED_PUBLIC_SOURCE",
          assertionType: "PRIMARY_DOCUMENT_OR_PUBLISHER_RECORD"
        };
      });
      batches.push({ group, extraction, evidence });
    }

    const evidence = deduplicateEvidence(batches.flatMap((batch) => batch.evidence));
    const reported = batches.map((batch) => batch.extraction.reportedCredits).filter(Number.isFinite);
    const failures = batches.flatMap((batch) => batch.extraction.failures.map((failure) => ({
      ...failure,
      queryKind: batch.group.kind
    })));
    return {
      researchId: stableId("RES", "TREND_RADAR", String(runtime.now()), focus),
      mode: "TREND_RADAR",
      generatedAt: new Date(runtime.now()).toISOString(),
      provider: "Tavily",
      summary: "",
      queries: batches.map((batch) => ({
        kind: batch.group.kind,
        method: "TAVILY_EXTRACT",
        anchorCount: batch.group.anchors.length,
        anchorUrls: batch.group.anchors.map((anchor) => anchor.url),
        includeAnswer: false,
        requestId: batch.extraction.requestId
      })),
      evidence,
      sourceCount: evidence.length,
      linkInspection: {
        requested: TREND_ANCHOR_GROUPS.reduce((sum, group) => sum + group.anchors.length, 0),
        extracted: evidence.length,
        failures,
        fallbackSearchUsed: false
      },
      usage: {
        reportedCredits: reported.length === TREND_ANCHOR_GROUPS.length
          ? reported.reduce((sum, value) => sum + value, 0)
          : null,
        estimatedCreditsUpperBound: TREND_ANCHOR_GROUPS.length,
        estimateBasis: "Three fixed server-side Tavily Extract batches, one for each dashboard pillar. Provider-reported usage takes precedence.",
        exa: {
          requested: false,
          reportedCostDollars: null,
          estimatedCostUpperBoundDollars: 0,
          estimateBasis: "Exa is not called by the trends radar."
        }
      },
      crossValidation: {
        requested: false,
        configured: Boolean(runtime.exaKey),
        provider: "Exa",
        status: "NOT_REQUESTED",
        queriesAttempted: 0,
        queriesCompleted: 0,
        retrievalOverlapUrls: 0,
        uniqueSourcesAdded: 0,
        warnings: [],
        interpretation: "The trends radar refreshes fixed authoritative anchors through Tavily; Exa is not used."
      },
      caveats: [
        "The radar is a curated cross-sector source set, not an exhaustive scan of the internet.",
        "Tavily extraction can fail or omit content; missing coverage is not evidence that a trend or challenge does not exist.",
        "Every retained excerpt remains UNREVIEWED until a human opens the source and checks its context."
      ],
      _providerAnswers: []
    };
  });
}

function trendSections(result) {
  const definitions = [
    ["INTERNET_TRENDS", "Current internet trends", "CURRENT_INTERNET_TRENDS", "Observed public signals about technology adoption, deployment, and investment attention."],
    ["COMPANY_CHALLENGES", "Company challenges", "COMPANY_OPERATING_CHALLENGES", "Named operating constraints and business challenges reported by companies or institutional surveys."],
    ["RESEARCH_FRONTIERS", "Research frontiers", "RESEARCH_FRONTIERS", "Current technical and academic directions; alignment does not establish product efficacy or commercial adoption."]
  ];
  return definitions.map(([id, title, queryKind, description]) => {
    const evidence = result.evidence.filter((item) => item.queryKind === queryKind);
    return {
      id,
      title,
      queryKind,
      description,
      evidenceIds: evidence.map((item) => item.id),
      sourceCount: evidence.length,
      hostCount: new Set(evidence.map((item) => new URL(item.url).hostname.toLowerCase().replace(/^www\./, ""))).size
    };
  });
}

function trendCompanyDiscoveryInput(body) {
  try {
    return validateTrendCompanyDiscoveryInput(body);
  } catch (error) {
    if (error instanceof TrendCompanyDiscoveryInputError) {
      throw new HttpError(400, error.message, error.code);
    }
    throw error;
  }
}

function githubRateLimitValue(headers, name) {
  const value = Number(headers?.get?.(name));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function githubRateLimitResetAt(seconds) {
  if (seconds === null) return null;
  const milliseconds = seconds * 1_000;
  if (!Number.isFinite(milliseconds)) return null;
  const timestamp = new Date(milliseconds);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
}

function githubSearchWarning(plan, code, message, details = {}) {
  return {
    trendId: plan.trendId,
    status: "UNAVAILABLE",
    code,
    message,
    signals: [],
    rateLimit: {
      remaining: details.remaining ?? null,
      limit: details.limit ?? null,
      resetAt: details.resetAt ?? null
    },
    responseReceived: details.responseReceived === true
  };
}

async function searchGithubRepositories(plan, runtime, capturedAt) {
  let target;
  try {
    target = new URL(plan.apiUrl);
  } catch {
    return githubSearchWarning(plan, "GITHUB_PLAN_REJECTED", "GitHub enrichment was not run because the fixed request plan was invalid.");
  }
  if (
    target.protocol !== "https:" ||
    target.hostname !== "api.github.com" ||
    target.pathname !== "/search/repositories"
  ) {
    return githubSearchWarning(plan, "GITHUB_PLAN_REJECTED", "GitHub enrichment was not run because the fixed request plan was invalid.");
  }
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "Proofline/3.0 trend-company-discovery"
  };
  if (runtime.githubToken) headers.Authorization = `Bearer ${runtime.githubToken}`;
  let response;
  try {
    response = await runtime.fetchImpl(target.toString(), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    return githubSearchWarning(
      plan,
      "GITHUB_UPSTREAM_UNAVAILABLE",
      "GitHub repository signals were unavailable. Tavily company evidence was preserved and no negative signal was recorded."
    );
  }
  const remaining = githubRateLimitValue(response.headers, "x-ratelimit-remaining");
  const limit = githubRateLimitValue(response.headers, "x-ratelimit-limit");
  const resetSeconds = githubRateLimitValue(response.headers, "x-ratelimit-reset");
  const resetAt = githubRateLimitResetAt(resetSeconds);
  const rateDetails = { remaining, limit, resetAt, responseReceived: true };
  if (!response.ok) {
    const rateLimited = response.status === 403 || response.status === 429;
    return githubSearchWarning(
      plan,
      rateLimited ? "GITHUB_UPSTREAM_RATE_LIMIT" : "GITHUB_UPSTREAM_FAILURE",
      rateLimited
        ? "GitHub repository-search rate limit was reached. Tavily company evidence was preserved and no negative signal was recorded."
        : "GitHub repository signals were unavailable. Tavily company evidence was preserved and no negative signal was recorded.",
      rateDetails
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return githubSearchWarning(
      plan,
      "GITHUB_UPSTREAM_INVALID_RESPONSE",
      "GitHub returned an invalid repository-search response. Tavily company evidence was preserved.",
      rateDetails
    );
  }
  let signals;
  let coverage;
  try {
    coverage = githubCoverageFromSearchPayload(payload);
    signals = githubSignalsFromSearchPayload(payload, plan, capturedAt);
  } catch {
    return githubSearchWarning(
      plan,
      "GITHUB_UPSTREAM_INVALID_RESPONSE",
      "GitHub returned an invalid repository-search response. Tavily company evidence was preserved.",
      rateDetails
    );
  }
  return {
    trendId: plan.trendId,
    status: "COMPLETED",
    code: null,
    message: null,
    signals,
    coverage,
    rateLimit: { remaining, limit, resetAt },
    responseReceived: true
  };
}

async function conductTrendCompanyDiscovery({ input, runtime, clientId }) {
  const plan = buildTrendCompanyDiscoveryPlan(input, runtime.now);
  const tavilyCostUpperBound = plan.providerCaps.tavilyCreditsUpperBound;
  const providerCallUnits = plan.providerCaps.tavilySearches + plan.providerCaps.githubApiRequests;
  return runtime.guard.run(clientId, providerCallUnits, async () => {
    const generatedAt = new Date(runtime.now()).toISOString();
    const [searches, githubSearches] = await Promise.all([
      Promise.all(plan.tavilyQueries.map(async (queryPlan) => {
        const search = await searchTavily(queryPlan, runtime, new Set());
        return {
          ...search,
          trendId: queryPlan.trendId,
          queryPurpose: queryPlan.queryPurpose,
          sourceAnchor: queryPlan.sourceAnchor,
          sourceContext: queryPlan.sourceContext,
          evidence: search.evidence.map((item) => ({
            ...item,
            selectedTrendIds: [queryPlan.trendId],
            trendSourceAnchor: queryPlan.sourceAnchor,
            trendSourceContext: queryPlan.sourceContext
          }))
        };
      })),
      Promise.all(plan.githubQueries.map((queryPlan) => searchGithubRepositories(queryPlan, runtime, generatedAt)))
    ]);

    const trendIdsByEvidenceUrl = new Map();
    for (const item of searches.flatMap((search) => search.evidence)) {
      const key = canonicalEvidenceKey(item.url);
      const ids = trendIdsByEvidenceUrl.get(key) || new Set();
      for (const trendId of item.selectedTrendIds) ids.add(trendId);
      trendIdsByEvidenceUrl.set(key, ids);
    }
    const evidence = deduplicateEvidence(searches.flatMap((search) => search.evidence)).map((item) => ({
      ...item,
      selectedTrendIds: [...(trendIdsByEvidenceUrl.get(canonicalEvidenceKey(item.url)) || [])]
    }));
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const candidates = parseDiscoveryCandidates(
      searches.map((search) => search.answer).filter(Boolean),
      evidence,
      12
    ).map((candidate) => ({
      ...candidate,
      selectedTrendIds: [...new Set(candidate.sourceEvidenceIds.flatMap((id) => evidenceById.get(id)?.selectedTrendIds || []))]
    }));
    const githubSignals = mergeGithubSignals(githubSearches.map((search) => search.signals));
    const githubWarnings = githubSearches.flatMap((search) => [
      ...(search.status !== "COMPLETED" ? [{ trendId: search.trendId, code: search.code, message: search.message }] : []),
      ...(search.coverage?.incompleteResults ? [{
        trendId: search.trendId,
        code: "GITHUB_INCOMPLETE_RESULTS",
        message: "GitHub marked this repository-search result set incomplete. Coverage is partial and no negative or comparative signal is inferred."
      }] : [])
    ]);
    const reportedCredits = searches.map((search) => search.reportedCredits).filter(Number.isFinite);
    const observedCreditTotal = reportedCredits.length
      ? reportedCredits.reduce((sum, value) => sum + value, 0)
      : null;
    const reportedCreditTotal = reportedCredits.length === searches.length ? observedCreditTotal : null;
    const githubResponses = githubSearches.filter((search) => search.responseReceived).length;
    const githubCompleted = githubSearches.filter((search) => search.status === "COMPLETED").length;
    const remainingValues = githubSearches.map((search) => search.rateLimit.remaining).filter(Number.isFinite);

    return {
      schemaVersion: TREND_COMPANY_DISCOVERY_VERSION,
      discoveryId: stableId("DISC", "SELECTED_TRENDS", String(runtime.now()), ...input.selectedTrendIds),
      mode: "SELECTED_TREND_COMPANY_DISCOVERY",
      generatedAt,
      selectedTrends: plan.selectedTrends,
      filters: plan.filters,
      queries: [
        ...searches.map((search) => ({
          trendId: search.trendId,
          method: "TAVILY_SEARCH",
          query: search.query,
          queryPurpose: search.queryPurpose,
          sourceAnchor: search.sourceAnchor,
          sourceContext: search.sourceContext,
          excludeDomains: search.excludeDomains,
          startDate: search.startDate,
          topic: search.topic,
          requestId: search.requestId,
          responseTime: search.responseTime,
          providerQuery: search.providerQuery,
          includeAnswer: search.includeAnswer
        })),
        ...plan.githubQueries.map((query) => {
          const outcome = githubSearches.find((search) => search.trendId === query.trendId);
          return {
            trendId: query.trendId,
            method: query.method,
            query: query.query,
            requiredRelevanceTerms: query.requiredRelevanceTerms,
            endpoint: "https://api.github.com/search/repositories",
            sourceAnchor: query.sourceAnchor,
            status: outcome?.status || "UNAVAILABLE",
            code: outcome?.code || null,
            totalCount: outcome?.coverage?.totalCount ?? null,
            incompleteResults: outcome?.coverage?.incompleteResults ?? null
          };
        })
      ],
      candidates,
      githubSignals,
      evidence,
      sourceCount: evidence.length + githubSignals.length,
      tavilySourceCount: evidence.length,
      githubRepositoryCount: githubSignals.length,
      usage: {
        reportedCredits: reportedCreditTotal,
        reportedCreditsObserved: observedCreditTotal,
        reportedCreditCoverage: `${reportedCredits.length}/${searches.length} Tavily searches`,
        estimatedCreditsUpperBound: tavilyCostUpperBound,
        estimateBasis: "Each selected trend triggers exactly one Tavily Basic Search, conservatively estimated at one credit. Provider-reported usage takes precedence.",
        tavilySearchesAttempted: searches.length,
        tavilySearchesCompleted: searches.length,
        githubApiRequests: plan.githubQueries.length,
        githubApiResponses: githubResponses,
        githubApiRequestsCompleted: githubCompleted,
        githubApiRequestsUpperBound: plan.providerCaps.githubApiRequests,
        totalProviderCallsUpperBound: providerCallUnits,
        localRateUnitsCharged: providerCallUnits
      },
      providers: {
        tavily: {
          method: "Basic Search",
          requestIds: searches.map((search) => search.requestId).filter(Boolean),
          maxResultsPerTrend: TREND_COMPANY_DISCOVERY_LIMITS.maxTavilyResultsPerTrend
        },
        github: {
          method: "Public Repository Search API",
          endpoint: "https://api.github.com/search/repositories",
          authenticationMode: runtime.githubToken ? "SERVER_TOKEN" : "PUBLIC_UNAUTHENTICATED",
          minRateLimitRemainingObserved: remainingValues.length ? Math.min(...remainingValues) : null,
          resultCoverage: githubSearches
            .filter((search) => search.coverage)
            .map((search) => ({
              trendId: search.trendId,
              totalCount: search.coverage.totalCount,
              incompleteResults: search.coverage.incompleteResults
            })),
          maxResultsPerTrend: TREND_COMPANY_DISCOVERY_LIMITS.maxGithubResultsPerTrend,
          warnings: githubWarnings
        }
      },
      boundaries: TREND_COMPANY_DISCOVERY_BOUNDARIES,
      nextRequiredAction: "INVESTIGATE_ENTITY_AND_EVIDENCE_BEFORE_SCORING",
      caveats: [
        "All company, founder, and repository results are unreviewed leads and can be stale, incomplete, or incorrectly matched.",
        "The region filter shapes Tavily company discovery only; GitHub Repository Search has no reliable repository-owner geography qualifier.",
        "Sector and stored trend-topic terms shape GitHub search, but repository alignment does not establish a startup, founder, company, traction, or investability.",
        "Repository stars, forks, subscribers, and activity timestamps are public project indicators only and cannot affect a Proofline investment score.",
        "A recently created repository describes project recency. Proofline never infers or uses a builder's biological age."
      ],
      interpretation: "Selected trend anchors produced bounded company leads and public repository signals for human investigation, not a score, forecast, or investment decision."
    };
  });
}

function investigationInput(body, now = Date.now) {
  assertKnownKeys(body, ["companyName", "founderNames", "links", "context", "crossValidateWithExa"], "investigation request");
  if (body.crossValidateWithExa !== undefined && typeof body.crossValidateWithExa !== "boolean") {
    throw new HttpError(400, "crossValidateWithExa must be true or false.", "INVALID_CROSS_VALIDATION_FLAG");
  }
  const companyName = optionalString(body.companyName, "companyName", 160);
  const founderNames = stringList(body.founderNames, "founderNames", 5, 120);
  const links = validatedLinks(body.links);
  const context = optionalString(body.context, "context", 600);
  if (!companyName && !founderNames.length && !links.length && !context) {
    throw new HttpError(400, "Provide a company name, founder name, public link, or investigation context.", "MISSING_SUBJECT");
  }
  const linkTerms = links.map((link) => `${new URL(link).hostname}${new URL(link).pathname}`).join(" ");
  const subject = [companyName, founderNames.join(", "), linkTerms].filter(Boolean).join("; ");
  const comparisonFocus = neutralComparisonFocus(context, [companyName, ...founderNames, ...links]);
  const incumbentFocus = targetedComparisonFocus(comparisonFocus, BUYER_FOCUS_TERM);
  const academicFocus = targetedComparisonFocus(comparisonFocus, TECHNICAL_FOCUS_TERM);
  const currentYear = new Date(now()).getUTCFullYear();
  const queryPlan = [{
    kind: "ENTITY_AND_TRACTION",
    query: compactQuery([
      "Identify this startup; check founders, product, customers, pilots, funding, revenue, and traction. Find its official website/contact page and explicitly public professional business or founder profiles. Never infer contact details.",
      subject || comparisonFocus,
      cleanText(context, 180)
    ]),
    includeAnswer: false
  }];
  if (sufficientComparisonFocus(comparisonFocus)) {
    queryPlan.push(
      {
        kind: "INCUMBENT_PROBLEM_AND_REVENUE",
        query: compactQuery([
          "established operator buyer annual report filing earnings operational constraint",
          incumbentFocus
        ]),
        includeAnswer: false,
        excludeSubmittedHosts: true,
        excludeDomains: COMPARATOR_EXCLUDED_DOMAINS,
        startDate: `${currentYear - 3}-01-01`
      },
      {
        kind: "ACADEMIC_VALIDATION",
        query: compactQuery([
          "systematic review clinical trial experimental study technical paper DOI",
          academicFocus
        ]),
        includeAnswer: false,
        excludeSubmittedHosts: true,
        includeDomains: ACADEMIC_SEARCH_DOMAINS
      }
    );
  }
  return {
    companyName,
    founderNames,
    links,
    context,
    crossValidateWithExa: body.crossValidateWithExa === true,
    queryPlan
  };
}

function decodeFileContent(file, extension) {
  const encoding = file.encoding || "utf8";
  if (!['utf8', 'base64'].includes(encoding)) {
    throw new HttpError(400, "file.encoding must be utf8 or base64.", "INVALID_ENCODING");
  }
  if (typeof file.content !== "string") {
    throw new HttpError(400, "file.content must be a string.", "INVALID_FILE_CONTENT");
  }
  let buffer;
  if (encoding === "base64") {
    const compact = file.content.replace(/\s/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
      throw new HttpError(400, "file.content is not valid base64.", "INVALID_BASE64");
    }
    buffer = Buffer.from(compact, "base64");
  } else {
    if (OPTIONAL_BINARY_TYPES.has(extension)) {
      throw new HttpError(400, `${extension} uploads must use base64 encoding.`, "BINARY_REQUIRES_BASE64");
    }
    buffer = Buffer.from(file.content, "utf8");
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(413, `Document exceeds the ${MAX_DOCUMENT_BYTES}-byte limit.`, "DOCUMENT_TOO_LARGE");
  }
  if (buffer.length < 1) throw new HttpError(400, "Document is empty.", "EMPTY_DOCUMENT");
  return buffer;
}

function normalizeDocumentText(text, extension) {
  let value = String(text || "");
  if (extension === ".html" || extension === ".htm") {
    value = value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }
  if (extension === ".json") {
    try { value = JSON.stringify(JSON.parse(value), null, 2); }
    catch { throw new HttpError(400, "Uploaded JSON is invalid.", "INVALID_DOCUMENT_JSON"); }
  }
  value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length < 10) throw new HttpError(422, "Document does not contain enough readable text.", "NO_READABLE_TEXT");
  return value.slice(0, MAX_EXTRACTED_TEXT_CHARACTERS);
}

async function defaultPdfParser(buffer) {
  let module;
  try { module = await import("pdf-parse"); }
  catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") throw new HttpError(415, "PDF upload support is unavailable on this server. Install the pinned pdf-parse adapter.", "PARSER_UNAVAILABLE");
    throw error;
  }
  if (typeof module.PDFParse !== "function") {
    throw new HttpError(415, "The installed PDF parser is incompatible with this server.", "PARSER_UNAVAILABLE");
  }
  let parser;
  try {
    parser = new module.PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result?.text || "";
  } finally {
    await parser?.destroy?.();
  }
}

async function defaultDocxParser(buffer) {
  let module;
  try { module = await import("mammoth"); }
  catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") throw new HttpError(415, "DOCX upload support is unavailable on this server. Install the pinned mammoth adapter.", "PARSER_UNAVAILABLE");
    throw error;
  }
  const mammoth = module.default || module;
  const result = await mammoth.extractRawText({ buffer });
  return result?.value || "";
}

async function runDocumentParser(parser, buffer, extension, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(504, `${extension.toUpperCase()} parsing timed out.`, "DOCUMENT_PARSE_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => parser(buffer)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function parseUploadedDocument(file, runtime) {
  assertKnownKeys(file, ["name", "type", "encoding", "content"], "file");
  const name = requireString(file.name, "file.name", 1, 180);
  if (name !== basename(name) || /[\\/]/.test(name)) {
    throw new HttpError(400, "file.name cannot contain a path.", "INVALID_FILENAME");
  }
  const extension = extname(name).toLowerCase();
  const allowedTypes = TEXT_TYPES.get(extension) || OPTIONAL_BINARY_TYPES.get(extension);
  if (!allowedTypes) {
    throw new HttpError(415, "Supported files are .txt, .md, .html, .json, .csv, .pdf, and .docx.", "UNSUPPORTED_DOCUMENT_TYPE");
  }
  const declaredType = cleanText(file.type || "", 120).toLowerCase().split(";")[0];
  if (declaredType && !allowedTypes.includes(declaredType)) {
    throw new HttpError(415, `Declared media type does not match ${extension}.`, "MEDIA_TYPE_MISMATCH");
  }
  const buffer = decodeFileContent(file, extension);
  let rawText;
  try {
    if (extension === ".pdf") {
      if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new HttpError(400, "PDF signature is invalid.", "INVALID_FILE_SIGNATURE");
      rawText = await runDocumentParser(runtime.parsePdf, buffer, extension, runtime.parserTimeoutMs);
    } else if (extension === ".docx") {
      if (!buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new HttpError(400, "DOCX signature is invalid.", "INVALID_FILE_SIGNATURE");
      rawText = await runDocumentParser(runtime.parseDocx, buffer, extension, runtime.parserTimeoutMs);
    } else {
      rawText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (/password|encrypted|encryption/i.test(String(error?.message || error))) {
      throw new HttpError(422, `${extension.toUpperCase()} is encrypted or password-protected and cannot be inspected.`, "ENCRYPTED_DOCUMENT");
    }
    if (error instanceof TypeError && !OPTIONAL_BINARY_TYPES.has(extension)) throw new HttpError(400, "Text document is not valid UTF-8.", "INVALID_UTF8");
    throw new HttpError(422, `Could not extract readable text from ${extension}.`, "DOCUMENT_PARSE_FAILED");
  }
  const text = normalizeDocumentText(rawText, extension);
  return {
    name,
    extension,
    declaredType: declaredType || null,
    bytes: buffer.length,
    text,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

function sanitizedKeywords(text) {
  const counts = new Map();
  const tokens = text.toLowerCase().match(/[a-z][a-z]{4,23}/g) || [];
  for (const token of tokens.slice(0, 20_000)) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([token]) => token);
}

function documentInput(body) {
  assertKnownKeys(body, ["file", "companyName", "founderNames", "links", "context", "allowPlanKeywordsForWebResearch", "crossValidateWithExa"], "document request");
  if (body.allowPlanKeywordsForWebResearch !== undefined && typeof body.allowPlanKeywordsForWebResearch !== "boolean") {
    throw new HttpError(400, "allowPlanKeywordsForWebResearch must be true or false.", "INVALID_PRIVACY_CONSENT");
  }
  if (body.crossValidateWithExa !== undefined && typeof body.crossValidateWithExa !== "boolean") {
    throw new HttpError(400, "crossValidateWithExa must be true or false.", "INVALID_CROSS_VALIDATION_FLAG");
  }
  return {
    companyName: optionalString(body.companyName, "companyName", 160),
    founderNames: stringList(body.founderNames, "founderNames", 5, 120),
    links: validatedLinks(body.links),
    context: optionalString(body.context, "context", 600),
    allowPlanKeywordsForWebResearch: body.allowPlanKeywordsForWebResearch === true,
    crossValidateWithExa: body.crossValidateWithExa === true
  };
}

function founderDocumentEvidence(document, runtime) {
  const excerpt = cleanText(document.text, 600);
  return {
    id: stableId("DOC", document.name, String(document.bytes), excerpt),
    title: `Founder-provided document: ${document.name}`,
    url: null,
    excerpt,
    relevance: null,
    publishedDate: null,
    query: null,
    queryKind: "FOUNDER_PROVIDED_DOCUMENT",
    sourceType: "FOUNDER_PROVIDED_DOCUMENT",
    captureMethod: "LOCAL_UPLOAD_PARSE",
    verificationStatus: "UNVERIFIED",
    assertionType: "SELF_REPORTED",
    origin: "FOUNDER_PROVIDED",
    syntheticFixture: false,
    capturedAt: new Date(runtime.now()).toISOString()
  };
}

function documentQueryPlan(input, keywords, now = Date.now) {
  const linkTerms = input.links.map((link) => `${new URL(link).hostname}${new URL(link).pathname}`).join(" ");
  const subject = [input.companyName, input.founderNames.join(", "), linkTerms].filter(Boolean).join("; ");
  const comparisonFocus = neutralComparisonFocus(
    [input.context, keywords.join(" ")].filter(Boolean).join(" "),
    [input.companyName, ...input.founderNames, ...input.links]
  );
  const incumbentFocus = targetedComparisonFocus(comparisonFocus, BUYER_FOCUS_TERM);
  const academicFocus = targetedComparisonFocus(comparisonFocus, TECHNICAL_FOCUS_TERM);
  if (!subject && !sufficientComparisonFocus(comparisonFocus)) return [];
  const currentYear = new Date(now()).getUTCFullYear();
  const queryPlan = [];
  if (subject) {
    queryPlan.push({
      kind: "ENTITY_AND_TRACTION",
      query: compactQuery([
        "Identify this startup; check founders, product, customers, pilots, funding, revenue, and traction. Find its official website/contact page and explicitly public professional business or founder profiles. Never infer contact details.",
        subject,
        comparisonFocus
      ]),
      includeAnswer: false
    });
  }
  if (sufficientComparisonFocus(comparisonFocus)) {
    queryPlan.push(
      {
        kind: "INCUMBENT_PROBLEM_AND_REVENUE",
        query: compactQuery([
          "established operator buyer annual report filing earnings operational constraint",
          incumbentFocus
        ]),
        includeAnswer: false,
        excludeSubmittedHosts: true,
        excludeDomains: COMPARATOR_EXCLUDED_DOMAINS,
        startDate: `${currentYear - 3}-01-01`
      },
      {
        kind: "ACADEMIC_VALIDATION",
        query: compactQuery([
          "systematic review clinical trial experimental study technical paper DOI",
          academicFocus
        ]),
        includeAnswer: false,
        excludeSubmittedHosts: true,
        includeDomains: ACADEMIC_SEARCH_DOMAINS
      }
    );
  }
  return queryPlan;
}

function safeStaticPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); }
  catch { return null; }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  let cleanPath = decoded.replace(/^\/+/, "") || "index.html";
  if (cleanPath.split("/").some((segment) => segment.startsWith("."))) return null;
  if (!extname(cleanPath)) cleanPath = "index.html";
  if (!PUBLIC_STATIC_FILES.has(cleanPath) && !PUBLIC_BROWSER_MODULE.test(cleanPath)) return null;
  const candidate = normalize(join(ROOT, cleanPath));
  const relation = relative(ROOT, candidate);
  if (relation.startsWith("..") || relation.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) return null;
  return candidate;
}

function serveStatic(request, response, pathname) {
  let filePath = safeStaticPath(pathname);
  if (!filePath) {
    sendJson(response, 404, { error: "Not found", code: "NOT_FOUND" });
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(response, 404, { error: "Not found", code: "NOT_FOUND" });
    return;
  }
  const stat = statSync(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=300",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}

function capabilityPayload(runtime) {
  const researchBudget = runtime.guard.status();
  return {
    version: "3.0",
    liveResearchConfigured: Boolean(runtime.apiKey),
    provider: runtime.apiKey ? "Tavily" : null,
    crossValidationConfigured: Boolean(runtime.exaKey),
    providers: {
      primary: runtime.apiKey ? "Tavily" : null,
      optionalCrossValidation: runtime.exaKey ? "Exa" : null,
      repositorySignals: "GitHub Public Repository Search API",
      officialOpenData: OPEN_DATA_DATASET_CATALOG.map(({ id, label, coverage, access, documentationUrl }) => ({ id, label, coverage, access, documentationUrl }))
    },
    secretBoundary: "SERVER_ONLY",
    deployment: {
      mode: runtime.deployment.mode,
      publicDemo: runtime.deployment.publicDemo,
      uploadProcessing: runtime.deployment.publicDemo ? "HOSTED_EPHEMERAL_SERVER" : "LOCAL_MACHINE_SERVER",
      publicOrigin: runtime.deployment.publicOrigin
    },
    endpoints: {
      discovery: "/api/discover",
      trends: "/api/trends",
      trendCompanyDiscovery: "/api/trends/discover",
      openDataSignals: "/api/open-data/signals",
      investigation: "/api/investigate",
      documentInspection: "/api/documents/inspect",
      legacySearch: "/api/research"
    },
    uploads: {
      acceptedExtensions: [".txt", ".md", ".html", ".json", ".csv", ".pdf", ".docx"],
      alwaysAvailableExtensions: [...TEXT_TYPES.keys()],
      optionalParsers: { ".pdf": "pdf-parse", ".docx": "mammoth" },
      maxBytes: MAX_DOCUMENT_BYTES,
      parserTimeoutMs: runtime.parserTimeoutMs,
      fullDocumentSentToResearchProvider: false,
      persistedByServer: false,
      processingLocation: runtime.deployment.publicDemo ? "HOSTED_EPHEMERAL_SERVER" : "LOCAL_MACHINE_SERVER"
    },
    guards: {
      arbitraryServerFetch: false,
      explicitLinksUseTavilyExtract: true,
      exaIsOptionalAndExplicit: true,
      crossProviderSameUrlCountsOnce: true,
      selectedTrendIdsAreServerKnown: true,
      maxSelectedTrendsPerCompanyDiscovery: TREND_COMPANY_DISCOVERY_LIMITS.maxSelectedTrends,
      maxTrendDiscoveryTavilyCredits: TREND_COMPANY_DISCOVERY_LIMITS.maxTavilySearches,
      maxTrendDiscoveryGithubRequests: TREND_COMPANY_DISCOVERY_LIMITS.maxGithubSearches,
      maxTrendDiscoveryProviderCalls: TREND_COMPANY_DISCOVERY_LIMITS.maxTavilySearches + TREND_COMPANY_DISCOVERY_LIMITS.maxGithubSearches,
      maxOpenDataExternalRequests: OPEN_DATA_PROVIDER_LIMITS.externalRequestsPerRun,
      maxLinks: MAX_LINKS,
      maxSearchQueries: MAX_SEARCH_QUERIES,
      maxConcurrentResearchJobs: runtime.maxConcurrent,
      rateUnitsPerMinute: runtime.rateUnits,
      publicDemoMaxResearchUnits: researchBudget.maxTotalUnits,
      publicDemoRemainingResearchUnits: researchBudget.remainingTotalUnits
    },
    trust: {
      liveEvidenceStatus: "UNREVIEWED",
      uploadedDocumentStatus: "UNVERIFIED",
      backendProducesInvestmentScore: false,
      openDataCanAffectOpportunityScore: false
    }
  };
}

export function createProoflineServer(options = {}) {
  const deployment = deploymentSettings(options);
  const runtime = {
    apiKey: options.tavilyKey ?? defaultTavilyKey,
    exaKey: options.exaKey ?? defaultExaKey,
    githubToken: options.githubToken ?? defaultGithubToken,
    fetchImpl: options.fetchImpl || globalThis.fetch,
    now: options.now || Date.now,
    rateUnits: options.rateUnits ?? DEFAULT_RATE_UNITS,
    maxConcurrent: options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    parserTimeoutMs: options.parserTimeoutMs ?? DEFAULT_PARSER_TIMEOUT_MS,
    parsePdf: options.parsePdf || defaultPdfParser,
    parseDocx: options.parseDocx || defaultDocxParser,
    deployment
  };
  runtime.guard = createResearchGuard({
    rateUnits: runtime.rateUnits,
    rateWindowMs: options.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS,
    maxConcurrent: runtime.maxConcurrent,
    maxTotalUnits: deployment.maxResearchUnits,
    now: runtime.now
  });

  return createServer(async (request, response) => {
    try {
      const healthUrl = new URL(request.url || "/", "http://localhost");
      if (request.method === "GET" && healthUrl.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }
      assertRequestBoundary(request, deployment);
      const url = new URL(request.url || "/", deployment.publicOrigin || "http://localhost");
      const clientId = request.socket.remoteAddress || "local";
      const apiMethods = new Map([
        ["/api/config", "GET"],
        ["/api/capabilities", "GET"],
        ["/api/health", "GET"],
        ["/api/research", "POST"],
        ["/api/discover", "POST"],
        ["/api/trends", "POST"],
        ["/api/trends/discover", "POST"],
        ["/api/open-data/signals", "POST"],
        ["/api/investigate", "POST"],
        ["/api/documents/inspect", "POST"]
      ]);
      if (apiMethods.has(url.pathname) && request.method !== apiMethods.get(url.pathname)) {
        throw new HttpError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
      }

      if (request.method === "GET" && url.pathname === "/api/config") {
        sendJson(response, 200, {
          liveResearchConfigured: Boolean(runtime.apiKey),
          provider: runtime.apiKey ? "Tavily" : null,
          crossValidationConfigured: Boolean(runtime.exaKey),
          crossValidationProvider: runtime.exaKey ? "Exa" : null,
          mode: "optional"
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/capabilities") {
        sendJson(response, 200, capabilityPayload(runtime));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/research") {
        if (!runtime.apiKey) throw new HttpError(503, "Live research is not configured. Add TAVILY_API or TAVILY_API_KEY to .env or .env.txt.", "LIVE_RESEARCH_NOT_CONFIGURED");
        const body = await readJsonBody(request);
        assertKnownKeys(body, ["query", "crossValidateWithExa"], "research request");
        if (body.crossValidateWithExa !== undefined && typeof body.crossValidateWithExa !== "boolean") {
          throw new HttpError(400, "crossValidateWithExa must be true or false.", "INVALID_CROSS_VALIDATION_FLAG");
        }
        const query = requireString(body.query, "Query", 5, 500);
        const result = await conductResearch({
          mode: "LEGACY_SEARCH",
          queryPlan: [{ kind: "GENERAL_RESEARCH", query }],
          runtime,
          clientId,
          crossValidateWithExa: body.crossValidateWithExa === true
        });
        const executedQuery = result.queries[0]?.query || compactQuery([query]);
        sendJson(response, 200, {
          ...result,
          _providerAnswers: undefined,
          query,
          requestedQuery: query,
          executedQuery,
          answer: result.summary,
          results: result.evidence.map((item) => ({
            title: item.title,
            url: item.url,
            content: item.excerpt,
            score: item.relevance,
            publishedDate: item.publishedDate
          }))
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/discover") {
        if (!runtime.apiKey) throw new HttpError(503, "Live research is not configured. Add TAVILY_API or TAVILY_API_KEY to .env or .env.txt.", "LIVE_RESEARCH_NOT_CONFIGURED");
        const input = discoveryInput(await readJsonBody(request));
        const result = await conductResearch({
          mode: "THESIS_DISCOVERY",
          queryPlan: input.queryPlan,
          runtime,
          clientId,
          crossValidateWithExa: input.crossValidateWithExa
        });
        const candidates = parseDiscoveryCandidates(result._providerAnswers, result.evidence, input.limit).map((candidate) => {
          const sourceEvidenceIds = new Set(candidate.sourceEvidenceIds || []);
          return {
            ...candidate,
            ...discoverPublicProfessionalContacts({
              companyName: candidate.companyName,
              founderNames: candidate.founderNames,
              evidence: result.evidence.filter((item) => sourceEvidenceIds.has(item.id))
            })
          };
        });
        sendJson(response, 200, {
          ...result,
          _providerAnswers: undefined,
          candidates,
          nextRequiredAction: "INVESTIGATE_BEFORE_SCORING"
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/trends") {
        if (!runtime.apiKey) throw new HttpError(503, "Live research is not configured. Add TAVILY_API or TAVILY_API_KEY to .env or .env.txt.", "LIVE_RESEARCH_NOT_CONFIGURED");
        const input = trendsInput(await readJsonBody(request), runtime.now);
        const result = await conductTrendRadar({ focus: input.focus, runtime, clientId });
        const { scoringPolicy: _unusedScoringPolicy, ...trendResult } = result;
        sendJson(response, 200, {
          ...trendResult,
          _providerAnswers: undefined,
          focus: input.focus,
          sections: trendSections(result),
          refreshCostUpperBound: 3,
          boundaries: {
            canAffectStartupScore: false,
            producesProbabilityForecast: false,
            infersTrendDirection: false,
            humanReviewRequired: true
          },
          interpretation: "These are unreviewed public-web signals grouped by query track. They do not create a market score, forecast, or investment decision."
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/trends/discover") {
        if (!runtime.apiKey) throw new HttpError(503, "Live research is not configured. Add TAVILY_API or TAVILY_API_KEY to .env or .env.txt.", "LIVE_RESEARCH_NOT_CONFIGURED");
        const input = trendCompanyDiscoveryInput(await readJsonBody(request));
        const result = await conductTrendCompanyDiscovery({ input, runtime, clientId });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/open-data/signals") {
        const input = openDataInput(await readJsonBody(request));
        const result = await runtime.guard.run(clientId, OPEN_DATA_PROVIDER_LIMITS.externalRequestsPerRun, () => collectOfficialOpenData({
          ...input,
          fetchImpl: runtime.fetchImpl,
          now: runtime.now
        }));
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/investigate") {
        if (!runtime.apiKey) throw new HttpError(503, "Live research is not configured. Add TAVILY_API or TAVILY_API_KEY to .env or .env.txt.", "LIVE_RESEARCH_NOT_CONFIGURED");
        const input = investigationInput(await readJsonBody(request), runtime.now);
        const result = await conductResearch({
          mode: "ENTITY_INVESTIGATION",
          queryPlan: input.queryPlan,
          links: input.links,
          runtime,
          clientId,
          crossValidateWithExa: input.crossValidateWithExa
        });
        const contactProfile = discoverPublicProfessionalContacts({
          companyName: input.companyName,
          founderNames: input.founderNames,
          submittedLinks: input.links,
          evidence: result.evidence
        });
        sendJson(response, 200, {
          ...result,
          ...contactProfile,
          _providerAnswers: undefined,
          subject: { companyName: input.companyName || null, founderNames: input.founderNames, links: input.links }
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/documents/inspect") {
        const body = await readJsonBody(request);
        const input = documentInput(body);
        const document = await runtime.guard.run(clientId, 1, () => parseUploadedDocument(body.file, runtime));
        const keywords = input.allowPlanKeywordsForWebResearch ? sanitizedKeywords(document.text) : [];
        const queryPlan = documentQueryPlan(input, keywords, runtime.now);
        const localEvidence = founderDocumentEvidence(document, runtime);
        let research = null;
        let enrichmentWarning = null;
        if (queryPlan.length && runtime.apiKey) {
          try {
            research = await conductResearch({
              mode: "DOCUMENT_AUGMENTATION",
              queryPlan,
              links: input.links,
              runtime,
              clientId,
              crossValidateWithExa: input.crossValidateWithExa
            });
          } catch (error) {
            if (!(error instanceof HttpError) || !/^(?:UPSTREAM_|LOCAL_(?:RATE|CONCURRENCY)_LIMIT|PUBLIC_DEMO_BUDGET_EXHAUSTED)/.test(error.code)) throw error;
            enrichmentWarning = {
              code: error.code,
              message: "Optional live web enrichment was unavailable. Local document evidence was preserved and remains unverified."
            };
          }
        }
        const liveEvidence = research?.evidence || [];
        const contactProfile = discoverPublicProfessionalContacts({
          companyName: input.companyName,
          founderNames: input.founderNames,
          submittedLinks: input.links,
          evidence: liveEvidence
        });
        const estimatedEnrichmentCredits = Math.min(queryPlan.length, MAX_SEARCH_QUERIES) + (input.links.length ? 1 : 0);
        const processingSummary = runtime.deployment.publicDemo
          ? "Document parsed on the ephemeral hosted server"
          : "Document parsed locally";
        sendJson(response, 200, {
          researchId: research?.researchId || stableId("RES", "LOCAL_DOCUMENT", document.name, String(runtime.now())),
          mode: "DOCUMENT_INSPECTION",
          generatedAt: new Date(runtime.now()).toISOString(),
          provider: research?.provider || null,
          summary: research?.summary || (enrichmentWarning ? `${processingSummary}; optional live web enrichment could not be completed.` : `${processingSummary}; no live web research was performed.`),
          queries: research?.queries || [],
          evidence: [localEvidence, ...liveEvidence],
          ...contactProfile,
          sourceCount: 1 + liveEvidence.length,
          linkInspection: research?.linkInspection || {
            requested: input.links.length,
            extracted: 0,
            failures: enrichmentWarning
              ? input.links.map((link) => ({ url: link, status: "NOT_ACCESSED", reason: "Optional live enrichment did not complete." }))
              : [],
            fallbackSearchUsed: false
          },
          usage: research?.usage || (enrichmentWarning
            ? { reportedCredits: null, estimatedCreditsUpperBound: estimatedEnrichmentCredits, estimateBasis: "Enrichment did not complete; provider-reported usage is unavailable and this is the planned-call upper bound." }
            : { reportedCredits: 0, estimatedCreditsUpperBound: 0, estimateBasis: "No provider request was made." }),
          scoringPolicy: research?.scoringPolicy || { canAffectScore: false, reason: "The uploaded document is self-reported and unverified." },
          document: {
            name: document.name,
            extension: document.extension,
            bytes: document.bytes,
            charactersExtracted: document.text.length,
            excerpt: cleanText(document.text, 600),
            fullTextReturned: false,
            demoSnapshot: document.sha256 === PACKAGED_DEMO_SHA256
              ? {
                  id: PACKAGED_DEMO_ID,
                  status: "PACKAGED_PUBLIC_SOURCE_DEMO_RECOGNIZED",
                  matchBasis: "EXACT_FILE_DIGEST",
                  interpretation: "The exact packaged demo was recognized. Proofline may now load its separate frozen reviewed public-source snapshot; the uploaded PDF itself remains self-reported evidence."
                }
              : null
          },
          privacy: {
            fullDocumentSentToResearchProvider: false,
            documentProcessing: runtime.deployment.publicDemo ? "HOSTED_EPHEMERAL_SERVER" : "LOCAL_MACHINE_SERVER",
            persistedByServer: false,
            planDerivedTermsShared: keywords.length > 0,
            sharedPlanKeywords: keywords,
            consentFlag: input.allowPlanKeywordsForWebResearch
          },
          webResearch: {
            configured: Boolean(runtime.apiKey),
            performed: Boolean(research),
            reason: research
              ? "EXPLICIT_IDENTIFIERS_OR_OPTED_IN_KEYWORDS"
              : enrichmentWarning
                ? "LIVE_RESEARCH_FAILED_LOCAL_DOCUMENT_PRESERVED"
                : queryPlan.length
                  ? "LIVE_RESEARCH_NOT_CONFIGURED"
                  : "NO_EXPLICIT_IDENTIFIERS_AND_PLAN_KEYWORD_SHARING_DISABLED",
            warning: enrichmentWarning
          },
          crossValidation: research?.crossValidation || {
            requested: input.crossValidateWithExa,
            configured: Boolean(runtime.exaKey),
            provider: "Exa",
            status: input.crossValidateWithExa ? "NOT_RUN_WITHOUT_WEB_RESEARCH" : "NOT_REQUESTED",
            queriesAttempted: 0,
            queriesCompleted: 0,
            retrievalOverlapUrls: 0,
            uniqueSourcesAdded: 0,
            warnings: [],
            interpretation: "Provider overlap is a retrieval cross-check only. The same URL is counted once and does not become an independent source."
          },
          caveats: research?.caveats || [
            "Founder-provided claims require independent verification before scoring.",
            ...(enrichmentWarning ? [enrichmentWarning.message] : [])
          ]
        });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        if (request.method !== "GET" && request.method !== "POST") throw new HttpError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
        throw new HttpError(404, "API endpoint not found.", "NOT_FOUND");
      }
      if (request.method === "GET" || request.method === "HEAD") {
        serveStatic(request, response, url.pathname);
        return;
      }
      throw new HttpError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const headers = error?.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
      sendJson(response, status, {
        error: error instanceof HttpError ? error.message : "Unexpected server error.",
        code: error instanceof HttpError ? error.code : "UNEXPECTED_ERROR"
      }, headers);
    }
  });
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (launchedDirectly) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const deployment = deploymentSettings();
  const server = createProoflineServer({
    publicDemo: deployment.publicDemo,
    publicOrigin: deployment.publicOrigin,
    publicDemoMaxResearchUnits: deployment.maxResearchUnits
  });
  server.listen(port, deployment.bindHost, () => {
    console.log(`Proofline is running at ${deployment.publicOrigin || `http://127.0.0.1:${port}`}`);
    console.log(`Deployment mode: ${deployment.mode}`);
    console.log(`Live research: ${defaultTavilyKey ? "configured" : "offline demo mode"}`);
    console.log(`Exa cross-validation: ${defaultExaKey ? "configured" : "not configured"}`);
  });
}
