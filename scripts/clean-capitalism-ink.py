"""Extract original ink as soft transparency; never trace or generate strokes.
Install scripts/requirements-art.txt in an isolated Python environment.
"""
import json
from pathlib import Path
from html import escape

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/capitalism-plus'
OUT = ART / 'transparent'
OUT.mkdir(exist_ok=True)
INK = (38, 63, 57)
# Keep the settings approved in the three-card comparison.
SETTINGS = {'lizard-pal': (.07, .42), 'fraud-fred': (.06, .42), 'ten-hens': (.05, .35)}
catalog = json.loads((ART / 'cards.json').read_text())
rows = []
for card in catalog['cards']:
    slug = card['id']
    rgba = np.array(Image.open(ART / card['artwork']).convert('RGBA'))
    channel = rgba[:, :, 0].copy()
    visible = rgba[:, :, 3] > 0
    channel[~visible] = int(np.median(channel[visible]))
    paper = cv2.morphologyEx(channel, cv2.MORPH_CLOSE,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    paper = cv2.GaussianBlur(paper.astype(np.float32), (0, 0), 8)
    contrast = np.maximum(0, (paper - channel) / np.maximum(paper, 1))
    black, span = SETTINGS.get(slug, (.06, .40))
    alpha = np.clip((contrast - black) / span, 0, 1) * rgba[:, :, 3] / 255.0
    h, w = alpha.shape
    # Mask photographed divider remnants, preserving nearby drawing pixels.
    if slug == 'fraud-fred':
        for x in range(int(w * .70), w):
            alpha[max(0, int(h - 2 - (x / w - .70) * 13)):, x] = 0
    if slug == 'ten-hens':
        alpha[:80, :4] = 0
        for x in range(int(w * .49), w):
            alpha[max(0, int(h - (x / w - .49) * 33)):, x] = 0
    result = np.zeros_like(rgba)
    result[:, :, :3] = INK
    result[:, :, 3] = np.round(alpha * 255).astype(np.uint8)
    image = Image.fromarray(result)
    if slug == 'ten-hens':
        # An added, thin frame gives the cropped hens a visible boundary.
        # Only the frame is rendered at higher resolution; source ink is untouched.
        scale = 4
        frame = Image.new('RGBA', (w * scale, h * scale))
        ImageDraw.Draw(frame).rectangle((3, 3, w * scale - 4, h * scale - 4),
                                       outline=(*INK, 255), width=6)
        image = Image.alpha_composite(image, frame.resize((w, h), Image.Resampling.LANCZOS))
    assert image.getchannel('A').getextrema()[0] == 0, slug
    image.save(OUT / f'{slug}.png', optimize=True)
    rows.append(f'<article><h2>{escape(card["name"])}</h2><div class="pair"><figure><img src="{card["artwork"]}" alt="Original {escape(card["name"])}"><figcaption>Original photo crop</figcaption></figure><figure><img src="transparent/{slug}.png" alt="Transparent {escape(card["name"])}"><figcaption>Original ink{ " + frame" if slug == "ten-hens" else ""}</figcaption></figure></div></article>')
# Remove obsolete outputs only from the generated transparency directory.
expected = {c['id'] + '.png' for c in catalog['cards']}
for old in OUT.glob('*.png'):
    if old.name not in expected:
        old.unlink()
(ART / 'transparent-review.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capitalism Plus · Original ink</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f0e8;color:#263f39;font:14px system-ui}main{max-width:1500px;margin:auto;padding:24px}h1{font:34px Georgia}h2{font:18px Georgia;margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}article{background:#fffdf7;border:1px solid #d5dbce;border-radius:9px;padding:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;min-width:0}img{width:100%;height:150px;object-fit:contain;background:var(--paper,#fff)}figcaption{font-size:11px;margin-top:8px}select,input{font:inherit;padding:8px;margin:8px 12px 20px 0}article[hidden]{display:none}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style></head><body><main><h1>Capitalism Plus · Original ink</h1><p>69 original-pixel extractions. Paper and shading become transparency; original pen strokes remain. Ten Hens has an added thin frame.</p><input type="search" aria-label="Search cards" placeholder="Find a card"><label>Background <select><option value="#fff">White</option><option value="#f2e4c7">Warm paper</option><option value="#d7e9ee">Pale blue</option></select></label><div class="grid">''' + ''.join(rows) + '''</div></main><script>document.querySelector('input').oninput=e=>{for(const a of document.querySelectorAll('article'))a.hidden=!a.querySelector('h2').textContent.toLowerCase().includes(e.target.value.toLowerCase())};document.querySelector('select').onchange=e=>document.body.style.setProperty('--paper',e.target.value);</script></body></html>''')
print(f'Extracted {len(rows)} transparent original-ink illustrations, including framed Ten Hens.')
