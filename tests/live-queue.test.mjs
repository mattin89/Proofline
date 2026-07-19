import test from "node:test";
import assert from "node:assert/strict";

import { createEmovoDemoAssessment } from "../src/demo-data.mjs";
import { createLiveWorkspaceState } from "../src/live-workspace.mjs";
import {
  isAssessmentQueued,
  projectLiveQueue,
  queueAssessment,
  removeQueuedAssessment
} from "../src/live-queue.mjs";

test("a session assessment is queued exactly once without copying or recomputing it", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  const originalScore = assessment.provisionalScore;

  const first = queueAssessment(live, assessment.id, "2026-07-19T08:20:00.000Z");
  const duplicate = queueAssessment(live, assessment.id, "2026-07-19T08:21:00.000Z");
  const projection = projectLiveQueue(live, []);

  assert.equal(first, duplicate);
  assert.equal(live.queueEvents.length, 1);
  assert.equal(projection.length, 1);
  assert.equal(projection[0].companyName, "Emovo Care");
  assert.deepEqual(projection[0].founderNames, ["Luca Randazzo", "Iselin Frøybu"]);
  assert.equal(projection[0].engineSnapshot.researchId, assessment.research.researchId || assessment.id);
  assert.equal(assessment.provisionalScore, originalScore);
  assert.equal(isAssessmentQueued(live, assessment.id), true);
});

test("queue projection reflects later assessment review changes through its reference", () => {
  const live = createLiveWorkspaceState();
  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  queueAssessment(live, assessment.id, "2026-07-19T08:20:00.000Z");
  assessment.research.summary = "Updated authoritative session summary.";

  assert.equal(projectLiveQueue(live, [])[0].summary, "Updated authoritative session summary.");
  assert.equal(live.queueEvents.length, 1);
});

test("unknown assessments are rejected and queued assessments can be removed", () => {
  const live = createLiveWorkspaceState();
  assert.throws(() => queueAssessment(live, "MISSING"), /existing session assessment/);

  const assessment = createEmovoDemoAssessment();
  live.assessments = [assessment];
  queueAssessment(live, assessment.id, "2026-07-19T08:20:00.000Z");
  assert.equal(removeQueuedAssessment(live, assessment.id), true);
  assert.equal(projectLiveQueue(live, []).length, 0);
});
