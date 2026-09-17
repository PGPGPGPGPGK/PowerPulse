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

- `src/components` — reusable UI
- `src/features/outages` — outage/reporting domain
- `src/data` — repositories and seed data
- `src/types` — shared domain types
- `docs/PRD.md` — product requirements
- `docs/DATA_MODEL.md` — Firestore-oriented schema
- `docs/ANALYTICS.md` — pilot instrumentation

## Current status

Foundation / MVP implementation in progress.
