# Data source routing

Every client uses the same normalized product contract. External systems are optional providers, not template dependencies.

## Single source of truth

`clients/<slug>/passport.json` is the only client-owned configuration file. Data source routing is embedded in `passport.dataSources`; separate routing sidecars are obsolete.

Example without CRM:

```json
{
  "dataSources": {
    "catalog": {"primary": "manual", "fallback": "manual", "required": true},
    "specialists": {"primary": "manual", "fallback": "manual", "required": true},
    "booking": {"primary": "internal", "fallback": "contact", "required": false}
  }
}
```

Example with Altegio:

```json
{
  "dataSources": {
    "catalog": {"primary": "altegio-snapshot", "fallback": "manual", "required": true},
    "specialists": {"primary": "altegio-snapshot", "fallback": "manual", "required": true},
    "booking": {"primary": "altegio", "fallback": "contact", "required": false}
  }
}
```

## Supported routing values

Catalog and specialists: `manual`, `altegio-snapshot`. `google-sheets` and `external-api` are reserved provider names for future adapters.

Booking: `internal`, `contact`, `altegio`, `external-api`.

## Fallback rule

Manual data lives in the same passport under `catalog.manualGroups` and `specialists.manual`. A client can therefore build and run with no external booking or CRM system.

## Build

Run:

```bash
npm run build:client -- clients/<slug>/passport.json
```

The builder resolves the configured providers, normalizes all data, writes `clients/<slug>/clinic.generated.json`, writes the shared `public/client-data.json`, and applies the generated config to the common Mini App.

CI verifies the manual-only client path on every pull request. Product components never need to know whether the source was Altegio, manual input, a spreadsheet, or another CRM.
