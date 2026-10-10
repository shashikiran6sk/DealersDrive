# Bundled Manrope

Manrope 4.504 is the same font version used by the former Google Fonts loader.
It is bundled to avoid a build-time Google Fonts download failure. The existing
CSS variable, normal style, 400–800 weight range and swap display are retained.

Source: [Google Fonts, pinned commit](https://github.com/google/fonts/tree/8f9a401dbb3793e0d1264b15d96aa253f05280f5/ofl/manrope).
The original `Manrope[wght].ttf` was losslessly converted to WOFF2 with FontTools;
no glyph subsetting or outline changes were applied. The full font preserves
the previously available Latin, Cyrillic, Greek and Vietnamese glyph coverage.
The included `OFL.txt` is the original SIL Open Font License 1.1. Conversion
tools are not an application dependency. Next serves the file from the same
origin with a build fingerprint.

Reproduction, using an isolated FontTools installation and the pinned TTF:

```python
from fontTools.ttLib import TTFont

font = TTFont("Manrope[wght].ttf")
font.flavor = "woff2"
font.save("manrope-variable.woff2")
```
