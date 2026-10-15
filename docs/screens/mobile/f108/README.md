# F108 native smoke evidence

These are unmodified screenshots/JUnit from [successful native run 38702174641](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38702174641), application source `e0874e6a37f762d3dc5685c70063ef447e81c63d`. The API35 AOSP Pixel5-profile x86_64 emulator passed **guest** and **public-links**, 2/2 flows. Captured diagnostics report no ANR since boot.

- [Home](home.png): approved DD symbol and guest layout.
- [About](about.png): approved separate symbol and wordmark.
- [Cold car link](car-cold-link-error.png): car route/error UI at a missing validation slug; **not a loaded vehicle**. The capture retains a loading heading beside error controls, a review observation recorded in the handoff.
- [Guest Saved](saved-guest.png): authentication prompt.
- [JUnit](maestro.xml) and [hash/device/source provenance](provenance.json).

UI artifact 11957660993 and APK/AAB artifact 11957566366 have GitHub retention limits. This directory preserves only selected original evidence, with no image editing or generated substitutes. Origins are deliberately `https://api.validation.invalid` and `https://web.validation.invalid`; this run does not validate live inventory, authenticated features, external providers, physical hardware or production signing.

Warm links were tested after Home became ready, and cold links from a stopped app. The earlier intermediate-startup-window loss is **not proven resolved** by those flows. See [the agent handoff](../../../mobile/AGENT-HANDOFF.md) and [chronological validation](../../../mobile/f108-validation.md). API36 system/launcher ANR failures remain in their original CI artifacts/history; they are not superseded as API36 runtime evidence by an API35 pass.
