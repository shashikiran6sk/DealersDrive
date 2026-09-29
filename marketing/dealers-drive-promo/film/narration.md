# Dealers-Drive promo — narration script

Final narration for the 16:9 film. Read at a relaxed, confident pace (about
140 words a minute). Timings are the film's; `film/captions.srt` carries the
same lines on the same clock and is regenerated from `film/timeline.mjs`, so
if a line changes, change it there and re-render.

Every claim below is something the product does today. The claims the brief
ruled out — guaranteed quality, lowest price, certified or verified
_vehicles_, best dealer — are not made. "Verified" is only ever said of
**dealerships**, whose identity and business documents Dealers-Drive checks
before they can list (onboarding → admin document verification → approval).

| #   | Scene             | Narration                                                                                                    |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Opening           | Buying a used car often starts with endless searching.                                                       |
| 2   | Discover          | Dealers-Drive brings local dealership inventory together in one simple marketplace.                          |
| 3   | Search            | Choose your district, then narrow it down — body type, transmission, price.                                  |
| 4   | Vehicle portfolio | Every car comes with a full photo gallery, clear specifications and the dealer's own price.                  |
| 5   | Dealer discovery  | And behind every car is a verified dealership you can explore — its yard, its details, its whole inventory.  |
| 6   | Enquiry           | Found the one? Sign in with your mobile number and your enquiry goes straight to the dealer.                 |
| 7   | Transition        | For dealerships, Dealers-Drive becomes their digital showroom.                                               |
| 8   | Dealer onboarding | Sign up with a verified mobile number, add your business details and documents, and submit for verification. |
| 9   | Dealer profile    | Once approved, your dealership has a professional page of its own.                                           |
| 10  | Inventory         | Add vehicles, and keep every listing accurate — reserved, sold or withdrawn, in a click.                     |
| 11  | Enquiries         | And when a buyer like Arjun enquires, it lands in your inbox with his verified number, ready for a call.     |
| 12  | Montage           | Dealers-Drive connects car buyers with the dealerships that serve them.                                      |
| 13  | Close             | Discover. Connect. Drive.                                                                                    |

## Recording notes

- One voice, warm and unhurried; no "announcer" delivery.
- Pause a beat after "endless searching." and after "digital showroom." — those
  are the film's two act breaks.
- "Dealers-Drive" is said as two words, _dealers drive_.
- Deliver as a single 48 kHz / 24-bit mono WAV named `voiceover.wav` in
  `assets/audio/`, then run `npm run mix` (see the README).
