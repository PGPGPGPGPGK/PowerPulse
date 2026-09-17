# PowerPulse MVP PRD

## Problem

During electricity interruptions, residents often cannot quickly tell whether the issue is limited to their home/building or affects the surrounding area. Existing community discussions are unstructured and disappear quickly.

## Product hypothesis

If reporting an outage takes one tap and nearby community reports are immediately visible, residents will contribute enough signals to make local outage status useful.

## Primary user

A Hyderabad resident currently experiencing an unexpected loss of electricity.

## Core job to be done

When my electricity goes out, help me quickly understand whether other people around my area are experiencing the same problem.

## V1 scope

### Required
- Mobile-first web application / PWA
- Area selection
- One-tap outage report
- Current area status
- Report count
- Still-out confirmation
- Restoration report
- Recent nearby incidents
- Anonymous or lightweight authentication
- Timestamp every contribution
- Abuse/rate-limit strategy
- Product analytics
- Explicit community-data disclaimer

### Privacy
- Never display exact user coordinates publicly.
- Store only the precision required to group reports.
- Public presentation is area/grid level.
- Location permission must have a clear purpose and fallback to manual area selection.

### Incident state
- `possible`: initial independent report(s)
- `confirmed`: threshold of independent recent reports reached
- `restoring`: restoration signals arriving while outage signals remain
- `restored`: restoration threshold/time rule reached

Thresholds are product parameters and must be tuned during the pilot rather than presented as official utility truth.

## Out of scope for V1
- AI predictions
- Utility-provider integrations
- Exact outage cause
- Exact restoration estimates
- Native Android/iOS apps
- Payments
- City-wide reliability rankings presented as authoritative statistics

## Pilot

Duration: 14 days
Target: 30 testers
Coverage: at least 5 Hyderabad neighbourhoods

## Success metrics

- Number of unique reporters
- Number of neighbourhoods with reports
- Median time from first report to second independent confirmation
- Percentage of initial reports receiving an independent confirmation
- Percentage of incidents receiving a restoration signal
- Weekly returning users
- Duplicate/invalid report rate
- Tester qualitative feedback

## V2 candidates

- Map visualization
- Push notifications
- Follow/home areas
- Historical community outage charts
- Better geospatial clustering
- Trusted/verified data integrations where available
