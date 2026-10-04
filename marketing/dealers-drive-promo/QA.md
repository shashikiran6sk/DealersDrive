# Final quality checks

Rebuilt and verified 2026-10-04 against the isolated local promotional environment, using the white-studio application snapshot saved on `video_generator` at `d40f12697add194e76af77f163b342e80978a360`.

## White studio photography revision

- All 41 vehicle images use white studio surroundings. Exterior photographs retain soft contact shadows; interior photographs retain cabin detail and show white surroundings through the windows.
- All 12 marketplace hero photographs use an upright, right-facing front three-quarter angle of approximately 45 degrees. Wider white margins keep full vehicles visible in the portfolio frame.
- Each replacement was visually reviewed. Dealership yard images and the cinematic opening photograph retain their original settings.
- Vehicle media URLs use a deterministic revision and content hash, so browser and image-optimizer caches cannot reuse earlier photographs. Verification compares all 41 served vehicle derivatives with their stored bytes.
- The actual application was recorded again for desktop, vertical and 4:5 layouts, and all four film exports were rebuilt with the revised photographs.

## Application and data

- 47/47 READY promotional media records returned HTTP 200 with valid WebP bodies through the normal API media route.
- 12 active public cars across 6 active dealerships. Featured Elevate: 8 images. Other cars: 3 images each.
- Browser walkthrough completed car search/filtering, vehicle portfolio and gallery, dealer directory/profile, save, enquiry submission and customer enquiry history.
- Dealer walkthrough completed account/business onboarding stages, document-screen inspection, dashboard/profile editing, real draft submission, Active → Reserved → Active, and customer enquiry follow-up.
- Database postconditions: draft is PENDING_REVIEW; Arjun's enquiry is CONTACTED; featured listing is ACTIVE again. See `demo-verification.json`.
- Capture error collection reported no JavaScript page errors or failing API responses on the completed passes. Navigation checks rejected broken images.
- Development banners and Next.js indicators were hidden only in capture contexts. Captures contain application viewport pixels, with no browser address bar, developer tools or credentials.
- The environment guard test rejects production settings, remote/wrong databases, wrong URL protocols and storage outside the promotional directory.
- This resumed rebuild restored files only under `marketing/`. The application ran from a separate snapshot checkout; existing changes on the production-deployment branch were preserved. No production source, normal seed, schema or runtime dependency manifest was modified by this rebuild.

## Film

| Export       | Frame     | Rate   | Duration | Decode |
| ------------ | --------- | ------ | -------- | ------ |
| 4K           | 3840×2160 | 30 fps | 111.02 s | Pass   |
| 1080p        | 1920×1080 | 30 fps | 111.03 s | Pass   |
| Reels/Shorts | 1080×1920 | 30 fps | 111.02 s | Pass   |
| Social       | 1080×1350 | 30 fps | 111.02 s | Pass   |

All four files were fully decoded with FFmpeg without errors. The soundtrack measures approximately **−16.13 LUFS integrated**, **−3.80 dBTP true peak**, with **6.5 LU loudness range**. Narration is normalized and music mixed underneath; no clipping was detected. AAC stereo at 48 kHz accompanies H.264 video. MP4 fast-start metadata is enabled.

Scene end screenshots and 13 sampled frames per final aspect ratio were visually inspected. The checks covered image presentation, readable UI, title placement, responsive framing, fictional contacts, brand closing frames and absence of development chrome. Review sheets are in `scenes/qa/`; machine-readable encoding/audio results are in `export-verification.json`.

## Practical limits

- 4K is a 4K composition containing high-density browser captures with modest scaling, not native 3840-wide browser video. Source screen update cadence is variable; output is constant 30 fps.
- Narration is synthetic. Audio quality verification above covers encoding and measured levels, not a human studio listening sign-off.
- SRT sentence timing is proportional within measured voiceover clips, not word-level forced alignment.
- Onboarding begins from a development Google/phone identity fixture. The film shows real subsequent forms, not a live Google OAuth flow or completed business approval.
- The images illustrate fictional seed inventory. Generated interiors/body details are not a substitute for actual vehicle photography or exact trim verification.

These limits are documented so the film and its sources can be reviewed and revised honestly.
