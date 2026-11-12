# web / components/vehicle/photo-standard

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/photo-standard/photo-standard.constants.ts`

### `SHOT_GUIDES`

The Dealers-Drive photo standard as data: ten shots in the order a photographer
walks round the car, each with where to stand (a point on a top-down plan, the car
facing up), what to aim at, the posture (stand, kneel on one knee, inside the car)
and plain-language how/check lines. The illustrations are drawn from it, so
moving a position is a data change. Positions assume a right-hand-drive car: the
steering wheel is on the right, "left side" is the passenger side, and the seat
shots open the left (kerb-side) doors.

Exterior shots kneel so the phone is at headlight or door-handle height — the
single change that most improves a phone photograph of a car, and the one most
often missed.

## `apps/web/src/components/vehicle/photo-standard/shot-diagram.tsx`

Pure SVG on theme tokens, server-rendered, no images to load: it costs nothing on
a dealer's mobile data and prints. Each shot pairs a top-down position
(`ShotDiagram`) with a side-view posture (`PostureFigure`) because "where" and
"how low" are the two things a written instruction fails to convey.
