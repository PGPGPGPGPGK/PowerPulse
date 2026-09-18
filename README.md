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
- Firebase Anonymous Authentication
- Cloud Firestore (Spark plan)
- MapLibre GL JS over OpenStreetMap tiles from OpenFreeMap
- GitHub Pages for hosting, GitHub Actions for deployment
- Firebase Cloud Messaging (post-MVP notification work)

## Repository structure

- `src/components` — reusable UI (header, nav, status/official/community cards)
- `src/features/outages` — outage domain: screens, incident derivation, context
- `src/features/location` — the user's own location and permission handling
- `src/features/map` — MapLibre integration and its public-only GeoJSON layers
- `src/services` — repository boundary (interface, mock and Firestore implementations)
- `src/data` — demo data and the pilot locality list, reached through the repository
- `src/types/outage.ts` — raw input, derived, official and display models
- `firestore.rules` — security rules to publish to your own project
- `.github/workflows/deploy-pages.yml` — build and publish to GitHub Pages
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

## Firebase

Community reports are shared between devices through Cloud Firestore, with
anonymous Firebase Authentication. No official sources, no notifications, no
analytics, no Cloud Functions. Everything fits inside the Spark (free) plan.

### Set up your own project

PowerPulse ships with no project configuration, so a clone is yours to point at
your own Firebase project. You never need anyone else's values.

1. Create a Firebase project (Spark plan is enough).
2. Authentication → Sign-in method → enable **Anonymous**.
3. Firestore Database → create one (Production mode; pick the region closest to
   your pilot).
4. Publish the rules in `firestore.rules`, from the Firestore console's Rules
   tab or with `npx firebase-tools deploy --only firestore:rules`. If you use
   the CLI, set your own project id in `.firebaserc`.
5. Copy `.env.example` to `.env.local` and fill in the web config from
   Project settings → General → Your apps → SDK setup and configuration.
   `.env.local` is git-ignored and must stay that way.
6. `npm run dev`. Without those values the app runs on demo data instead, and
   the banner says which source is live.
7. Optional: change the pilot localities in `src/data/areas.ts`, and the
   clustering parameters at the top of
   `src/features/outages/deriveIncidents.ts`.

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

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds the site and publishes it with the
official GitHub Pages actions on every push to `main`, or on demand from the
Actions tab. Nothing is stored on a server you pay for: Pages hosts the static
files and Firebase serves the data.

The Firebase web config is *build-time* configuration, so the workflow injects
it. It is public runtime configuration rather than a server secret, so it goes
in repository **Variables**, not Secrets.

1. Settings → Pages → **Source: GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** tab → New
   repository variable, once per row:

   | Variable | Where to find it |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | Firebase → Project settings → Your apps |
   | `VITE_FIREBASE_AUTH_DOMAIN` | same |
   | `VITE_FIREBASE_PROJECT_ID` | same |
   | `VITE_FIREBASE_STORAGE_BUCKET` | same |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
   | `VITE_FIREBASE_APP_ID` | same |
   | `VITE_MAP_STYLE_URL` | optional, defaults to OpenFreeMap |
   | `VITE_BASE_PATH` | optional, only if your repository is not named `PowerPulse` (e.g. `/my-fork/`) |

   The build fails early with a clear message if the required ones are missing,
   rather than quietly publishing a demo-data site.
3. Firebase console → Authentication → Settings → Authorized domains → add
   `<your-user>.github.io`.
4. Push to `main`, or run the workflow manually. The site appears at
   `https://<your-user>.github.io/<repository>/`.

### Base path

GitHub project Pages serve from `https://<user>.github.io/<repository>/`, so a
production build has to know that prefix.

- This repository **defaults to `/PowerPulse/`**, set in `vite.config.ts`.
- A fork or deployment under **another repository name must set the
  `VITE_BASE_PATH` repository variable to `/<repository-name>/`** — including
  both slashes, for example `/hyderabad-outages/`. The workflow passes it to the
  build, which uses it in place of the default.
- **Local development is unaffected and continues to serve from `/`**: the base
  path is applied to `npm run build` only, never to `npm run dev`.

### Quality gates

The workflow runs `npm run lint` and `npm run check` before `npm run build`, and
verifies the required Firebase variables are present. A deployment does not
proceed if any of those fail.

No production configuration is committed to this repository: `.env.example`
carries placeholder names only, and the workflow references repository variables
rather than values.

## Map

Real interactive map via MapLibre GL JS, loaded only when the map screen opens
so it never delays the home screen. Tiles come from
[OpenFreeMap](https://openfreemap.org): OpenStreetMap-derived vector tiles with
no API key and no usage limit. Set `VITE_MAP_STYLE_URL` to use a different
MapLibre style.

The map draws incident centres, their approximate cluster extent and aggregate
counts - never individual report positions. The viewer's own marker is rendered
in that browser alone. Attribution to OpenStreetMap contributors is supplied
explicitly, since the style does not declare it. If the map or its tiles fail to
load, the incident list below it still works.

### Third-party requests

The interactive map loads map resources from OpenFreeMap and its CDN. This
creates network requests to that third-party service. OpenFreeMap's published
privacy policy states that IP addresses are not stored in its regular server
logs, although infrastructure providers such as Cloudflare may process request
information and temporary IP logging may be enabled during security incidents.

No PowerPulse report data is sent to the tile provider: tile requests carry only
the map area being viewed.

## Current status

Working pilot prototype: shared realtime community reports through Firestore,
anonymous sign-in, geographic incident clustering, an interactive map, and
GitHub Pages deployment.

Not connected yet: official/government sources, notifications, analytics. The
official information cards are clearly labelled demo content and appear only in
the demo data source.

Without Firebase configuration the app runs entirely on demo data, and the demo
states (clear, possible, community-confirmed, possible restoration, restored,
scheduled official information, official + community reports) can be switched
from **Profile → Developer / demo controls**.
