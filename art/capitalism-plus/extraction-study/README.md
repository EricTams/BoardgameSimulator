# Three-method ink extraction study

Nine experimental outputs for Lizard Pal, Fraud Fred, and Ten Hens, plus the three original source crops. These are separate from the built-in game pack.

Open `index.html` in a browser for the comparison, background selector, enlarged view, and individual downloads. `comparison.png` is a static overview.

## Methods

1. **Original pixels (`*-pixels.png`)**: red-channel ink contrast, a 25-pixel morphological closing to estimate paper illumination, Gaussian background smoothing, and per-card soft alpha thresholds. Stroke positions remain at source resolution. Ink is recolored to #263f39; photographed bottom dividers and one paper-edge fragment are masked. Some fine paper texture remains. No generated details or line repair.
2. **SVG trace (`*-trace.svg`)**: Potrace outlines of the same extraction, thresholded at 30% alpha. Speck filtering is disabled, corner smoothing is low, and curve optimization tolerance is 0.12. This is a genuine path-only SVG, not an embedded raster. Dense eye/teeth details can merge and fine stroke widths change.
3. **AI cleanup (`*-ai.png`)**: built-in image_gen, one edit per original crop, transparent background. No CLI/API fallback. Outputs are copied intact from the generator with their original alpha channels. Exact instructions are in `prompts.json`.

## Observations

- Lizard Pal: pixel extraction preserves the diagonal lower-left stroke; the AI version drops it and regularizes some line thickness. SVG introduces angular changes around tight joints.
- Fraud Fred: the pixel version retains the original eye and tooth marks. SVG makes dense details heavier. AI keeps the overall expression and Hola lettering but changes some eye and tooth geometry.
- Ten Hens: faint and clipped strokes are challenging. AI presents cleaner, more regular line ends. Pixel and SVG retain more source-edge fragments. None of these results establishes the shape of ink outside the photographed crop.

Pixel extraction is the conservative starting point when fidelity matters most. SVG is useful for scaling but needs detail review. AI is a plausible alternate visual treatment, not a lossless extraction.

## Reproduce

Use an isolated Python environment with Pillow, numpy, and opencv-python-headless for `extract.py`. Install npm package `potrace` in a separate tools directory; make that installation available via `NODE_PATH` for `trace.cjs`.

```sh
python extract.py
NODE_PATH=/path/to/tools/node_modules node trace.cjs
node build-review.mjs
```

Run from this directory. The scripts use paths relative to themselves. `*-trace-input.png` files are the binary intermediates used by Potrace. AI output is nondeterministic; the saved files are the reviewed examples. Source image resolutions are 341 × 243, 370 × 324, and 422 × 245 pixels; larger AI outputs do not represent recovered source detail.

Validation: all 12 comparison images decode; the three generated PNGs contain real transparency; the review page's background selector, enlargement dialog, zoom, and narrow-screen layout were checked in Chromium.
