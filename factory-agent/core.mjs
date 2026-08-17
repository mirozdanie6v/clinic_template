import { randomUUID } from "node:crypto";

export const MODE = Object.freeze({ PROTOTYPE: "PROTOTYPE" });

export const ROLE = Object.freeze({
  ORCHESTRATOR: "orchestrator",
  LEAD_BA: "lead-ba",
  UX_UI: "ux-ui",
  FRONTEND: "frontend",
  BACKEND: "backend",
  INDEPENDENT_QA: "independent-qa",
  PUBLISHER: "publisher"
});

export const STAGE = Object.freeze({
  INTAKE: "INTAKE",
  RESEARCH: "RESEARCH",
  ANALYSIS: "BUSINESS_ANALYSIS_AND_PRODUCT_ARCHITECTURE",
  REQUIREMENTS: "REQUIREMENTS_READY",
  WORKERS: "WORKERS_IN_PROGRESS",
  BA_ACCEPTANCE: "BA_ACCEPTANCE",
  QA: "INDEPENDENT_QA",
  DEPLOY: "DEPLOY",
  SMOKE: "POST_DEPLOY_SMOKE",
  READY: "PROTOTYPE_READY"
});

const TYPE_OWNER = Object.freeze({
  research: ROLE.LEAD_BA,
  "product-blueprint": ROLE.LEAD_BA,
  "role-spec": ROLE.LEAD_BA,
  "acceptance-criteria": ROLE.LEAD_BA,
  "backend-decision": ROLE.LEAD_BA,
  "ux-ui-result": ROLE.UX_UI,
  "frontend-result": ROLE.FRONTEND,
  "backend-result": ROLE.BACKEND,
  "ba-review": ROLE.LEAD_BA,
  "qa-report": ROLE.INDEPENDENT_QA,
  "release-request": ROLE.ORCHESTRATOR,
  "release-result": ROLE.PUBLISHER,
  "smoke-report": ROLE.PUBLISHER
});

const FORBIDDEN_PROTOTYPE_ACTIONS = new Set([
  "crm-write", "booking-write", "payment", "email-send", "sms-send",
  "telegram-send", "destructive-external-action", "production-secret-read"
]);

function fail(message) {
  throw new Error(`factory-agent: ${message}`);
}

function event(run, actor, type, details = {}) {
  run.audit.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    actor,
    type,
    stage: run.stage,
    ...details
  });
}

function findLatest(run, type) {
  return [...run.artifacts].reverse().find((artifact) => artifact.type === type);
}

function requireArtifact(run, type) {
  const artifact = findLatest(run, type);
  if (!artifact) fail(`missing required artifact ${type}`);
  return artifact;
}

function assertNoBlockingDefects(report) {
  const defects = report.payload?.defects ?? [];
  const blockers = defects.filter((defect) => defect.severity === "P0" || defect.severity === "P1");
  if (blockers.length > 0) fail(`QA report contains ${blockers.length} release-blocking defect(s)`);
}

function backendRequired(run) {
  return findLatest(run, "backend-decision")?.payload?.required === true;
}

function assertGate(run, to, authorization) {
  if (to === STAGE.WORKERS) {
    for (const type of ["research", "product-blueprint", "role-spec", "acceptance-criteria", "backend-decision"]) requireArtifact(run, type);
  }
  if (to === STAGE.QA) {
    for (const type of ["ux-ui-result", "frontend-result", "ba-review"]) requireArtifact(run, type);
    if (backendRequired(run)) requireArtifact(run, "backend-result");
    if (requireArtifact(run, "ba-review").payload?.decision !== "PASS") fail("BA review must be PASS before QA");
  }
  if (to === STAGE.DEPLOY) {
    assertNoBlockingDefects(requireArtifact(run, "qa-report"));
    requireArtifact(run, "release-request");
    if (authorization !== true) fail("deploy requires explicit release authorization");
  }
  if (to === STAGE.SMOKE) requireArtifact(run, "release-result");
  if (to === STAGE.READY) {
    const smoke = requireArtifact(run, "smoke-report");
    if (smoke.payload?.decision !== "PASS") fail("post-deploy smoke must be PASS");
  }
}

