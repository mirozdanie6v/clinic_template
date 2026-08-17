# Factory Agent — Implementation Readiness Assessment

Status: **validated discovery; implementation foundation required**
Scope: `PROTOTYPE` mode only
Authority: `docs/CODEX_AGENT_ARCHITECTURE_BRIEF.md`

## Executive decision

The repository is a usable **product-template baseline**, not yet a runnable
multi-agent factory. It already supplies reusable client passports, data packs,
client builders, visual gates and product-quality rules. It does not yet supply
an Orchestrator runtime, role contracts, durable run state, agent invocation
adapters, independent-QA workflow, deployment approval boundary or a
`make_prototype(client_input)` command.

The factory must therefore be added as an isolated subsystem. Existing
`clinic_template` application behaviour remains the Full Development Baseline
and must not be repurposed or silently changed by factory work.

## Verified baseline

| Area | Evidence | Status |
| --- | --- | --- |
| Approved target architecture | `docs/CODEX_AGENT_ARCHITECTURE_BRIEF.md` | validated |
| Client source of truth | `clients/<slug>/passport.json`, `docs/CLIENT_PIPELINE.md` | validated |
| Client data building | `scripts/build-client-*.mjs` | validated as existing baseline |
| Product quality policy | `docs/miniapp-product-quality-contract.md`, `quality/miniapp-rules.v1.json` | validated |
| Visual / asset gate | `docs/visual-audit-stage.md`, `scripts/validate-visual-readiness.mjs` | validated |
| Agent Orchestrator | no implementation found | missing |
| Agent-to-agent artifact schemas | no implementation found | missing |
| Durable run state and audit trail | no implementation found | missing |
| BA acceptance gate | no implementation found | missing |
| Independent QA gate / defect routing | no implementation found | missing |
| Safe deploy authorization | no implementation found | missing |
| End-to-end factory evaluation | no implementation found | missing |

## Implementation stages

| Stage | Deliverable | Blocking PASS evidence |
| --- | --- | --- |
| F0 — Foundation | contracts, state machine, run store, deterministic gate engine | automated contract/state tests pass |
| F1 — Role adapters | Orchestrator, BA, UX/UI, Frontend, optional Backend, QA interfaces | each role rejects invalid input and emits valid output |
| F2 — Safe tools | research, workspace, build and validator tools with capability policy | forbidden Prototype side effects are blocked and logged |
| F3 — Prototype assembly | `make_prototype` workflow against a fixture business | all machine gates pass; no deployment action is attempted |
| F4 — Evaluation | golden case, regression cases, trace/audit review | happy path and failure-routing cases pass |
| F5 — Controlled release | Cloudflare publisher with explicit release authority | preview URL, build and smoke checks are recorded |
| F6 — First live proof | approved real client run | QA PASS, deployed URL and post-deploy smoke evidence |

No stage may be represented as deployed or production-ready until its stated
evidence exists.

## Chosen technical boundary

1. Keep factory code under `factory-agent/`; do not mix it with the Next.js
   application or existing client generator.
2. Make the F0 engine deterministic and dependency-light. It validates
   artifacts and transitions without calling a model or external service.
3. Add model-backed role adapters only after the deterministic contracts pass.
   The OpenAI Agents SDK adapter requires `OPENAI_API_KEY`; secrets must stay in
   environment configuration and are never read, printed or committed.
4. Make deployment a terminal, explicitly authorized capability. A role may
   prepare a release request but cannot deploy itself.
5. Treat `FULL_DEVELOPMENT` as rejected input in v1.

## Existing reusable assets

- Client passports and normalized data packs can become input evidence for BA.
- Existing strategy, visual and product validators remain downstream checks;
  the factory calls them as controlled tools rather than duplicating their
  rules.
- EVO is an evaluation candidate only after the factory skeleton runs. It is
  not the initial implementation template.

## Unresolved external prerequisites

These are intentionally not guessed or bypassed:

1. **OpenAI runtime credential and model policy** — required to execute actual
   model-backed roles.
2. **Cloudflare account/project and deployment authority** — required for a
   real preview or production deployment.
3. **First approved fixture or client input** — required for semantic quality
   evaluation; a synthetic fixture can prove mechanics but not business quality.
4. **Human approval policy** — required before a deployment, even in
   `PROTOTYPE` mode.

The first implementation work may proceed without these prerequisites; live
agent execution and deployment may not.

## First safe implementation step

Implement F0: versioned artifact envelopes, the exact stage state machine,
role ownership registry, PASS/FAIL routing, append-only audit events and a
deterministic test fixture. This makes the approved architecture executable
before any model or deployment credential is introduced.
