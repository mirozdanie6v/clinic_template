# Mini App Product Quality Contract v1

Mandatory for every client assembled from `clinic_template`.

## Factory stages

### 0.3 — Product / Capability Contract
Before implementation declare enabled/visible capabilities, required screens and journeys, booking provider/fallbacks, languages, locations/catalog scale, integrations and QA profile.

Output: client quality scope. Every visible capability must have expected states, fallback and test path.

### 3.4 — Product QA & UX Hardening — BLOCKING
Run after data integration, capability assembly, Asset Production and final visual UI assembly.

Audit the assembled Mini App as one product:
1. layout integrity;
2. mobile / safe-area / keyboard behaviour;
3. forms and focus;
4. navigation and back behaviour;
5. touch targets and readability;
6. loading / empty / error / disabled / success states;
7. long-content and localization stress;
8. capability interactions;
9. booking lifecycle;
10. Telegram identity/notifications when enabled;
11. AI visible/enabled/disabled states;
12. branch/location scoping;
13. data truth and unmapped records;
14. accessibility baseline;
15. visual consistency;
16. regression catalogue.

Output: QA report, 0 P0/P1 defects and approved release candidate.

### 4.1 — Runtime Acceptance — BLOCKING
Run on staging in environments CI cannot faithfully emulate: Android Chrome, iPhone Safari, Telegram WebView Android/iPhone and desktop smoke.

Validate real viewport/browser chrome, software keyboard, safe areas, external links, Telegram session, booking provider fallback/direct API and production assets.

### 4.2 — Production release
Allowed after 3.4 and 4.1 pass.

### 4.3 — Post-deploy smoke
Repeat critical journey on production: open → navigate → location → service → specialist → booking handoff/create → profile/session → AI when visible.

## Severity
- **P0** blocks main journey, data integrity or release.
- **P1** serious UX/function defect: overlap, inaccessible CTA, lost input focus, clipped critical content, wrong relation.
- **P2** visible quality defect with workaround.
- **P3** polish.

Release rule: **0 P0, 0 P1**. P2 requires an explicit accepted exception.

## Mandatory assembly rules

### Layout
- Interactive controls cannot cover controls or essential content.
- Persistent navigation reserves content space and respects safe-area insets.
- Sticky/fixed elements require collision tests with keyboard, modals and final CTAs.
- Main content may hide horizontal overflow; vertical content remains reachable.
- Minimum supported mobile viewport: 320 CSS px unless Client Passport explicitly overrides it.
- Long names, labels, prices and translations wrap or truncate intentionally.

### Touch and controls
- Primary mobile targets: minimum 44×44 CSS px.
- Form controls: minimum 44 px high; text inputs use at least 16 px on mobile.
- Disabled state is visible and blocks action.
- Irreversible actions have confirmation or recovery.

### Keyboard / focus
- Typing never remounts the active form screen.
- Focus remains stable during controlled updates.
- Keyboard cannot hide focused field or required CTA.
- Persistent bottom navigation cannot ride above the keyboard and cover forms.
- Phone input stays LTR in RU/EN/VI.
- IME/composition input remains supported.

### Navigation
- Every inner screen has deterministic exit/back behaviour.
- Browser back, app back and modal close cannot trap the user.
- Active nav state matches visible screen.
- Hidden capabilities leave no dead nav entries.

### Content / localization
- RU/EN/VI stress test uses realistic long strings.
- Essential labels cannot depend on text below 10 px; routine secondary copy targets 11–12 px or larger.
- Prices, addresses, branch and specialist names preserve source truth.
- Missing content uses designed fallback. Fabricated people, reviews, results or availability are prohibited.

### Images
- UI uses only Asset Matrix-approved assets.
- Generated imagery cannot impersonate a real specialist, result, branch interior or review.
- Crop/aspect/treatment follow Visual Direction.
- Missing portraits follow declared placeholder policy.

### Booking
- Exact service → specialist relations stay exact when the source provides them.
- Branch/location persists through the journey.
- External fallback remains usable when direct API credentials are absent.
- Loading, unavailable, API error and retry states are visible.
- Success language appears only after confirmed success from the responsible system.
- Duplicate submit/notification is prevented.

### AI
- `visible` controls UI presence; `enabled` controls external model availability.
- Visible AI has an intentional fallback.
- Recommendations reference real catalog items.
- AI cannot claim booking success before booking confirmation.
- Human/admin handoff is tested when enabled.

### Telegram
- Telegram features degrade safely in a normal browser.
- Session identity cannot unexpectedly overwrite explicit user edits.
- Notifications fire only after confirmed event and are deduplicated.

### Async states
Every async feature defines loading, success, empty/unavailable, recoverable error and fallback/non-recoverable state.

### Accessibility baseline
- Semantic buttons/links/inputs.
- Visible keyboard focus.
- Essential meaning does not rely only on color.
- Meaningful images have appropriate labels/text context.

## Stress matrix

### Viewports
- 320×568
- 360×800
- 390×844
- 430×932
- tablet 768+

### Data/capability conditions
- one / multiple locations;
- one / 500+ services;
- one / many specialists;
- long specialist/service names;
- missing portrait;
- service without exact staff relation;
- booking direct / fallback / error;
- AI visible+enabled / visible+disabled / hidden;
- Telegram present / ordinary browser;
- empty / populated profile and appointments.

## Regression catalogue
Every fixed production defect must become a regression entry and automated test/rule where practical. Initial mandatory regressions:
- iOS/WebView input auto-zoom;
- controlled input focus loss/screen remount;
- reversed caret/text behaviour on iPhone;
- keyboard covering form content;
- booking controls covering Altegio CTAs;
- bottom navigation colliding with keyboard;
- capability visibility accidentally removing a prototype feature.

## Release artefacts
Each client release produces quality scope, machine validation result, visual/function checklist, accepted exceptions, runtime acceptance result and deployed commit/version reference.
