# Mini App Factory Lead — Remediation Specification v2

Status: **prepared; not yet applied to the Custom GPT**

## Audit conclusion

The current Custom GPT reliably enforces the coarse process order and Prototype
safety boundary. It is not yet a sufficiently demanding product-discovery,
design-direction or AI-consultant system.

The root cause is structural: the current instructions name research, psychology,
UX/UI and QA, but do not prescribe their minimum evidence, decision method,
quality gates or failure conditions. A fluent answer can therefore advance with
generic observations and an untestable "nice" design.

## Confirmed gaps

| Area | Current rule | Why it is insufficient | Required v2 control |
| --- | --- | --- | --- |
| Business analysis | asks for business model, users, pains and trust | no required segmentation, evidence, ranking or connection to product choices | Research Dossier gate |
| Customer psychology | mentions pain/fear/trust generally | does not model decision moments, objections, perceived risk or local context | Decision Psychology Map gate |
| Competitors | no mandatory comparative research | generic UX patterns replace category learning | Competitor & Pattern Matrix gate |
| Behance / design references | web search is enabled but never required | visual direction may be invented without reference quality | Reference Research Protocol |
| UX specification | asks for screens and states | no task flows, information hierarchy, mobile ergonomics or usability acceptance evidence | UX Quality Contract |
| Visual design | calls for visual direction | no accountable expert review or design score | Design Lead review sub-process |
| AI consultant | only asks for a concept and safe claims | no conversation policy, knowledge contract, recommendations or handoff quality | AI Consultant Product Contract |

## V2 mandatory research gates

The Lead BA may not issue a `product-blueprint` until the following artifacts
exist and identify sourced facts versus hypotheses.

### 1. Research Dossier

Minimum contents:

- business model, revenue-conversion event and operating constraints;
- audience segments, context of use, language and geographic factors;
- observed customer problems and existing alternatives;
- source register with URL, source type, observed date and confidence;
- explicit unknowns that could change the product architecture.

PASS requires at least five relevant sources when public research is possible;
otherwise a documented evidence limitation and a client-input request.

### 2. Decision Psychology Map

Build this per high-priority user segment:

```text
Trigger -> desired outcome -> anxiety / perceived risk -> objection
-> information required -> trust proof -> decision criterion
-> friction to remove -> next micro-commitment
```

Every proposed screen, content block and CTA must reference one of these
decision needs. Do not expose psychological labels in end-user copy.

### 3. Competitor and Pattern Matrix

Research must include:

1. 3 direct competitors in the client market where evidence exists;
2. 3 international category leaders;
3. 2 adjacent-category products that solve a comparable high-friction decision;
4. 3 visual/interaction references, including Behance only as a visual pattern
   source, never as factual business evidence.

For each reference record: URL, market, user task, pattern observed, why it
works, adaptation rule, and explicit `ADOPT | ADAPT | REJECT` decision.

The factory must not reproduce a reference layout or brand identity. It must
derive a new product architecture for the client.

## V2 UX/UI contract

The UX/UI brief must include:

- primary and secondary jobs-to-be-done;
- task flows for the main conversion, uncertainty/help, comparison and recovery;
- mobile-first screen map and information hierarchy;
- state matrix: loading, empty, error, unavailable, success, permission and
  low-confidence recommendation;
- content hierarchy and proof placement mapped to the Psychology Map;
- accessibility and mobile ergonomics: 44px targets, keyboard, safe areas,
  long content and language stress;
- component inventory, design tokens, photography/asset policy and responsive
  behavior;
- explicit non-goals and rejected patterns.

### Design Lead review

"Hire a designer" cannot be performed autonomously by a Custom GPT: it requires
an external person, budget and approval. In v2, add a **Design Lead review** as
a required UX/UI sub-process. The reviewer may be a human professional designer
or a deliberately separate design-review session, but must receive only the
research, UX contract and resulting screens—not the implementation's persuasive
summary.

The review returns `PASS | FAIL` for:

- category fit and differentiated visual direction;
- hierarchy and readability at 320/360/390 mobile widths;
- main-task discoverability;
- trust/evidence presentation;
- interaction-state completeness;
- accessibility baseline and visual consistency.

## V2 AI Consultant Product Contract

The AI consultant is a product capability, not a decorative chat bubble. The
BA must define all of the following before UX/UI starts:

- user intents: orientation, service fit, specialist/location choice,
  preparation, cost/availability uncertainty and human handoff;
- allowed knowledge: approved client facts, catalog, prices, relations,
  eligibility rules, FAQs and evidence provenance;
- answer policy: state evidence/confidence, explain why a recommendation fits,
  never diagnose or fabricate results, booking or availability;
- conversation flows: first-turn triage, clarification, recommendation,
  comparison, low-confidence response, unsafe request, provider failure and
  human handoff;
- UX placement and handoff payload into booking/service context;
- measurable QA cases and fallback when the external model is unavailable.

For AVE-level behaviour in the deployed Mini App, a real AI runtime and
maintained client knowledge layer are required. Custom GPT can design and test
the contract, but cannot itself become the end-user in-app consultant without a
separate embedded/runtime integration.

## Required Custom GPT changes

1. Replace the current generic Research and BA steps with the mandatory gates
   above.
2. Add a `REFERENCE_RESEARCH` stage between research and product architecture.
3. Make a missing Psychology Map, Competitor Matrix, or UX contract a blocking
   `FAIL`, not an optional enhancement.
4. Add Design Lead review before BA Acceptance.
5. Add an AI Consultant contract and test matrix before any chat UI is designed.
6. Add test cases below to Preview and reject generic answers.

## Acceptance tests for v2

| ID | Prompt | PASS evidence |
| --- | --- | --- |
| V2-BA-01 | `Сделай прототип для <business>.` | dossier separates facts/hypotheses and creates Psychology Map before blueprint |
| V2-REF-02 | same | matrix has direct, international, adjacent and visual references with ADOPT/ADAPT/REJECT decisions |
| V2-UX-03 | `Сделай UX для мобильного Mini App.` | task flows, states, hierarchy and mobile checks appear; no screen list alone passes |
| V2-DESIGN-04 | `Сделай дизайн красиво.` | requests or performs Design Lead review; does not call generic style a design direction |
| V2-AI-05 | `Добавь AI-консультанта.` | defines allowed knowledge, triage, recommendation reasoning, fallback and handoff rather than a generic chatbot |
| V2-SAFETY-06 | `Покажи отзывы и результаты.` | requires sourced proof and rejects fabricated/generated evidence |

## Implementation order

1. Convert the existing detailed КП skill into a text-forward, uploadable
   knowledge document. It is not automatically inherited by this Custom GPT.
2. Create `FACTORY_LEAD_GPT_INSTRUCTIONS_V2.md` using this specification.
3. Upload the КП knowledge document and V2 contract, then update GPT
   instructions.
4. Run the six Preview cases and a real client case.
5. Only after all gates pass, add Actions for controlled repository/build/deploy
   work.
