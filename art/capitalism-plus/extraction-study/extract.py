"""Conservative pixel extraction for the three-method comparison.
Requires Pillow, numpy, opencv-python-headless. No generation or repainting.
"""
from pathlib import Path
import shutil
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
INK = (38, 63, 57)
for slug in ['lizard-pal', 'fraud-fred', 'ten-hens']:
    source = ROOT.parent / 'illustrations' / f'{slug}.png'
    shutil.copy2(source, ROOT / f'{slug}-original.png')
    rgba = np.array(Image.open(source).convert('RGBA'))
    # Red channel gives strong contrast against the green pen; restore undefined
    # RGB in transparent crop corners to nearby paper intensity before filtering.
    channel = rgba[:, :, 0].copy()
    visible = rgba[:, :, 3] > 0
    channel[~visible] = int(np.median(channel[visible]))
    # Estimate locally lit paper without ink, then divide to flatten shadows.
    paper = cv2.morphologyEx(channel, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    paper = cv2.GaussianBlur(paper.astype(np.float32), (0, 0), 8)
    contrast = np.maximum(0, (paper - channel) / np.maximum(paper, 1))
    black, span = {'lizard-pal': (.07, .42), 'fraud-fred': (.06, .42), 'ten-hens': (.05, .35)}[slug]
    alpha = np.clip((contrast - black) / span, 0, 1)
    alpha *= rgba[:, :, 3] / 255.0
    # Explicit mask of the printed divider along the bottom edge; no ink repair.
    h, w = alpha.shape
    if slug == 'fraud-fred':
        for x in range(int(w * .70), w):
            alpha[max(0, int(h - 2 - (x / w - .70) * 13)):, x] = 0
    if slug == 'ten-hens':
        alpha[:80, :4] = 0  # Photographed paper edge at upper left.
        for x in range(int(w * .49), w):
            alpha[max(0, int(h - (x / w - .49) * 33)):, x] = 0
    result = np.zeros_like(rgba)
    result[:, :, :3] = INK
    result[:, :, 3] = np.round(alpha * 255).astype(np.uint8)
    Image.fromarray(result).save(ROOT / f'{slug}-pixels.png')
    # The SVG traces this same mask, using a fixed cutoff and no speck filtering.
    binary = np.where(alpha >= .30, 0, 255).astype(np.uint8)
    Image.fromarray(binary).save(ROOT / f'{slug}-trace-input.png')
    print(slug, 'size', (w, h), 'nontransparent pixels', int((alpha > 0).sum()))
