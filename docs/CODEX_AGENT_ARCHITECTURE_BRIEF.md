# Codex brief: Mini App Factory Agent architecture

Status: approved architecture brief for transfer to Codex.

## Goal
Build a GPT/Agents-based factory that can take a high-level user command such as `Сделай прототип для <business>` and autonomously produce a complete, client-specific prototype through research, requirements, UX/UI, implementation, QA and Cloudflare deployment.

The factory must support two distinct product modes.

## Mode 1 — PROTOTYPE

Prototype is the current development target.

Definition of done:
- business research completed;
- facts and sources collected;
- product structure designed specifically for the client;
- catalog/information architecture normalized when needed;
- UX/UI completed;
- frontend completed;
- AI consultant included in the prototype experience where appropriate;
- demo interactions work;
- real outbound side effects are disabled;
- mobile/UX/visual QA passed;
- deployed to Cloudflare;
- production URL smoke-tested.

Prototype restrictions:
- no real CRM writes;
- no real booking writes unless explicitly approved for the prototype;
- no real email/SMS sends;
- no real Telegram notifications;
- no payments;
- no destructive external actions;
- production secrets are not required for demo-only flows;
- demo/local/read-only providers are allowed.

The prototype should look and behave like a finished product from the user/client perspective, while external business-side effects remain disabled.

## Mode 2 — FULL_DEVELOPMENT

Full development is frozen for now as a future mode.

The existing `clinic_template` production-oriented work must be treated as `Full Development Baseline v1` and preserved as reference implementation and documentation.

When a real client appears, the agent documentation can be extended to activate the full-development path, including:
- backend persistence;
- real booking/CRM writes;
- production Telegram/email/SMS flows;
- authentication;
- payments where required;
- production AI integrations;
- secrets management;
- monitoring;
- security hardening;
- full runtime/device acceptance;
- production release.

Do not force current prototype work to satisfy all Full Development requirements.

## Core principle: unique product architecture per client

The factory must not use one fixed UI template as the structural blueprint for all businesses.

Reusable elements are allowed at lower levels:
- capability modules;
- UI components;
- technical adapters;
- design-system primitives;
- validated UX patterns;
- regression rules.

Each client must receive a new product structure derived from:
- business model;
- user jobs;
- customer decision process;
- catalog/entities;
- locations/resources;
- conversion goal;
- trust requirements;
- repeat-use logic;
- brand and audience context.

Existing cases such as AVE and EVO are reference implementations and learning sources. They are not mandatory structural templates.

## Final Manager–Workers architecture

```text
                           USER
                            |
                            v
                      ORCHESTRATOR
                            |
                            v
                LEAD BUSINESS ANALYST
        research + product architecture + requirements
                            |
          +-----------------+-----------------+
          |                 |                 |
          v                 v                 v
       UX/UI             FRONTEND          BACKEND
       AGENT               AGENT             AGENT
          |                 |                 |
          +-----------------+-----------------+
                            |
                            v
                LEAD BUSINESS ANALYST
                    acceptance review
                            |
                   FAIL ---------- PASS
                    |                |
                    v                v
            return to worker   INDEPENDENT QA
                                     |
                              FAIL --+-- PASS
                               |          |
                               v          v
                         responsible   ORCHESTRATOR
                           worker          |
                                           v
                                        DEPLOY
```

For PROTOTYPE mode, Backend can be minimal or demo-only. If a real backend is unnecessary, the orchestrator may skip the Backend worker after the Business Analyst explicitly marks it as not required.

## Role responsibilities

### 1. Orchestrator
Owns process control, not product meaning.

Responsibilities:
- accepts the user's goal;
- selects `PROTOTYPE` or `FULL_DEVELOPMENT` mode;
- creates and tracks the stage plan;
- invokes roles;
- provides each role the correct inputs and contract;
- verifies required artifacts exist and have the expected schema;
- prevents stages from being skipped;
- routes failed work back to the responsible role;
- tracks status until final deployment;
- returns the finished URL/result to the user.

The Orchestrator should not replace specialist judgment when a specialist role owns that decision.

### 2. Lead Business Analyst
The central product-thinking role.

Responsibilities:
- research the business according to the research instructions;
- collect and normalize facts and sources;
- analyze the business model, users, pains, trust, offers and digital process;
- decide what digital product/experience should be built for this specific business;
- design the high-level product architecture;
- analyze and normalize catalog/information structure when relevant;
- define user journeys and capabilities;
- create separate professional briefs/specifications for UX/UI, Frontend, Backend and acceptance criteria;
- receive worker results;
- compare each result with the relevant specification;
- accept the result or return it for revision.

The Business Analyst is the owner of semantic/product correctness.

The Business Analyst may use internal specialized skills/sub-agents for research, catalog taxonomy, psychology, market analysis or other deep tasks, while remaining accountable for the final requirements.

### 3. UX/UI Agent
Responsibilities:
- receives the UX/UI specification from the Business Analyst;
- designs information architecture at UI level, screens, navigation, states and interactions within the approved product architecture;
- creates the visual direction and design system implementation;
- produces or prepares all visual assets needed by the prototype;
- selects/generates/edits images according to the Business Analyst's requirements and the brand context;
- assigns images to the correct UI blocks/groups/subgroups;
- ensures responsive and mobile-first quality;
- returns a draft result/artifacts to the Business Analyst for acceptance.

Important: `Assets` is NOT a separate top-level agent role. Asset production is a UX/UI responsibility/sub-process.

