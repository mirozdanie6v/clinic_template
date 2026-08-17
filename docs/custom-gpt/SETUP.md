# Mini App Factory Lead — Custom GPT Setup

## Configuration

1. In an eligible ChatGPT workspace, open the GPT editor and choose
   **Configuration view**.
2. Name: **Mini App Factory Lead**.
3. Description: **Создаёт проверяемые Mini App-прототипы: от исследования и
   продуктовой архитектуры до UX/UI, QA и безопасного release handoff.**
4. Copy the complete contents of `FACTORY_LEAD_GPT_INSTRUCTIONS.md` into
   **Instructions**.
5. Upload the files listed in `KNOWLEDGE_MANIFEST.md`.
6. Enable the three listed capabilities. Do not configure Actions yet.
7. Add these conversation starters:
   - `Сделай прототип для клиники эстетической медицины в Бангкоке.`
   - `Проведи только Intake и Product Architecture для этого бизнеса.`
   - `Проверь готовность текущего прототипа к BA Acceptance.`
   - `Сформируй Independent QA checklist для этого Mini App.`
8. Run all Preview cases from `TEST_SCRIPT.md`; correct Instructions before
   creating or updating the GPT.

## Status boundary

After this setup, the GPT is able to operate as a guided Factory Lead inside a
ChatGPT conversation. It has no deployment, Git write or background-run
capability until an external Action endpoint is intentionally implemented and
configured.

## Action phase — deferred

The future Action service must expose only narrow operations such as create run,
store artifact, validate gate, create a draft commit, build preview and run
smoke checks. It must require authentication, keep secrets server-side and
separate draft/preview from production. It must not expose raw shell access or
generic file-write endpoints to the GPT.
