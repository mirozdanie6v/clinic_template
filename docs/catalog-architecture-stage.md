# Catalog Architecture & Taxonomy Normalization

This stage is blocking and runs after raw catalog extraction / Client Passport normalization and before product assembly, messaging-driven presentation, asset binding and UI rendering.

## Contract

The public catalog hierarchy is always:

`direction -> subgroup -> service`

Specialists never define catalog hierarchy. Exact relations are preserved separately as:

`service <-> specialist <-> location`

Raw CRM / booking-provider categories may not render directly in the customer UI.

## Required output

Every client supplies `data-pack/catalog-taxonomy.json` with:

- curated customer-facing directions;
- curated subgroups;
- explicit mapping from raw source categories to subgroups;
- explicit exclusions for technical/test categories;
- localized titles;
- one visual asset owned by each visible subgroup;
- direction-level visual assets;
- strict coverage policy.

## Image ownership

Images belong to directions and subgroups. Individual price-list services inherit their subgroup visual only when a detail surface needs imagery; a service does not own a separate navigation image.

Visible subgroup images must be unique. A single image may not be reused as the primary image of multiple visible subgroups.

## Release rules

The build is blocked when:

- any raw category is unmapped while strict coverage is enabled;
- one raw category maps to multiple subgroups;
- specialists are used to split groups;
- a visible subgroup has no image;
- two visible subgroups own the same primary image;
- raw provider structure is rendered directly.

The raw catalog remains preserved as source truth for IDs, prices, duration, availability and exact specialist relations.
