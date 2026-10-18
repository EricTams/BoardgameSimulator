# Capitalism Plus card assets

The current deck contains 69 cards from the six photographs in `ContentDrop-10-18-2026`, supplied October 18, 2026. This set replaces the previous 44-card prototype in full.

- `source/`: six unaltered source photographs.
- `catalog-source.mjs`: names, printed corner symbols, transcribed text, and crop coordinates in a 1368 × 1824 reference view.
- `cards/`: 69 full card crops, including handwriting.
- `illustrations/`: 69 illustrations cropped from original pixels, with paper retained. These are not regenerated images.
- `transparent/`: 69 soft-alpha PNGs extracted from the original ink, used in the game. Ten Hens has an added thin frame.
- `transparent-review.html`: original crops beside the transparent versions.
- `cards.json`: generated catalog with illustration dimensions.
- `review.html`: searchable side-by-side review of card crops, illustrations, and text.

Card text is transcribed as written with normalized punctuation and spelling-only cleanup in display text. Effects and usage counters are descriptive; players manage all rules and turns. Source notes identify the crossed-out Suggestions title and the unusual handwritten title Roast Fleast.

Regenerate with:

```sh
node scripts/extract-capitalism.mjs
python scripts/clean-capitalism-ink.py
node scripts/build-capitalism-pack.mjs
```

Install `scripts/requirements-art.txt` in an isolated Python environment before the ink-cleanup step. The cleanup estimates the local paper brightness, converts ink contrast to soft alpha, and preserves source-resolution strokes in dark green (#263f39). It does not trace or generate the artwork. Original photo crops remain available for comparison.

The final script updates the built-in game pack and published illustrations. When removing cards in future drops, also remove their obsolete generated images. The host can choose Capitalism Plus and enable **Display all cards face up** in the deck options to review the complete set.
