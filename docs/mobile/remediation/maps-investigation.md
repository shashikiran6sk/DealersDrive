# Dealer map: investigation (owner remediation §7.6)

**Finding: nothing is broken, hidden or misconfigured.** Neither the website nor the
Android app has shown an embedded map since PR #279. Both deliberately show the
address as text and offer _Get directions_, which opens Google Maps outside the
product. The "expected map UI" in the owner's recording is the pre-#279 website's
iframe.

| Question from the brief                    | Answer and evidence                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the website embed a map preview?      | **No, not since #279.** Commit `6c4a4f5` (in #279's squash `9861483`) removed the `<iframe src={address.embedUrl}>` from `components/dealers/location-card/location-card.tsx`. The API returns `embedUrl: null` (`dealers.public.service.ts`), and the OpenAPI text says no iframe resource is loaded. The reason, from `docs/legal/CONSOLIDATION_AND_CONSENT.md`: a Google frame discloses every visitor to Google on load. |
| Is Android directions-only on purpose?     | **Yes.** `dealer-profile-screen.tsx` validates `address.mapsUrl` with the contract's `GoogleMapsUrl` and opens it with `Linking.openURL` only when the user taps. `docs/code/mobile/dealers-home.md` records this: no embedded map, no geocoding, no location permission and no paid SDK.                                                                                                                                    |
| Are the maps URL or coordinates wrong?     | Not found in code. The API builds the link from validated coordinates, then from a complete public address, then from the dealer's own validated share link. It never guesses a pin. A wrong pin would be a data problem with that dealer's record, to check per dealer in the admin console.                                                                                                                                |
| Can the app not load a preview?            | There is no preview to load: no map component exists in the app.                                                                                                                                                                                                                                                                                                                                                             |
| Is the map hidden, clipped or misrendered? | No. No map element is rendered on either platform.                                                                                                                                                                                                                                                                                                                                                                           |
| Are API keys or provider settings missing? | None are used or needed. External directions need no key. The removed iframe used the keyless embed URL.                                                                                                                                                                                                                                                                                                                     |

## Recommendation

Keep **external directions only**. It is the smallest reliable behaviour, it matches
the website exactly, and it keeps #279's privacy position.

If the owner still wants a map on the dealer page, it is a product and privacy
decision, not a defect fix. Options, smallest first:

1. **A static map image behind a tap**: a "Show map" control that loads one image
   only after the user asks. It needs a Maps Static API key restricted to the API's
   server and a privacy-notice update. It must use only validated coordinates, never
   a geocoded address.
2. **An embedded native map** (`react-native-maps` with the Google provider). It
   needs a new native dependency and a rebuilt binary, an Android Maps SDK key
   restricted by package name and signing-certificate SHA-1 (separate keys for
   preview and production), per-load billing, a Play data-safety update and a
   privacy-notice update. The key ships in the APK, so the restriction is the only
   protection: never reuse a server key.
3. **Restore the web iframe**: this reverses #279. It needs legal sign-off and,
   under the current consolidation, a consent decision before Google is contacted.

No key is added, and nothing is hardcoded, by this investigation.
