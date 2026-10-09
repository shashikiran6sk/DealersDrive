# Dashboard metrics

`DashboardMetrics` renders exactly four primary metrics, in a two-column grid
below 1024px and a four-column row above it. Equal grid rows stretch each card;
values and reporting-window text can wrap at narrow widths.

| Metric          | Existing payload source            | Display                                          |
| --------------- | ---------------------------------- | ------------------------------------------------ |
| Active listings | `stats[key=activeListings]`        | API `valueLabel`, label and delta                |
| Pending review  | `listingStats[key=PENDING_REVIEW]` | Existing integer count, label and inventory link |
| New enquiries   | `stats[key=newEnquiries]`          | API `valueLabel`, label and delta                |
| Vehicle views   | `stats[key=views]`                 | API `valueLabel`, label and delta                |

The component preserves the API's reporting periods; it does no metric
arithmetic. Credits and the duplicate listing-status summary are omitted from
the dashboard only. Inventory states, filters, status chips, billing, credits,
chart totals and recent enquiries keep their existing data and behavior.

The dashboard route loading state uses the same four-cell grid with skeletons.
Missing fields display `Unavailable`, never a fabricated zero. The existing
route error boundary still handles failed dashboard requests. Sandbox stories
cover ordinary values, long formatted values, loading and unavailable data.
