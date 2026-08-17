# Factory Agent — Evaluation Plan v1

Status: **required before a live client run**

## Goal

Prove workflow correctness separately from subjective product quality. The
factory may call a prototype ready only when workflow, artifact, quality and
release evidence all pass.

## F0 deterministic cases

| Case | Input | Expected result |
| --- | --- | --- |
| happy path | complete Prototype fixture | reaches `PROTOTYPE_READY` only after all gates |
| invalid mode | `FULL_DEVELOPMENT` | rejected before run creation |
| missing worker evidence | BA PASS attempt without UX/UI result | blocked |
| QA failure | QA report with P1 defect | routed to responsible worker and cannot deploy |
| backend not required | BA decision `not_required` | backend result is not demanded |
| prohibited side effect | Prototype request for CRM write | denied and audited |
| unauthorized deploy | QA PASS without authorization | blocked |

## Golden prototype case

Use a deliberately small, approved business fixture first. Required evidence:

1. cited research facts and data-quality statement;
2. BA product blueprint and role-specific specifications;
3. UX/UI design, asset manifest and responsive requirements;
4. frontend implementation manifest plus existing quality-validator evidence;
5. backend decision and, if applicable, demo-only proof;
6. BA acceptance report;
7. independent QA report with no P0/P1 and documented P2 exceptions;
8. explicit release authorization;
9. deployed preview URL and post-deploy critical-journey smoke result.

EVO can become the first real evaluation case only after the synthetic golden
case proves the factory mechanics. It must be assessed from current source
evidence, not copied as a fixed product structure.

## Exit rules

- A test failure blocks its stage and becomes a regression case.
- A model response is never accepted merely because it is well-written; it must
  validate against the relevant schema and evidence requirements.
- Production completion is not claimed from a local build, mocked deploy, or
  unverified URL.