### 4. Frontend Agent
Responsibilities:
- receives the Frontend specification plus approved UX/UI artifacts;
- implements the interface and frontend logic;
- connects approved demo/read-only providers for PROTOTYPE mode;
- preserves client-specific architecture;
- returns the implementation to the Business Analyst for acceptance.

### 5. Backend Agent
Responsibilities:
- receives the Backend specification;
- implements only the backend scope required by the selected mode;
- in PROTOTYPE mode uses demo/local/read-only behavior where required and avoids real external side effects;
- in FULL_DEVELOPMENT mode later implements production persistence/integrations as specified;
- returns its implementation to the Business Analyst for acceptance.

Backend is optional in PROTOTYPE mode when the Business Analyst determines that frontend/demo state is sufficient.

### 6. Independent QA Agent
Independent role retained intentionally.

Responsibilities:
- receives the assembled product after Business Analyst acceptance;
- verifies the final product independently against requirements, UX rules, quality contracts and release criteria;
- checks functional, visual, mobile, responsive, catalog, data-truth and integration behavior;
- verifies PROTOTYPE side-effect restrictions;
- reports defects by severity and identifies the responsible area;
- sends failures back through the Orchestrator to the responsible role;
- cannot approve its own implementation because it does not implement product features.

Difference from Orchestrator:
- Orchestrator manages workflow and stage state;
- Independent QA performs specialist quality inspection of the assembled result.

### 7. Deploy/Publisher function
This may be implemented as an Orchestrator tool or a small dedicated worker later.

Responsibilities:
- build;
- deploy to Cloudflare;
- verify deployed URL;
- run production smoke checks;
- save release metadata.

No separate top-level Publisher agent is required for v1 unless implementation complexity justifies it.

## Interaction model

Workers do not manage the process directly.

Primary flow:

```text
User -> Orchestrator -> Business Analyst
Business Analyst -> professional specs
Orchestrator -> UX/UI + Frontend + Backend in parallel where dependencies allow
Workers -> results -> Business Analyst acceptance
Business Analyst FAIL -> Orchestrator -> responsible worker revision
Business Analyst PASS -> Independent QA
QA FAIL -> Orchestrator -> responsible worker revision -> BA acceptance if semantic scope changed -> QA again
QA PASS -> Orchestrator -> deploy -> smoke -> done
```

Parallelism rule:
- UX/UI, Frontend and Backend may begin in parallel from their own specifications when inputs are sufficient;
- dependent work must consume versioned artifacts rather than informal chat summaries;
- Frontend must consume approved/current UX contracts when visual implementation depends on them.

## Artifact-based communication

Do not pass the whole history as one giant prompt between roles.

Each role must exchange structured artifacts, for example:

```text
/workspace/<client>/
  00-intake/
    request.json
  01-research/
    facts.json
    provenance.json
    data-quality.json
  02-analysis/
    business-analysis.json
    product-blueprint.json
    user-journeys.json
    capability-map.json
    catalog-taxonomy.json        # when relevant
  03-specs/
    ux-ui-spec.json
    frontend-spec.json
    backend-spec.json
    acceptance-criteria.json
  04-design/
    screen-spec.json
    design-system.json
    image-plan.json
    assets/
  05-app/
    frontend/
    backend/
  06-acceptance/
    ba-review.json
  07-qa/
    qa-report.json
  08-release/
    release.json
```

Schemas and exact filenames may evolve, but the separation of concerns must remain.

## Gates / state machine

```text
INTAKE
  -> RESEARCH
  -> BUSINESS_ANALYSIS_AND_PRODUCT_ARCHITECTURE
  -> REQUIREMENTS_READY
  -> UX_UI / FRONTEND / BACKEND
  -> BA_ACCEPTANCE
  -> INDEPENDENT_QA
  -> DEPLOY
  -> POST_DEPLOY_SMOKE
  -> PROTOTYPE_READY
```

Every stage has PASS/FAIL criteria.

Failures must return to the responsible stage and be rechecked.

## Catalog rule

For businesses with catalogs, price lists, services, products or inventory structures:
- raw external CRM/catalog structure is input evidence;
- the Business Analyst must analyze customer-facing information architecture;
- specialists, locations or technical CRM categories cannot automatically define UI hierarchy;
- the catalog should be normalized for user comprehension;
- images belong to meaningful categories/groups/subgroups according to UX requirements, not automatically to every lowest-level item;
- exact service/product-to-specialist/location relations remain separate data relations.

## Prototype AI consultant

The prototype may include an AI consultant similar in experience to AVE when useful for the business.

In PROTOTYPE mode:
- AI can read approved prototype/catalog/business context;
- AI can recommend existing real catalog items;
- AI cannot claim that a real booking/payment/message was completed unless an actual approved integration performed it;
- handoff actions must respect demo restrictions.

## What Codex should build first

Do not begin by rebuilding EVO.

First milestone:
1. preserve current `clinic_template` as the Full Development reference/baseline;
2. create the factory-agent foundation;
3. implement `PROTOTYPE` mode only;
4. implement the Orchestrator + Lead Business Analyst + UX/UI + Frontend + optional Backend + Independent QA roles;
5. implement artifact contracts and stage gates;
6. implement one end-to-end command such as `make_prototype(client_input)`;
7. use EVO as the first end-to-end evaluation case only after the factory skeleton is runnable;
8. prove that the result reaches a deployed Cloudflare URL and passes QA.

## V1 success criterion

A user should eventually be able to provide a business/company and say:

`Сделай прототип.`

The system must autonomously research the client, define a client-specific product architecture, create professional role-specific specifications, build the prototype, independently QA it, deploy it to Cloudflare and return the working URL, while respecting all PROTOTYPE restrictions.
