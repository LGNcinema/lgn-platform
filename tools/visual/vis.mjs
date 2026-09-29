#!/usr/bin/env node
// Render the running site at design width and compare it against a Figma export.
//
//   node vis.mjs shoot "<query>" out/render.png          e.g. "?view=campfire"
//   node vis.mjs diff  design.png out/render.png out/diff.png
//   node vis.mjs crop  in.png out/crop.png  x,y,w,h      (coords in the PNG's own pixels)
//
// Renders at 1920 CSS px and deviceScaleFactor 2, so a render lines up pixel for
// pixel with Figma's @2x exports (3840 px wide). `diff` uses a CSS
// `mix-blend-mode: difference` overlay: identical pixels come out black, so
// anything bright is a mismatch. Text will never be black -- the frames are set
// in Helvetica Neue and the site in Inter -- so read diffs for layout, spacing,
// sizing and color, not for glyph shapes.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE = process.env.VIS_BASE || 'http://localhost:5173/';
const [cmd, ...args] = process.argv.slice(2);

const ensureDir = (p) => mkdirSync(dirname(resolve(p)), { recursive: true });
const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const pngSize = (p) => { const b = readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

async function withPage(fn, viewport = { width: 1920, height: 1080 }, dpr = 2) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: dpr });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function shoot(query, out) {
  ensureDir(out);
  await withPage(async (page) => {
    await page.goto(new URL(query, BASE).href, { waitUntil: 'networkidle' });
    // The dev-only floating buttons (Theme, Grid Overlay, Geme Tuning) render on
    // localhost and are in no Figma frame -- hide them or every diff shows them.
    await page.addStyleTag({ content: '.grid-toggle-btn{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance transitions and image decodes settle.
    await page.waitForTimeout(600);
    await page.screenshot({ path: out, fullPage: true });
  });
  const { w, h } = pngSize(out);
  console.log(`shot ${query} -> ${out}  (${w}x${h}, i.e. ${w / 2}x${h / 2} CSS px)`);
}

async function diff(design, render, out) {
  ensureDir(out);
  const a = pngSize(design), b = pngSize(render);
  const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h);
  await withPage(async (page) => {
    await page.setContent(`<!doctype html><style>
      html,body{margin:0;background:#000}
      .s{position:relative;width:${w}px;height:${h}px}
      .s img{position:absolute;left:0;top:0}
      .s img+img{mix-blend-mode:difference}
    </style><div class="s"><img src="${dataUrl(design)}"><img src="${dataUrl(render)}"></div>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.locator('.s').screenshot({ path: out });
  }, { width: w, height: h }, 1);
  console.log(`diff  design ${a.w}x${a.h}  vs  render ${b.w}x${b.h}  -> ${out}`);
  if (a.h !== b.h) console.log(`      height differs by ${Math.abs(a.h - b.h) / 2} CSS px (render is ${b.h > a.h ? 'taller' : 'shorter'})`);
}

async function crop(input, out, box) {
  ensureDir(out);
  const [x, y, cw, ch] = box.split(',').map(Number);
  await withPage(async (page) => {
    await page.setContent(`<!doctype html><style>html,body{margin:0}
      .c{width:${cw}px;height:${ch}px;overflow:hidden;position:relative}
      .c img{position:absolute;left:${-x}px;top:${-y}px}</style>
      <div class="c"><img src="${dataUrl(input)}"></div>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.locator('.c').screenshot({ path: out });
  }, { width: cw, height: ch }, 1);
  console.log(`crop ${input} [${box}] -> ${out}`);
}

const usage = 'usage: vis.mjs shoot <query> <out> | diff <design> <render> <out> | crop <in> <out> <x,y,w,h>';
try {
  if (cmd === 'shoot' && args.length === 2) await shoot(...args);
  else if (cmd === 'diff' && args.length === 3) await diff(...args);
  else if (cmd === 'crop' && args.length === 3) await crop(...args);
  else { console.error(usage); process.exit(2); }
} catch (e) {
  console.error(`vis ${cmd} failed: ${e.message}`);
  process.exit(1);
}