const SUCCESSORS = Object.freeze({
  [STAGE.INTAKE]: STAGE.RESEARCH,
  [STAGE.RESEARCH]: STAGE.ANALYSIS,
  [STAGE.ANALYSIS]: STAGE.REQUIREMENTS,
  [STAGE.REQUIREMENTS]: STAGE.WORKERS,
  [STAGE.WORKERS]: STAGE.BA_ACCEPTANCE,
  [STAGE.BA_ACCEPTANCE]: STAGE.QA,
  [STAGE.QA]: STAGE.DEPLOY,
  [STAGE.DEPLOY]: STAGE.SMOKE,
  [STAGE.SMOKE]: STAGE.READY
});

export function createRun({ runId = randomUUID(), mode, clientInput }) {
  if (mode !== MODE.PROTOTYPE) fail("only PROTOTYPE mode is implemented in v1");
  if (!clientInput || typeof clientInput !== "object") fail("clientInput must be an object");
  const run = { runId, mode, clientInput, stage: STAGE.INTAKE, artifacts: [], audit: [] };
  event(run, ROLE.ORCHESTRATOR, "RUN_CREATED", { mode });
  return run;
}

export function addArtifact(run, artifact) {
  if (!run || !Array.isArray(run.artifacts)) fail("invalid run");
  if (!artifact || typeof artifact !== "object") fail("artifact must be an object");
  for (const key of ["schemaVersion", "artifactId", "type", "runId", "revision", "producer", "createdAt", "inputs", "payload", "validation"]) {
    if (!(key in artifact)) fail(`artifact missing ${key}`);
  }
  if (artifact.schemaVersion !== "1.0") fail("unsupported artifact schemaVersion");
  if (artifact.runId !== run.runId) fail("artifact belongs to another run");
  if (TYPE_OWNER[artifact.type] !== artifact.producer) fail(`artifact type ${artifact.type} has invalid producer`);
  if (!Number.isInteger(artifact.revision) || artifact.revision < 1) fail("artifact revision must be a positive integer");
  if (!Array.isArray(artifact.inputs)) fail("artifact inputs must be an array");
  if (artifact.validation?.status !== "PASS") fail("only validated PASS artifacts may enter the run store");
  if (run.artifacts.some((entry) => entry.artifactId === artifact.artifactId && entry.revision === artifact.revision)) fail("artifact revision already exists");
  run.artifacts.push(structuredClone(artifact));
  event(run, artifact.producer, "ARTIFACT_ACCEPTED", { artifactId: artifact.artifactId, artifactType: artifact.type, revision: artifact.revision });
  return run;
}

export function transition(run, { actor, decision = "PASS", authorization = false, responsibleRole } = {}) {
  if (actor !== ROLE.ORCHESTRATOR) fail("only Orchestrator may transition run state");
  if (decision !== "PASS" && decision !== "FAIL") fail("decision must be PASS or FAIL");
  if (decision === "FAIL") {
    if (![STAGE.REQUIREMENTS, STAGE.BA_ACCEPTANCE, STAGE.QA, STAGE.DEPLOY, STAGE.SMOKE].includes(run.stage)) fail(`FAIL is not valid from ${run.stage}`);
    const rollback = run.stage === STAGE.REQUIREMENTS ? STAGE.ANALYSIS : run.stage === STAGE.DEPLOY ? STAGE.QA : run.stage === STAGE.SMOKE ? STAGE.DEPLOY : STAGE.WORKERS;
    event(run, actor, "GATE_FAILED", { responsibleRole, rollback });
    run.stage = rollback;
    return run;
  }
  const next = SUCCESSORS[run.stage];
  if (!next) fail(`no PASS transition is allowed from ${run.stage}`);
  assertGate(run, next, authorization);
  event(run, actor, "GATE_PASSED", { next });
  run.stage = next;
  return run;
}

export function requestCapability(run, { actor, capability }) {
  if (!Object.values(ROLE).includes(actor)) fail("unknown actor");
  if (FORBIDDEN_PROTOTYPE_ACTIONS.has(capability)) {
    event(run, actor, "CAPABILITY_DENIED", { capability });
    fail(`capability ${capability} is prohibited in PROTOTYPE mode`);
  }
  event(run, actor, "CAPABILITY_ALLOWED", { capability });
  return true;
}

export function makeArtifact(run, { type, producer, payload = {}, inputs = [] }) {
  return {
    schemaVersion: "1.0",
    artifactId: randomUUID(),
    type,
    runId: run.runId,
    revision: 1,
    producer,
    createdAt: new Date().toISOString(),
    inputs,
    payload,
    validation: { status: "PASS", checks: ["fixture"] }
  };
}
