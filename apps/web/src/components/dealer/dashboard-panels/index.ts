/**
 * DESIGN-SPEC §3.12 — the dashboard's two panels (**F048**).
 *
 * The baseline declares both as private functions inside
 * `app/(dealer)/dealer/page.tsx`. They are their own files here because a
 * component that exists only inside a feature implementation, with no sandbox
 * entry, is not done (CLAUDE.md §6) — and a component cannot have a sandbox
 * entry if it cannot be imported.
 */
export { RECENT_ENQUIRIES_SHOWN, RECENT_ENQUIRIES_TEXT } from './dashboard-panels.constants';
export { RecentEnquiries } from './recent-enquiries';
export { ViewsChart } from './views-chart';
