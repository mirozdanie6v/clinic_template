# EVO Mini App — Product QA baseline

Date: 2026-08-15
Contract: Mini App Product Quality Contract v1

## Current release-critical status

### Already hardened / regression-protected
- iOS/WebView text input uses 16px mobile control sizing.
- Controlled form screens are kept stable across keystrokes to prevent focus remount/jump.
- Bottom navigation is hidden while a text field has focus so it cannot collide with the software keyboard.
- Booking actions are forced into normal mobile document flow so they cannot cover Altegio CTAs.
- Main app shell receives a vertical-reachability override (`overflow-y: visible`).
- Mobile compact actions receive a 44px touch-target floor.
- Small editorial text receives a readability floor through the universal product-quality CSS layer.
- AI visibility and external backend availability are separate states (`visible` / `enabled`).
- Exact EVO service↔specialist relations remain branch-qualified.

## Current client QA scope
- 3 locations.
- 512 branch service records.
- 30 staff records.
- 813 exact service↔staff relations.
- RU / EN / VI.
- Altegio booking with official-form fallback when Partner Token is unavailable.
- AI visible with local-catalog fallback while external model integration is disabled.

## Functional upgrade backlog for Product Parity
These are product-capability gaps to resolve in the universal template before AVE-level parity is declared.

### P1 parity targets
1. **Patient profile lifecycle**
   - editable name / phone / Telegram / email / preferred contact;
   - safe merge with Telegram identity;
   - persistent profile state.

2. **Appointment lifecycle**
   - multiple upcoming appointments;
   - server sync;
   - edit/reschedule when provider permits;
   - cancel when provider permits;
   - provider-safe fallback when direct change/cancel is unavailable.

3. **Telegram identity and confirmations**
   - full identity bridge;
   - booking confirmation after confirmed booking;
   - deduplication;
   - admin notification when configured.

4. **Admin / CRM core**
   - bookings/leads list;
   - patients;
   - dialogs;
   - branch filtering for CENTER/NORTH/SAIGON;
   - real adapter-backed states instead of hardcoded demo metrics.

5. **AI booking / human handoff**
   - service recommendation → booking context;
   - guard against false booking-success language;
   - optional administrator takeover / return to AI.

### P2 parity targets
6. Broadcasts.
7. Reminders.
8. Admin AI Copilot.
9. Funnel/source analytics.
10. Expanded patient notes/details.

## Runtime acceptance still required
The following cannot be considered passed from build CI alone:
- Android Chrome at 320/360/390/430 widths;
- iPhone Safari;
- Telegram Android WebView;
- Telegram iPhone WebView;
- software keyboard with AI and booking fields;
- long RU/EN/VI strings;
- branch switching during booking;
- provider fallback/error/retry states;
- browser environment without Telegram;
- post-deploy critical journey.

## Current external dependency
`ALTEGIO_PARTNER_TOKEN` is not configured in GitHub Actions. Official Altegio form fallback remains the required production path until the token is provisioned and direct booking runtime acceptance passes.

## Release interpretation
The current build can pass machine quality rules and visual gate. AVE-level functional parity remains a separate Product Parity program. Stage 3.4 should be repeated after each parity capability is added, and every discovered production defect must enter the regression catalogue.
