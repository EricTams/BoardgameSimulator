// npm install potrace; run with NODE_PATH pointing to that installation.
const { trace } = require('potrace');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
(async () => {
  for (const id of ['lizard-pal', 'fraud-fred', 'ten-hens']) {
    const svg = await new Promise((resolve, reject) => trace(
      join(__dirname, `${id}-trace-input.png`),
      { color: '#263f39', background: 'transparent', threshold: 128,
        turdSize: 0, alphaMax: .5, optCurve: true, optTolerance: .12 },
      (error, svg) => error ? reject(error) : resolve(svg),
    ));
    await writeFile(join(__dirname, `${id}-trace.svg`), svg);
    console.log(`Traced ${id} into SVG ink outlines.`);
  }
})();
