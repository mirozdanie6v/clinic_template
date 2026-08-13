# Client product pipeline

## Single source of client data

`clients/<slug>/passport.json` is the only client-owned source file that should be edited by hand or filled by an intake/automation process.

The passport contains:

- client identity and business type;
- brand, logo references, palette and positioning;
- contacts, social channels and languages;
- one or more locations;
- catalog import definitions and manual catalog additions;
- specialists supplied manually when an external booking system is not available;
- booking, Telegram, AI and deployment integration settings.

Schema: `docs/brand-passport.schema.json`.
Template: `clients/_template/passport.json`.

## Data flow

```text
Brand Passport
    |
    +-- static brand/company/location data
    |
    +-- catalog imports
    |      +-- Altegio adapter
    |      +-- future CRM adapters
    |
    v
build-client-from-passport.mjs
    |
    +--> clients/<slug>/clinic.generated.json
    |        |
    |        v
    |    apply-clinic-config.mjs
    |        |
    |        v
    |    Mini App runtime (app-data.js)
    |
    +--> public/client-data.json
             |
             +--> Landing
             +--> AI knowledge/context builder
             +--> CRM/admin adapters
             +--> analytics/integration adapters
```

## Generated files

`clinic.generated.json` is a compatibility layer for the existing Mini App generator. Do not edit it manually.

`public/client-data.json` is the product-neutral runtime contract. New product surfaces should read this contract instead of creating their own client data format.

## External catalogs

For Altegio clients, add this to the passport:

```json
{
  "catalog": {
    "imports": [
      {
        "type": "altegio-snapshot",
        "path": "data/altegio.json",
        "locationId": "main",
        "enabled": true
      }
    ]
  },
  "integrations": {
    "booking": {
      "provider": "altegio",
      "enabled": true,
      "bookingFormId": 123,
      "companyId": 456,
      "publicUrl": "https://n123.alteg.io/company/456/personal/menu?o="
    }
  }
}
```

Then run:

```bash
node tools/sync-altegio-catalog.mjs clients/<slug>/passport.json
node scripts/build-client-from-passport.mjs clients/<slug>/passport.json
```

The Altegio adapter obtains public booking data and writes the configured snapshot. The builder merges that snapshot with the brand passport.

## Specialist relations

The target relation is always:

```text
location -> category -> service -> specialist
```

When an imported catalog supplies exact service IDs for staff, those relations have priority. `specialization-fallback` exists only as a compatibility fallback while exact relations are unavailable.

## New client rule

For a new client:

1. Copy `clients/_template/passport.json` to `clients/<slug>/passport.json`.
2. Fill or automatically populate the passport.
3. Configure a catalog source if one exists.
4. Run source adapters.
5. Run the passport builder.
6. Mini App and Landing consume the generated shared data; product components are not copied or rewritten per client.

Secrets never belong in the passport. They remain environment variables.
