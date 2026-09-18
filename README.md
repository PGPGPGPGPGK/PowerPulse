# PowerPulse

**Community-powered electricity outage reporting for Hyderabad.**

PowerPulse answers one immediate question:

> Is the power out only for me, or is everyone around me affected?

## MVP

A mobile-first PWA where residents can:

- Select their Hyderabad area
- Report an outage in one tap
- See recent nearby community reports
- Confirm that an outage is still active
- Report that power has been restored
- See clearly labelled community-reported incident status

PowerPulse is **not an official utility outage source**. All incident information is community reported.

## MVP principles

1. Reporting must take seconds.
2. Never expose a user's exact location publicly.
3. One report is a signal; multiple independent reports provide stronger confirmation.
4. Clearly distinguish community reports from authoritative utility information.
5. Start narrow, measure real usage, then expand.

## Initial pilot

- City: Hyderabad, Telangana, India
- Target: 30 initial testers
- Coverage goal: 5+ neighbourhoods
- Pilot duration: 14 days

## Stack

- React + TypeScript + Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Messaging (post-MVP notification work)
- PWA
- Map layer planned after the core reporting loop is validated

## Repository structure

- `src/components` — reusable UI (header, nav, status/official/community cards, map)
- `src/features/outages` — outage domain: screens, incident derivation, context
- `src/services` — repository boundary (`outageRepository` interface + mock implementation)
- `src/data` — demo data and static area list, reached only through the repository
- `src/types/outage.ts` — raw input, derived, official and display models
- `docs/PRD.md` — product requirements
- `docs/DATA_MODEL.md` — Firestore-oriented schema
- `docs/ANALYTICS.md` — pilot instrumentation

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
npm run check    # self-check for the incident derivation rules
```

## Firebase (Phase 1)

Community reports are shared between devices through Cloud Firestore, with
anonymous Firebase Authentication. Nothing else is connected: no official
sources, no maps, no notifications, no analytics, no Cloud Functions. Runs
within the Spark (free) plan.

1. Copy `.env.example` to `.env.local` and fill in the web config from
   Firebase console → Project settings → General → Your apps.
2. Publish the rules in `firestore.rules`, either from the Firestore console
   (Rules tab) or with `npx firebase-tools deploy --only firestore:rules`.
3. `npm run dev`. Without the environment variables the app falls back to the
   demo repository, and the banner says which source is live.

Collections: `reports` only (append-only observations). Incidents are still
derived on the client from those reports, by geographic proximity alone.

Location: browser geolocation is requested only when the user taps *Use my
location*, and a manually selected pilot locality is always available as a
fallback. Manual positions are labelled approximate and never presented as a
device fix.

Privacy: a precise device position never leaves the browser. Before a report is
created it is snapped to a 3-decimal-degree grid (about 111 x 106 m at this
latitude), and that approximate point is the only coordinate stored. Device
accuracy is shown to its owner and never persisted. Reports are readable by any
signed-in client, which is exactly why nothing precise is written into them.

Hosting stays on GitHub Pages; the Firebase config is build-time configuration,
so a Pages build needs the same variables supplied at build time.

## Current status

Clickable frontend prototype running on **demo data only**. No Firebase, no
authentication, no geolocation, no notifications, no official or government
source is connected. Every simulated outage and official entry is labelled as
demo data in the UI.

Demo states (clear, possible, community-confirmed, possible restoration,
restored, scheduled official information, official + community reports) can be
switched from **Profile → Demo states**.
