# Visual Audit & Art Direction stage

This stage runs after client research and before final UI asset production.

## Factory sequence

1. Research / source collection
2. Visual Audit & Art Direction
3. Client Passport normalization
4. Asset Production
5. Mini App / Landing final UI build

## Source policy

Client website, social accounts, maps, booking systems and owner-provided files are sources. They are not automatically treated as the product design system.

Preserve strong brand anchors such as the official logo, verified colors and distinctive brand elements. Evaluate every visual source independently for authenticity, quality, rights, crop suitability and consistency with the target positioning.

## Decision vocabulary

Each reviewed asset receives exactly one decision:

- `USE`: production-ready as supplied.
- `EDIT`: authentic/useful asset that requires crop, color, exposure, cleanup or format normalization.
- `GENERATE`: create a new non-evidentiary visual under the approved art direction.
- `REFERENCE`: useful for understanding the client, category or style, but not approved for direct production use.
- `REJECT`: exclude from the product.

## Evidence rules

- Generated imagery must never be presented as a real client result, before/after proof, branch interior or a named specialist.
- Named specialists use real portraits. Editing may preserve identity while normalizing crop and color.
- Real portfolio/results should preserve material outcome and texture. Do not retouch them into a materially different result.
- Customer-uploaded map/social images require separate rights and quality review before direct use.

## Client Passport documents

- `visualDirection`: brand anchors, source assessment, art direction, photography rules, consistency rules and final-UI gate.
- `assetAudit`: source-by-source decisions plus the concrete asset production queue.

The reusable template contains both documents. New clients copied from the template therefore enter the factory with the visual stage explicitly pending.

## Gates

`npm run validate:visual -- <passport>` validates that the visual audit is complete.

`npm run build:client:final -- <passport>` additionally requires all production outputs to be marked `readiness: ready` and `visualDirection.gate.assetProductionComplete: true`.

Prototype/data builds remain possible for legacy clients that predate the visual-stage documents. Final UI builds require the visual documents.
