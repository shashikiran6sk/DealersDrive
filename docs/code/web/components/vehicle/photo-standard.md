# web / components/vehicle/photo-standard

Parent: [web/components/vehicle](README.md)

The confirmed Dealers-Drive photo guide ("Ten photos that sell a car", the PDF in
`apps/web/public/photo-guide/`) on screen. It replaced hand-drawn SVG diagrams:
the handbook's own photographs of someone kneeling at each spot say "where" and
"how low" better than any plan, and dealers will have seen the same pictures in
the PDF.

## `apps/web/src/components/vehicle/photo-standard/photo-standard.constants.ts`

### `SHOT_GUIDES`

The guide as data, one entry per photo in its order: the title and side, why the
shot matters, pose, phone height, distance, how to hold the phone, step by step,
what to check and what to avoid — the PDF's words. The order and the slot names
match `VehiclePhotoSlot` in contracts, so photo 7 in the guide is upload card 7
and file `…-07-front-seats.jpg` in the admin's zip. Right is the driver's side:
Indian cars are right-hand drive.

### `PHOTO_GUIDE_ASSETS`

The pictures were cut from the PDF once and saved as WebP — per photo a
"how to position yourself" photo, the reference result and the top-down plan,
plus the four poses and the walk-round — about 1 MB for the lot, against 8 MB for
the PDF. They are static files served by the web app, not media: they never
change per car and need no signed URL.

## `apps/web/src/components/vehicle/photo-standard/guide-image.tsx`

### `GuideImage`

A plain `<img>`, lazy by default. These are small static WebPs already cut to
the size the card shows, so `next/image` would add a loader round trip for
nothing, and lazy loading means a dealer on mobile data only fetches the
pictures they scroll to. The walk-round is `eager` because it is the first
thing on screen.

## `apps/web/src/components/vehicle/photo-standard/shot-illustration.tsx`

### `compact`

On the guide page a shot shows all three pictures. In the wizard the upload tile
takes the result's place and the reference result sits under it as "aim for
this", so `compact` shows the positioning photo alone.
