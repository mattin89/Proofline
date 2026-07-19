import test from "node:test";
import assert from "node:assert/strict";

import {
  createDemoReadyLiveWorkspaceState,
  createLiveWorkspaceState,
  mapSourceType,
  mapSubject,
  normalizeEvidence,
  renderLiveWorkspace
} from "../src/live-workspace.mjs";
import { createEmovoDemoAssessment, EMOVO_DEMO_TEMPLATE } from "../src/demo-data.mjs";
import { DEFAULT_CHECK_POLICY } from "../src/investment-policy.mjs";
import { projectLiveQueue, queueAssessment } from "../src/live-queue.mjs";
import { SCORED_PIPELINE_LEADS } from "../src/sourced-pipeline-v2.mjs";

const CAPTURED_AT = "2026-07-18T12:00:00.000Z";

function webEvidence(overrides = {}) {
  return {
    id: "WEB-1",
    title: "Technical study",
    url: "https://example.org/study",
    excerpt: "A technical study of robotic hand rehabilitation.",
    sourceType: "PUBLIC_WEB",
    queryKind: "ACADEMIC_VALIDATION",
    captureMethod: "TAVILY_SEARCH",
    relevance: 0.7,
    ...overrides
  };
}

test("academic search categories never become peer-reviewed automatically", () => {
  const evidence = normalizeEvidence([
    webEvidence({
      url: "https://research.example.edu/paper",
      sourceType: "ACADEMIC_RESEARCH"
    })
  ], CAPTURED_AT);

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].sourceType, "INDEPENDENT_TECHNICAL");
  assert.equal(evidence[0].subject, "ACADEMIC");
  assert.notEqual(evidence[0].sourceType, "PEER_REVIEWED_RESEARCH");
});

test("query intent never overrides the observed source role", () => {
  const evidence = normalizeEvidence([
    webEvidence({ url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1234567/" })
  ], CAPTURED_AT);

  assert.equal(evidence[0].sourceType, "GOVERNMENT_OR_REGULATORY");
  assert.equal(evidence[0].subject, "REGULATORY");
});

test("social evidence requires explicit founder attribution", () => {
  const unrelated = mapSubject(
    { title: "Emovo Care company update", excerpt: "A new product release." },
    "SOCIAL_PROFILE",
    { companyName: "Emovo Care", founderNames: ["Jane Founder"] }
  );
  const attributed = mapSubject(
    { title: "Jane Founder interview", excerpt: "Jane Founder describes the shipped prototype." },
    "SOCIAL_PROFILE",
    { companyName: "Emovo Care", founderNames: ["Jane Founder"] }
  );

  assert.equal(unrelated, "STARTUP");
  assert.equal(attributed, "FOUNDER");
});

test("incumbent and startup source roles do not overwrite source ownership", () => {
  assert.equal(mapSubject({ queryKind: "INCUMBENT_PROBLEM_AND_REVENUE" }, "SEARCH_SNIPPET"), "OTHER");
  assert.equal(mapSubject({ queryKind: "INCUMBENT_PROBLEM_AND_REVENUE" }, "STARTUP_PRIMARY"), "STARTUP");
});

test("URL-less web results are dropped while authorized uploads receive a local URL", () => {
  const evidence = normalizeEvidence([
    webEvidence({ id: "NO-URL", url: null }),
    {
      id: "PLAN-1",
      title: "Founder plan",
      excerpt: "Authorized plan excerpt",
      sourceType: "FOUNDER_PROVIDED_DOCUMENT",
      queryKind: "FOUNDER_PROVIDED_DOCUMENT",
      captureMethod: "LOCAL_DOCUMENT_PARSER"
    }
  ], CAPTURED_AT);

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].sourceType, "UPLOADED_BUSINESS_PLAN");
  assert.match(evidence[0].sourceUrl, /^proofline:\/\/upload\//);
});

test("academic upstream classification is conservative", () => {
  assert.equal(mapSourceType({ sourceType: "ACADEMIC_RESEARCH" }, "nature.com"), "INDEPENDENT_TECHNICAL");
});

const thesis = {
  version: 1,
  name: "Early-stage deep technology",
  sectors: ["Health", "Robotics"],
  stages: ["Pre-seed", "Seed"],
  geographies: ["Europe"],
  riskAppetite: "Evidence-gated"
};

const tavily = { configured: true, exaConfigured: true };

test("Emovo Care values are the editable investigation defaults without a prefill box", () => {
  const live = createLiveWorkspaceState();
  assert.equal(live.mode, "investigate");
  assert.equal(live.intake.companyName, EMOVO_DEMO_TEMPLATE.companyName);
  assert.equal(live.intake.founderNames, EMOVO_DEMO_TEMPLATE.founderNames);
  assert.equal(live.intake.links, EMOVO_DEMO_TEMPLATE.links);
  assert.equal(live.intake.context, EMOVO_DEMO_TEMPLATE.context);

  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /value="Emovo Care"/);
  assert.match(html, /Real-data demo defaults/);
  assert.doesNotMatch(html, /data-load-emovo-template|Prefill live search|verified-demo-card/);
});

test("a fresh demo session keeps Emovo available but out of the Queue", () => {
  const live = createDemoReadyLiveWorkspaceState();
  assert.equal(live.assessments.length, 1);
  assert.equal(live.assessments[0].companyName, "Emovo Care");
  assert.equal(live.selectedAssessmentId, live.assessments[0].id);
  assert.deepEqual(live.queueEvents, []);
  assert.deepEqual(live.queueWorkflowEvents, []);
  assert.equal(live.selectedQueueId, null);

  const queue = projectLiveQueue(live, SCORED_PIPELINE_LEADS);
  assert.equal(queue.length, 5);
  assert.equal(queue.some((item) => item.companyName === "Emovo Care"), false);

  live.mode = "assessments";
  const html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /data-add-live-queue=.*Add to Queue/);
});

test("a session assessment offers an idempotent Queue action", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  live.selectedAssessmentId = assessment.id;
  live.mode = "assessments";

  let html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /data-add-live-queue=.*Add to Queue/);

  queueAssessment(live, assessment.id, "2026-07-19T08:20:00.000Z");
  html = renderLiveWorkspace({ live, thesis, tavily, investmentPolicy: DEFAULT_CHECK_POLICY });
  assert.match(html, /data-add-live-queue=.*disabled.*In Queue/);
});
