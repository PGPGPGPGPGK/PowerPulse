# Pilot analytics

## Core events

- `app_opened`
- `area_selected`
- `outage_reported`
- `still_out_confirmed`
- `restoration_reported`
- `incident_viewed`
- `notification_opt_in` (V2)
- `feedback_started`
- `feedback_submitted`

## Event properties

Use non-identifying properties where possible:

- `area_id`
- `incident_status`
- `report_count_bucket`
- `entry_point`
- `app_version`

Do not send exact GPS coordinates to analytics.

## Pilot dashboard questions

1. Are testers actually reporting outages when they happen?
2. Do reports receive independent confirmations?
3. How quickly?
4. Do users return after their first report?
5. Are restoration reports being submitted?
6. Which parts of the reporting flow cause abandonment?
