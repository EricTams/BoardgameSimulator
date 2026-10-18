# Capitalism Plus card assets

44 identifiable cards from the two original photographs in `/Users/erictams/AIDev/BoardgameSimulator/CapitalismPlus`. The originals were copied into this project without alteration.

Open **review.html** to browse the original card crops, extracted illustrations, names, markers, and readable text. Search by card name or wording. Source notes concern unclear lettering, crossed-out titles, or artwork clipped in the original photograph.

- `source/`: the two original JPEG photographs.
- `cards/`: 44 individual card crops, including their handwriting.
- `illustrations/`: 44 illustration PNGs extracted from the original pixels. Paper/shading remain. Three outline crops separate art from nearby lettering. These are small photographic assets, not regenerated or high-resolution redraws.
- `cards.json`: machine-readable card names, text, literal corner markers, image paths, source coordinates, and transcription notes.
- `catalog-source.mjs`: editable transcription and extraction coordinates used to generate the outputs.
- `review.html`: self-contained review interface using relative image paths; opens locally without a server.

Card wording is preserved, with only punctuation/capitalization and minor spelling cleanup. `sourceText` retains the manual transcription; `text` is the display version. Rules are left to the players. There is no rule interpretation, validation, balancing, or automation in these assets.

The title **Taxor Taxer** and the spelling of **Wizard Vonblizzard** are uncertain. Lester's illustration is cut off at the top of its source photo; Heist is cut off at the right edge. Narrow, unidentifiable card fragments at the left edge of the first photo are excluded. The extraction does not invent those missing pixels.

To regenerate after changing coordinates or transcription:

```sh
npm ci
npx playwright install chromium
node scripts/extract-capitalism.mjs
```

Run `node scripts/build-capitalism-pack.mjs` after regenerating to update the built-in Gather pack and its published artwork. The host can select Capitalism Plus in the lobby and enable the deck’s face-up testing option to review all 44 cards.
