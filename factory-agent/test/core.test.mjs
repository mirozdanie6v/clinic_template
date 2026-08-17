import assert from "node:assert/strict";
import test from "node:test";
import { MODE, ROLE, STAGE, addArtifact, createRun, makeArtifact, requestCapability, transition } from "../core.mjs";

function add(run, type, producer, payload = {}) {
  addArtifact(run, makeArtifact(run, { type, producer, payload }));
}

function advanceToWorkers(run) {
  transition(run, { actor: ROLE.ORCHESTRATOR });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "research", ROLE.LEAD_BA);
  add(run, "product-blueprint", ROLE.LEAD_BA);
  add(run, "role-spec", ROLE.LEAD_BA);
  add(run, "acceptance-criteria", ROLE.LEAD_BA);
  add(run, "backend-decision", ROLE.LEAD_BA, { required: false });
  transition(run, { actor: ROLE.ORCHESTRATOR });
}

test("Prototype happy path reaches PROTOTYPE_READY only with all required evidence", () => {
  const run = createRun({ runId: "happy", mode: MODE.PROTOTYPE, clientInput: { business: "fixture" } });
  advanceToWorkers(run);
  assert.equal(run.stage, STAGE.WORKERS);
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "ux-ui-result", ROLE.UX_UI);
  add(run, "frontend-result", ROLE.FRONTEND);
  add(run, "ba-review", ROLE.LEAD_BA, { decision: "PASS" });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "qa-report", ROLE.INDEPENDENT_QA, { defects: [] });
  add(run, "release-request", ROLE.ORCHESTRATOR);
  transition(run, { actor: ROLE.ORCHESTRATOR, authorization: true });
  add(run, "release-result", ROLE.PUBLISHER, { url: "https://preview.example.test" });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "smoke-report", ROLE.PUBLISHER, { decision: "PASS" });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  assert.equal(run.stage, STAGE.READY);
  assert.ok(run.audit.some((entry) => entry.type === "GATE_PASSED"));
});

test("FULL_DEVELOPMENT is rejected before a run is created", () => {
  assert.throws(() => createRun({ mode: "FULL_DEVELOPMENT", clientInput: {} }), /only PROTOTYPE/);
});

test("BA cannot send incomplete worker outputs to QA", () => {
  const run = createRun({ runId: "incomplete", mode: MODE.PROTOTYPE, clientInput: { business: "fixture" } });
  advanceToWorkers(run);
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "frontend-result", ROLE.FRONTEND);
  add(run, "ba-review", ROLE.LEAD_BA, { decision: "PASS" });
  assert.throws(() => transition(run, { actor: ROLE.ORCHESTRATOR }), /ux-ui-result/);
});

test("QA P1 failure rolls work back and blocks deploy", () => {
  const run = createRun({ runId: "qa-fail", mode: MODE.PROTOTYPE, clientInput: { business: "fixture" } });
  advanceToWorkers(run);
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "ux-ui-result", ROLE.UX_UI);
  add(run, "frontend-result", ROLE.FRONTEND);
  add(run, "ba-review", ROLE.LEAD_BA, { decision: "PASS" });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "qa-report", ROLE.INDEPENDENT_QA, { defects: [{ severity: "P1" }] });
  assert.throws(() => transition(run, { actor: ROLE.ORCHESTRATOR, authorization: true }), /release-blocking/);
  transition(run, { actor: ROLE.ORCHESTRATOR, decision: "FAIL", responsibleRole: ROLE.FRONTEND });
  assert.equal(run.stage, STAGE.WORKERS);
});

test("Prototype side effects are denied and audited", () => {
  const run = createRun({ runId: "safety", mode: MODE.PROTOTYPE, clientInput: { business: "fixture" } });
  assert.throws(() => requestCapability(run, { actor: ROLE.BACKEND, capability: "crm-write" }), /prohibited/);
  assert.equal(run.audit.at(-1).type, "CAPABILITY_DENIED");
});

test("deploy cannot proceed without explicit release authorization", () => {
  const run = createRun({ runId: "deploy-auth", mode: MODE.PROTOTYPE, clientInput: { business: "fixture" } });
  advanceToWorkers(run);
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "ux-ui-result", ROLE.UX_UI);
  add(run, "frontend-result", ROLE.FRONTEND);
  add(run, "ba-review", ROLE.LEAD_BA, { decision: "PASS" });
  transition(run, { actor: ROLE.ORCHESTRATOR });
  add(run, "qa-report", ROLE.INDEPENDENT_QA, { defects: [] });
  add(run, "release-request", ROLE.ORCHESTRATOR);
  assert.throws(() => transition(run, { actor: ROLE.ORCHESTRATOR }), /explicit release authorization/);
});
