# Mini App Factory Lead — Knowledge Manifest

Upload the following text-forward files as Custom GPT Knowledge. Instructions
belong in the GPT editor, not in Knowledge.

| Priority | File | Purpose |
| --- | --- | --- |
| Required | `docs/CODEX_AGENT_ARCHITECTURE_BRIEF.md` | authoritative product architecture and role boundaries |
| Required | `docs/factory-agent/01-runtime-contract.md` | artifacts, gates, ownership and Prototype safety policy |
| Required | `docs/miniapp-product-quality-contract.md` | QA and release quality rules |
| Required | `docs/CLIENT_PIPELINE.md` | passport and client-data pipeline |
| Required | `docs/client-strategy-pack.md` | reusable client strategy artefacts and stages |
| Required | `docs/custom-gpt/COMMERCIAL_PROPOSAL_AND_DISCOVERY_PLAYBOOK.md` | psychology, competitor, Behance-pattern and evidence rules |
| When visuals are in scope | `docs/visual-audit-stage.md` | visual/asset audit and production rules |
| When integrations are in scope | `docs/INTEGRATIONS.md` | prototype integration boundary |
| Reference only | `docs/factory-agent/02-evaluation-plan.md` | evaluation and regression cases |
| Reference only | `docs/custom-gpt/FACTORY_LEAD_REMEDIATION_SPEC.md` | audit trace and v2 quality gates |

Do not upload secrets, `.env` files, tokens, private customer data without
authorization, or large binary asset directories. The Custom GPT editor allows
a maximum of 20 Knowledge files; this set deliberately stays below that limit.

## Capabilities

Enable:

- Web search — required for sourced business research.
- Image generation — required for non-evidentiary prototype visuals where
  appropriate.
- Code Interpreter & Data Analysis — required to inspect structured source
  files and generate artifact files.

Enable **Actions only** after a dedicated, authenticated Factory Action endpoint
exists. A GPT cannot use Apps and Actions simultaneously; choose one integration
model deliberately. For v1, leave Actions disabled and do not represent
repository writes or deployment as available capabilities.
