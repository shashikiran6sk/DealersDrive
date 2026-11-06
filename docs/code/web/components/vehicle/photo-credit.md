# web / components/vehicle/photo-credit

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/photo-credit/photo-credit.tsx`

### `export function PhotoCredit({ credit, dealerName, className }: PhotoCreditProps)`

The line under the car page gallery that tells a buyer who took the photographs
(**R45**). Some cars are photographed by the Dealers-Drive team at the
dealership; others are photographed by the dealership and published only once
an admin has checked them against the photo standard. The site used to say
"every car is photographed by Dealers-Drive", which stopped being true the day
the first dealer set was published, and a buyer who found that out would doubt
the "reviewed" claim beside it too. So the page says which, plainly.

The wording is deliberately positive both ways. "Photographed by Dealers-Drive"
is a selling point; "Dealer photos · Reviewed by Dealers-Drive" says what was
actually done. "Verified" is avoided on dealer photographs because buyers read
it as "the car's condition is verified". "Unverified" is avoided because the
photographs did pass a review.

`credit` is `PublicVehicleDetail.photoCredit`. When it is `null`, because some
photograph was attached before credit was recorded, the component names no
photographer and states only the standard, which every published photograph
meets. The car page renders it only when the car has photographs, since a
"coming soon" slot has no photographer to credit.

"Our photo standard" is a native `<details>`: it opens without JavaScript, so
this stays a server component, and it keeps the list out of the way for buyers
who do not need it. The list must name only checks the team actually makes. It
ends with the advice to see the car in person, because a photograph helps a
buyer shortlist a car and does not inspect it.
