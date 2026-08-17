# Factory Agent — Runtime Contract v1

Status: **normative for F0**
Mode: `PROTOTYPE` only

## Role ownership

| Role | May create | May approve | May not do |
| --- | --- | --- | --- |
| Orchestrator | run state, routing events, release request | structural artifact presence only | decide product meaning, accept its own worker output, deploy without release authority |
| Lead Business Analyst | research synthesis, product blueprint, role specs, BA review | semantic/product acceptance | implement frontend/backend, approve absent evidence |
| UX/UI | screen spec, design system, image plan, assets manifest | its draft completeness | operate as a separate Assets top-level role |
| Frontend | app implementation manifest and test evidence | its draft completeness | alter approved product semantics without BA revision |
| Backend | backend manifest and test evidence | its draft completeness | make real Prototype side effects |
| Independent QA | QA report and defects | release-quality result | implement product features or approve its own fixes |
| Publisher | release and smoke evidence | deployment execution after authorization | override QA FAIL or BA FAIL |

## Artifact envelope

Every artifact is immutable once accepted and has this outer structure:

```json
{
  "schemaVersion": "1.0",
  "artifactId": "uuid-or-stable-id",
  "type": "research | product-blueprint | role-spec | worker-result | ba-review | qa-report | release",
  "runId": "run-id",
  "revision": 1,
  "producer": "orchestrator | lead-ba | ux-ui | frontend | backend | independent-qa | publisher",
  "createdAt": "ISO-8601 timestamp",
  "inputs": [{"artifactId": "upstream-id", "revision": 1}],
  "payload": {},
  "validation": {"status": "PASS | FAIL", "checks": []}
}
```

`inputs` provides provenance. A consumer must reject an artifact from another
run, an unknown producer, a future revision or an invalid validation status.

## Required artifacts per gate

| Gate | Required evidence | Decision owner |
| --- | --- | --- |
| `REQUIREMENTS_READY` | research, product blueprint, UX/UI spec, frontend spec, backend decision, acceptance criteria | Lead BA |
| `BA_ACCEPTANCE` | all required worker results and BA review | Lead BA |
| `INDEPENDENT_QA` | BA PASS and QA report | Independent QA |
| `DEPLOY` | QA PASS and authorized release request | Publisher via Orchestrator |
| `POST_DEPLOY_SMOKE` | deployed URL, build reference, smoke report | Publisher / Orchestrator |

## State machine

```text
INTAKE
  -> RESEARCH
  -> BUSINESS_ANALYSIS_AND_PRODUCT_ARCHITECTURE
  -> REQUIREMENTS_READY
  -> WORKERS_IN_PROGRESS
  -> BA_ACCEPTANCE
  -> INDEPENDENT_QA
  -> DEPLOY
  -> POST_DEPLOY_SMOKE
  -> PROTOTYPE_READY
```

Allowed failure routes:

```text
REQUIREMENTS_READY FAIL -> BUSINESS_ANALYSIS_AND_PRODUCT_ARCHITECTURE
BA_ACCEPTANCE FAIL -> WORKERS_IN_PROGRESS (only responsible role is reopened)
INDEPENDENT_QA FAIL -> WORKERS_IN_PROGRESS -> BA_ACCEPTANCE -> INDEPENDENT_QA
DEPLOY FAIL -> INDEPENDENT_QA
POST_DEPLOY_SMOKE FAIL -> DEPLOY
```

No transition may skip a listed stage. `FULL_DEVELOPMENT` is not an allowed
mode in v1.

## Prototype capability policy

Allowed by default: read-only research, workspace-local artifact creation,
local build/test, demo/local/read-only providers, preview preparation.

Denied by default: CRM writes, booking writes, payments, email/SMS/Telegram
sends, destructive external actions, secret disclosure, and production deploy.
An explicit release authorization can enable only the controlled publisher
deployment path; it cannot expand business-side-effect permissions.

## Audit requirements

The run store records append-only events for run creation, artifact validation,
transition attempt, transition result, role dispatch, failure route, release
authorization and smoke result. Each event contains `runId`, timestamp, actor,
event type, current stage and a non-secret evidence reference.
