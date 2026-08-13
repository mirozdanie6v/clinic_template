# Data source routing

Every client uses the same normalized product contract. External systems are optional providers, not template dependencies.

## Routing file

Until `dataSources` is embedded into every existing `passport.json`, the builder reads `clients/<slug>/data-sources.json`. If a passport already contains `dataSources`, that embedded block has priority.

Example without CRM:

```json
{
  "catalog": {"primary": "manual", "fallback": "manual", "required": true},
  "specialists": {"primary": "manual", "fallback": "manual", "required": true},
  "booking": {"primary": "internal", "fallback": "contact", "required": false}
}
```

Example with Altegio:

```json
{
  "catalog": {"primary": "altegio-snapshot", "fallback": "manual", "required": true},
  "specialists": {"primary": "altegio-snapshot", "fallback": "manual", "required": true},
  "booking": {"primary": "altegio", "fallback": "contact", "required": false}
}
```

## Supported routing values

Catalog and specialists: `manual`, `altegio-snapshot`. `google-sheets` and `external-api` are reserved provider names; until their adapters are added they resolve to `manual` when fallback is `manual`.

Booking: `internal`, `contact`, `altegio`, `external-api`.

## Mandatory fallback rule

Every route has a fallback. For client content the canonical safe fallback is `manual`, using `catalog.manualGroups` and `specialists.manual` from the passport. Therefore a client can be built with no external booking system at all.

## Builder

Run:

```bash
node scripts/build-client-routed.mjs clients/<slug>/passport.json
```

The builder:

1. reads the passport;
2. resolves `dataSources` from the passport or sidecar routing file;
3. loads only the selected providers;
4. falls back to manual data when an optional external provider is unavailable;
5. produces `clients/<slug>/clinic.generated.json`;
6. produces the shared `public/client-data.json` consumed by Mini App, Landing, AI and future adapters;
7. applies the generated config to the common Mini App.

No product component should know whether the original source was Altegio, manual input, a spreadsheet or another CRM. Products consume only normalized client data.
