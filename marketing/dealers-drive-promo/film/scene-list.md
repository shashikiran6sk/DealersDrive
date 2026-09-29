# Scene list

Timecodes are from `film/timeline.mjs` (16:9 cut, 116.6 s; 9:16 cut,
67.5 s). Adjacent clips overlap by their crossfade, so a scene's end and the
next one's start differ by about half a second. Every "App" scene is real
footage of the running product; the actions listed are performed by
`scripts/capture.mjs`, not simulated.

## 16:9 — `dealers-drive-promo-4k.mp4` / `-1080p.mp4` / `-1x1.mp4`

| #   | Time      | Scene              | On screen                                                                                                                                  | Lower third                      |
| --- | --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | 0:00–0:06 | Opening            | Green Circle Cars' yard, slow push; Dealers-Drive mark; "Find your next car. From dealers you can discover and trust."                     | —                                |
| 2   | 0:06–0:14 | Discover           | Homepage scrolls to Recently added; `/cars` with the full photographed grid                                                                | Find your next car               |
| 3   | 0:14–0:25 | Search and filters | Select district → Vellore (39 cars); filter rail → SUV → Automatic; results update to 8 cars, Creta first                                  | Search the way you shop          |
| 4   | 0:25–0:37 | Vehicle portfolio  | 2021 Hyundai Creta SX(O): gallery lightbox (front, infotainment, dashboard, at the yard, 14 photos); specifications                        | Explore every detail             |
| 5   | 0:37–0:47 | Dealer discovery   | View dealership → Green Circle Cars portfolio (yard hero, details, inventory incl. a Reserved car); dealer directory                       | Discover local dealerships       |
| 6   | 0:47–0:58 | Customer enquiry   | Enquire now → customer login → OTP → form prefilled with Arjun's verified number → message typed → Enquiry sent                            | Connect directly                 |
| 7   | 0:57–1:01 | Transition         | Metro Motors' yard; "Dealers-Drive becomes your digital showroom."                                                                         | —                                |
| 8   | 1:01–1:13 | Dealer onboarding  | Dealer login; account (Google linked, phone verified); business details; GSTIN/PAN saved; documents + yard uploaded; submit → Under review | Get your dealership online       |
| 9   | 1:12–1:21 | Dealer profile     | Green Circle's console dashboard → Dealer profile (100 % complete) → the public portfolio page                                             | Your digital storefront          |
| 10  | 1:21–1:34 | Inventory          | Inventory with Active, Reserved, Sold, Withdrawn and Pending review; Reserve the Nexon → confirm → Reserved; Add vehicle                   | Manage inventory                 |
| 11  | 1:34–1:43 | Enquiry management | Inbox: Arjun's enquiry "just now", verified number, message; Mark contacted; dashboard counts                                              | Turn interest into conversations |
| 12  | 1:43–1:51 | Montage            | Cars grid, at-the-yard photo, Enquiry sent, inbox, inventory, portfolio — "Discover." "Connect." "Sell."                                   | —                                |
| 13  | 1:50–1:57 | Close              | Dealers-Drive; "A better digital marketplace for used cars." "Discover. Connect. Drive." dealers-drive.com                                 | —                                |

## 9:16 — `dealers-drive-promo-9x16.mp4`

Re-captured on a 390×844 phone viewport, not cropped from the 16:9 film, so
every screen is the product's own mobile layout: the bottom-sheet filters,
the sticky Enquire button, the dealer console's bottom navigation.

| #   | Time      | Scene             | On screen                                                                   |
| --- | --------- | ----------------- | --------------------------------------------------------------------------- |
| 1   | 0:00–0:05 | Opening           | Yard photograph, brand, headline                                            |
| 2   | 0:05–0:11 | Discover          | `/cars` on a phone, scrolling the photographed grid                         |
| 3   | 0:11–0:20 | Search            | Filters sheet → SUV → Automatic → "Show … cars" → results                   |
| 4   | 0:20–0:29 | Vehicle portfolio | Creta page → full-screen gallery, four photos → specifications              |
| 5   | 0:29–0:36 | Dealers           | Green Circle portfolio; dealer directory                                    |
| 6   | 0:35–0:45 | Enquiry           | Enquire now → OTP → form → Enquiry sent                                     |
| 7   | 0:44–0:48 | Transition        | "Dealers-Drive becomes your digital showroom."                              |
| 8   | 0:47–0:53 | Onboarding        | Dealer OTP → Create your account                                            |
| 9   | 0:52–1:03 | Inventory, inbox  | Dashboard → inventory cards with statuses → enquiries with Arjun at the top |
| 10  | 1:02–1:08 | Close             | Brand and closing line                                                      |

## The demo story

- **Customer:** Arjun Raman (+91 90000 20001), looking for an automatic SUV
  in Vellore.
- **Featured car:** 2021 Hyundai Creta SX(O), diesel automatic, ₹13,45,000,
  at Green Circle Cars.
- **Featured dealership:** Green Circle Cars, Vellore — an existing dev-seed
  dealership ("Compact SUVs and MUVs, exchange welcome"), given a fuller
  inventory by the promo seed.
- **New dealership onboarding:** Metro Motors, Vellore — owner Ravi Shankar.
