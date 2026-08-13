# clinic_template

Universal Mini App and client-data template based on the AVE Clinic architecture.

## Client passport

Each client has one editable source of truth:

`clients/<slug>/passport.json`

The passport contains brand, contacts, locations, manual content, specialists, integrations and `dataSources` routing. External systems such as Altegio are optional providers.

## Create a client prototype

1. Copy `clients/_template/passport.json` to `clients/<client-slug>/passport.json`.
2. Fill the brand passport manually or through an intake automation.
3. If an external source exists, configure it in `passport.dataSources` and `catalog.imports`.
4. Run any required source adapter, for example Altegio sync.
5. Build the client:

```bash
npm run build:client -- clients/<client-slug>/passport.json
```

The build produces:

- `clients/<slug>/clinic.generated.json` for the existing Mini App generator;
- `public/client-data.json` as the shared product-neutral runtime for Mini App, Landing, AI, CRM/admin and analytics adapters.

Manual catalog and specialist data remain available inside the same passport, so a client does not need Altegio or another CRM.

Secrets belong only in environment variables. Never commit Telegram bot tokens, OpenAI keys, Cloudflare API tokens or other credentials.

See `docs/CLIENT_PIPELINE.md` and `docs/DATA_SOURCES.md`.
