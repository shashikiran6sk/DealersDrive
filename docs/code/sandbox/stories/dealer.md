# sandbox / stories/dealer

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/dealer/console-nav.stories.tsx`

### `const meta =`

DESIGN-SPEC §3.11 — the dealer console's sidebar nav (C025).

**The pathname is half the component.** `ConsoleNav` takes its items as a
prop but reads `usePathname()` to decide which of them is current, so a story
that does not set `nextjs.navigation.pathname` is showing exactly one of its
states. That is why this file has one story per route rather than one story
with a knob.

The rule is not "starts with", uniformly. `/dealer` is a prefix of every
console path, so Dashboard would be current on every screen; it matches
exactly and the rest match by prefix — which is what keeps Inventory lit on
`/dealer/inventory/{id}`.

The rows are `.dd-nav-item`, the shared class, on the white sidebar it was
tuned for. `AdminNav` styles itself with utilities instead precisely because
these colours are wrong on cobalt-900 — see its own story.

## Two lists, and why the shell renders the shorter one

`DEALER_NAV` is the baseline's six items and is what this component is _for_.
`LANDED_NAV` is the subset whose routes exist today — Dashboard and Dealer
profile, since **F048**. The shell renders `LANDED_NAV` because a nav item
onto a 404 is the console telling a dealer a page exists and then not having
it, and each of F050, F051, F056 and F065 deletes its own line from the set
as it lands.

`Full` is the component as it will be. `AsTheConsoleRendersItToday` is what a
dealer actually sees, and the gap between the two stories is the
reconstruction, drawn.

### `export const Full: Story = {}`

The landing page. Dashboard is current by an exact match, not a prefix one.

### `export const EditingAVehicle: Story =`

A car being edited. Inventory stays current — the prefix match is what keeps
a nav from going blank the moment you open a record, which is exactly when a
dealer most wants to know where they are.

### `export const NothingCurrent: Story =`

A path under no nav item at all. Nothing is current, and nothing is
_arbitrarily_ current — the failure worth checking, because a "starts with
`/dealer`" rule would light Dashboard here.

### `export const AsTheConsoleRendersItToday: Story =`

What the console renders today: two items, because two routes exist.

Worth looking at rather than assuming. A sidebar with two rows is still a
thin thing — the credits panel below it carries a good deal of the sidebar's
weight — but it is no longer a sidebar with nowhere to go, which is what
**F048** changed.

### `export const TabBar: StoryObj<typeof ConsoleTabBar> =`

C026 — the 56px bottom tab bar, below 768.

It is `md:hidden`, so it cannot be seen at all at a desktop viewport: use the
375 and 768 viewport controls, and check that it appears at one and is gone
at the other. Fixed to the bottom of the _viewport_, which in the sandbox is
the preview iframe.

Five tabs, not six. An item earns a tab by having a `short`, and `Dealer
profile` has none — below 768 it stays in the sidebar's territory rather than
taking a fifth of a bar that a dealer's thumb has to hit.

**That rule is suspended while the bar is under-full** (**F048**). The
sidebar is `hidden md:flex`, so this bar is the only navigation a phone has,
and applying the rule literally today would give one tab and no way to reach
`/dealer/profile` at all. `TabBarAsTheConsoleRendersItToday` is that
accommodation; this story is the bar the spec draws, and the two converge
when the fifth route lands.

### `export const TabBarAsTheConsoleRendersItToday: StoryObj<typeof ConsoleTabBar> =`

The same bar on the shell's own list — **two** tabs today.

`Home` earns its place the ordinary way, by carrying a `short`. `Dealer
profile` is there because the bar is short of its five and the sidebar is
hidden at this width: without it there would be a console screen a dealer on
a phone simply could not reach. It drops out on its own when the fifth item
lands.

### `export const TabBarWithNothingLanded: StoryObj<typeof ConsoleTabBar> =`

Handed nothing, it renders nothing rather than an empty 56px strip.

## `apps/sandbox/src/stories/dealer/dashboard-panels.stories.tsx`

### `function series(views: number[]): DashboardResponse['viewsChart']['series']`

DESIGN-SPEC §3.12 — the dashboard's two panels (C077, C078), from **F048**.

**`ViewsChart` computes nothing.** The bar heights are `heightPct` on the
payload, scaled server-side against the week's own maximum, so the drawing
and the total printed above it come from one calculation and cannot drift
apart. The stories below exploit that: several of them pass heights that a
component deriving its own ratio would render differently, which is the
fastest way to see by eye whether it is obeying the API.

The states worth looking at are the degenerate ones — a week with no traffic
at all, a single spike that flattens everything else, and a panel with no
leads — because those are what a new dealership sees and what the product
looks like on the day it launches.

### `export const Chart: Story = {}`

An ordinary week.

### `export const ChartWithNoViews: Story =`

**A quiet week, which is exactly the week a dealer looks at.** Every bar is
zero; the service floors `max` at 1 so this renders flat rather than `NaN%`,
and the day labels still show all seven days — a chart with three bars
because three days had traffic is a chart that lies about the week.

### `export const ChartWithOneSpike: Story =`

One day carrying the week. Everything else is scaled against it and becomes
a hairline — worth seeing, because it is what a dealer gets after one car is
shared somewhere.

### `export const ChartOnTheFirstDay: Story =`

A first day of trading: six empty days and one bar.

### `export const Enquiries: StoryObj<typeof RecentEnquiries> =`

Four leads, each one tap from a call.

### `export const NoEnquiriesYet: StoryObj<typeof RecentEnquiries> =`

**What every dealership sees on day one**, and — until `Enquiry` lands at
F088 — the only state the API can produce. The sentence is the panel's whole
job here: it says where leads will appear rather than leaving a blank box.

### `export const GeneralEnquiry: StoryObj<typeof RecentEnquiries> =`

A general enquiry — somebody asking the dealership a question rather than
asking about one car. The row is kept and labelled rather than dropped.

### `export const LongNamesAtPhoneWidth: StoryObj<typeof RecentEnquiries> =`

A long name against a long vehicle title, at the width the panel actually
gets on a phone. The title ellipsises; the name does not, and the `Call`
button must not be pushed off the row.

## `apps/sandbox/src/stories/dealer/profile-form.stories.tsx`

### `const BASE: DealerProfile =`

C1/C2 — the dealership's own record, after onboarding is over.

Four things to check by eye:

· **What is missing from the form is the point.** There is no "Trading
name": `brandName` is the server-written mirror of `legalName`, and two
boxes able to disagree is exactly what leaving it out prevents. GSTIN and
PAN render disabled — they were verified against a document, and the
admin review screen is where a correction belongs.
· **City, district, state and the Maps link are typed and editable**
(D6, R2, R6). They were a dropdown over a five-row table and two disabled
mirrors of it, which meant a dealer in Salem could not finish this form.
· **The mobile is editable** (R7), and shows the raw number rather than the
`+91 98400 12345` display form, because raw is what the field accepts
back.
· **A refusal lands on the box it names.** `ServerRefusal` below is the
API's answer to a duplicate dealership name in one city and a Maps link
that is not a Google host — the two most likely real failures.

The Server Action is stubbed — `src/mocks/dealer-actions.ts`, coupling C-4.
The stub waits 900ms so the save button's loading state is visible.

### `profileChange: null`

R34. Nothing waiting on a moderator is the ordinary state.

### `function stub(delayMs: number, result: ProfileFormState)`

Setting the stub in a decorator rather than in `beforeEach`, to match the
idiom the admin and auth stories already use: it runs on every re-render, so
a control change cannot leave the previous story's stub in place.

### `export const Populated: Story =`

A dealership that finished onboarding and has answered everything.

### `export const Sparse: Story =`

A row that predates R2 and R6 — no district, no Maps link — and never wrote a
tagline or a service list. Every optional box is empty, which is what the
completeness meter on the page is counting.

### `export const MapIsOnlyAPin: Story =`

**R20** — the same saved link, drawing a bare pin instead of a listing.

This is the state the note exists for, and it is not an edge case: the Share
sheet on a phone hands out the same shape of short link whether the dealer
opened their _business card_ first or dropped a pin on their street, and the
box looks identical afterwards. `Populated` is the good case (`PLACE`, in the
ok green); this is the one that tells a dealer what to do about it.

### `export const MapCouldNotBeRead: Story =`

A link we could not read a position out of at all — the third answer.

### `export const Saved: Story =`

The form after a successful save. `useActionState` holds this until the next
submit — the banner is not auto-dismissed (DESIGN-SPEC §2.15).

### `export const ServerRefusal: Story =`

Two field-level refusals, in the API's own vocabulary. `address.mapsUrl` and
`legalName` come back as `body.address.mapsUrl` and `body.legalName`; the
action folds them onto the input names, which is what puts the message under
the right box.

### `export const ServerError: Story =`

A 5xx, or anything the API refused without naming a field.

### `export const Saving: Story =`

The save button mid-flight — the stub waits three seconds.

### `export const ChangeWaitingForReview: Story =`

R34 — a change waiting for review, which is the state the two boxes are shut
in.

Three things to check by eye:

· **The tagline and services boxes are `disabled`** and hold the _proposed_
text, not the live text. The dealer has already said what they want; the
question in front of them is "do I stand by this", and a live box in that
state offers an edit the API refuses with a 409.
· **`Cancel this change` is the only way out**, and it is a button rather
than something to infer from what the dealer types. Retyping the live
value used to withdraw the request, which made the exit something to
discover rather than press.
· **The established year is still open.** It never needed review, and
locking it would turn one field's queue into a lock on a field that has
nothing to do with it.

The panel carries the live/proposed pair in words because the boxes below can
only show one of them at a time.

### `export const Cancelling: Story =`

The cancel in flight, so the busy button is visible. Press
`Cancel this change`.

### `export const CancelRefused: Story =`

And a cancel the API refused — the message lands inside the panel.

### `export const ChangeRefused: Story =`

A change a moderator refused.

The boxes are **open** here and hold the _live_ values — the reason is above
them and the point is to write something different, so restoring the refused
text would invite the dealer to press Save again unchanged. There is no
Cancel: there is nothing left waiting.
