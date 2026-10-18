import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { catalog } from '../art/capitalism-plus/catalog-source.mjs';

const root = fileURLToPath(new URL('../art/capitalism-plus/', import.meta.url));
await mkdir(resolve(root, 'cards'), { recursive: true });
await mkdir(resolve(root, 'illustrations'), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const source of new Set(catalog.cards.map(c => c.source))) {
    const bytes = await readFile(resolve(root, source));
    const results = await page.evaluate(async ({ source, cards, ref }) => {
      const img = new Image();
      img.src = source;
      await img.decode();
      const output = [];
      for (const card of cards) for (const [boundsKey, pathKey] of [['cardBounds', 'cardImage'], ['artBounds', 'artwork']]) {
        const [x, y, w, h] = card[boundsKey];
        const left = Math.round(x * img.naturalWidth / ref.width);
        const top = Math.round(y * img.naturalHeight / ref.height);
        const right = Math.min(img.naturalWidth, Math.round((x + w) * img.naturalWidth / ref.width));
        const bottom = Math.min(img.naturalHeight, Math.round((y + h) * img.naturalHeight / ref.height));
        if (left < 0 || top < 0 || right <= left || bottom <= top) throw Error(`Invalid bounds: ${card.id}`);
        const canvas = document.createElement('canvas');
        canvas.width = right - left; canvas.height = bottom - top;
        const ctx = canvas.getContext('2d');
        if (pathKey === 'artwork' && card.artPolygon) {
          ctx.beginPath();
          card.artPolygon.forEach(([px, py], i) => {
            const ax = px * img.naturalWidth / ref.width - left;
            const ay = py * img.naturalHeight / ref.height - top;
            if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
          });
          ctx.closePath(); ctx.clip();
        }
        ctx.drawImage(img, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        output.push({ path: card[pathKey], base64: canvas.toDataURL('image/png').split(',')[1], width: canvas.width, height: canvas.height });
      }
      return output;
    }, { source: `data:image/jpeg;base64,${bytes.toString('base64')}`, cards: catalog.cards.filter(c => c.source === source), ref: catalog.referenceSize });
    for (const result of results) {
      await writeFile(resolve(root, result.path), Buffer.from(result.base64, 'base64'));
      const card = catalog.cards.find(c => c.artwork === result.path);
      if (card) card.artworkSize = { width: result.width, height: result.height };
    }
  }
} finally { await browser.close(); }

await writeFile(resolve(root, 'cards.json'), JSON.stringify(catalog, null, 2) + '\n');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries = catalog.cards.map(c => `<article data-search="${esc([c.name,c.sourceText,c.marker ?? '',...c.notes].join(' ').toLowerCase())}" data-review="${c.reviewStatus}">
  <header><h2>${esc(c.name)}</h2><span>${esc(c.marker ?? 'Unmarked')}</span></header>
  <div class="pictures"><a href="${c.cardImage}" target="_blank"><img class="scan" src="${c.cardImage}" alt="Original ${esc(c.name)} card" loading="lazy"></a><div><img class="art" src="${c.artwork}" alt="Extracted ${esc(c.name)} illustration" loading="lazy"><a class="download" href="${c.artwork}" download>Download illustration · ${c.artworkSize.width} × ${c.artworkSize.height}</a></div></div>
  <h3>Card text</h3><p>${esc(c.text)}</p>
  ${c.notes.length ? `<div class="note"><b>Source note</b><p>${esc(c.notes.join(' '))}</p></div>` : '<div class="clear">Transcribed · ready for your review</div>'}
  <footer><a href="${c.source}" target="_blank">Source photograph</a> · <a href="${c.cardImage}" download>Download card crop</a></footer>
</article>`).join('\n');
await writeFile(resolve(root, 'review.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Capitalism Plus · Card review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e8;color:#273f36;font:15px/1.6 system-ui,sans-serif}main{max-width:1450px;margin:auto;padding:36px}h1{font:42px Georgia,serif;margin:4px 0 12px}h2{font:25px Georgia,serif;margin:0}h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#758471;margin:18px 0 5px}p{margin:0 0 12px}a{color:#356753}.intro{max-width:850px}.eyebrow{letter-spacing:3px;font-size:11px;color:#8b7045}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:28px 0}input,select{font:inherit;padding:11px 14px;border:1px solid #cbd0bd;border-radius:7px;background:#fffefa}input{width:320px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}article{background:#fffdf7;border:1px solid #dce0cf;border-radius:12px;padding:22px}article header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-height:64px}article header span{background:#e7ecdf;padding:3px 9px;border-radius:5px;font-size:12px}.pictures{display:grid;grid-template-columns:42% 58%;gap:10px;align-items:start;min-height:240px}.scan{max-width:100%;max-height:260px;object-fit:contain}.art{max-width:100%;max-height:160px;object-fit:contain}.download{display:block;font-size:11px;margin:10px 0}.note{padding:12px;background:#f5ead4;border-radius:6px;font-size:12px;margin-top:15px}.note p{margin:4px 0 0}.clear{font-size:12px;color:#638255;margin-top:15px}footer{font-size:11px;border-top:1px solid #e0e3d7;padding-top:12px;margin-top:18px}.notice{background:#e8eddf;padding:15px 18px;border-radius:8px;margin-top:18px;font-size:13px}article[hidden]{display:none}@media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){main{padding:22px}.grid{grid-template-columns:1fr}.pictures{min-height:200px}h1{font-size:32px}}
</style></head><body><main><div class="eyebrow">FROM THE ORIGINAL PAPER PROTOTYPE</div><h1>Capitalism Plus</h1><p class="intro">${catalog.cards.length} cards from ${new Set(catalog.cards.map(c => c.source)).size} photographs (October 18, 2026). Original cards, extracted illustrations, and readable card text side by side.</p><div class="notice">Card effects are transcribed as written; players handle the rules. Illustrations are original photo crops with the paper retained; no art has been redrawn. Printed corner symbols are preserved.</div><div class="toolbar"><input id="search" type="search" aria-label="Search cards" placeholder="Search names, text, or notes…"><select id="filter" aria-label="Review filter"><option value="all">All cards</option><option value="check-source">Has source notes</option><option value="transcribed">Transcribed</option></select><span id="count">${catalog.cards.length} cards</span><a href="cards.json" download>Download catalog JSON</a></div><div class="grid">${entries}</div></main><script>
const search=document.querySelector('#search'),filter=document.querySelector('#filter');function update(){let n=0;for(const card of document.querySelectorAll('article')){card.hidden=!card.dataset.search.includes(search.value.toLowerCase())||(filter.value!=='all'&&card.dataset.review!==filter.value);if(!card.hidden)n++}document.querySelector('#count').textContent=n+' cards'}search.addEventListener('input',update);filter.addEventListener('change',update);
</script></body></html>`);
console.log(`Extracted ${catalog.cards.length} cards and ${catalog.cards.length} illustrations. Review: ${resolve(root, 'review.html')}`);
