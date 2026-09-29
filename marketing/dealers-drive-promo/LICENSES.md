# Asset provenance and licensing

## Original photographs

47 original images were generated for this project with OpenAI's built-in image generation tool on 2026-09-29. They were not scraped, copied or hotlinked from Cars24, Spinny or a stock-photo service. Cars24 was used only as a reference for the category and quality of marketplace photography. Exact prompts, file hashes and dimensions are in `asset-inventory.json`. These are fictional promotional illustrations for development, not photographs of real sale inventory.

On 2026-09-30, the 41 vehicle photographs were edited with the same built-in image generation tool using their existing originals as references, to unify white studio backgrounds and right-facing card heroes. `studio-generation.json` records those edits. The original cinematic Elevate photograph is retained separately as `assets/brand/opening-car.png`, bringing the retained source inventory to 48 images (47 loaded into the demo database plus one editorial opening image).

## Music

**Digital Showroom** — original algorithmic composition created specifically for Dealers-Drive. The reproducible synthesizer is `scripts/music.mjs`; the stereo master is `assets/audio/digital-showroom-original.wav`. It uses oscillator synthesis and deterministic noise, with no samples, commercial recordings or third-party loops. No third-party music attribution or subscription is required for using this composition in this film. It may be used, modified and distributed with Dealers-Drive promotional material.

## Voice

Synthetic narration generated with Kokoro-82M v1.0, ONNX conversion, `af_heart` voice, via kokoro-js. No real person's recording was cloned for this production. The model is released under Apache-2.0 and its publisher expressly permits production and commercial use. Model weights are downloaded only when regenerating voiceover; the finished WAVs are included, so exports need no AI service or model download.

- Publisher and license: https://huggingface.co/hexgrad/Kokoro-82M
- ONNX conversion: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- Generation library: https://github.com/hexgrad/kokoro/tree/main/kokoro.js

## Typography

Manrope, Copyright 2018 The Manrope Project Authors, SIL Open Font License 1.1. The included WOFF2 is the same Latin font used by this application's Next.js build. Full license: `licenses/Manrope-OFL.txt`.

Source: https://github.com/google/fonts/tree/main/ofl/manrope

## Tooling

Playwright, Sharp, Kokoro JS and FFmpeg are isolated development dependencies. Their licenses remain in the installed packages. FFmpeg is used to render media and is not bundled into the application's runtime or the exported MP4s.
