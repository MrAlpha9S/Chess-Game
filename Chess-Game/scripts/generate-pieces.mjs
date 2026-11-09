/**
 * Generate the chess piece sprites.
 *
 * The game ships twelve 512x512 PNGs with a transparent background:
 *   public/assets/pieces/{white,black}/{pawn,knight,bishop,rook,queen,king}.png
 *
 * The silhouettes are drawn from scratch as vector paths and rasterised here,
 * so the repository carries no third-party artwork and no build-time
 * dependency on an image toolchain.
 *
 * Run with: node scripts/generate-pieces.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ *
 * Path building
 * ------------------------------------------------------------------ */

/** A path is a list of contours; each contour is a list of [x, y] points. */
class Path {
  constructor() {
    this.contours = [];
    this.current = null;
  }

  moveTo(x, y) {
    this.current = [[x, y]];
    this.contours.push(this.current);
    return this;
  }

  lineTo(x, y) {
    this.current.push([x, y]);
    return this;
  }

  /** Cubic bezier, flattened into line segments. */
  curveTo(c1x, c1y, c2x, c2y, x, y) {
    const start = this.current[this.current.length - 1];
    const [x0, y0] = start;
    const segments = 24;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const px =
        mt * mt * mt * x0 +
        3 * mt * mt * t * c1x +
        3 * mt * t * t * c2x +
        t * t * t * x;
      const py =
        mt * mt * mt * y0 +
        3 * mt * mt * t * c1y +
        3 * mt * t * t * c2y +
        t * t * t * y;
      this.current.push([px, py]);
    }
    return this;
  }

  /** A circular arc from angle a0 to a1, counter-clockwise in maths space. */
  arc(cx, cy, r, a0, a1) {
    const segments = Math.max(8, Math.ceil((Math.abs(a1 - a0) / (Math.PI / 2)) * 16));
    for (let i = 0; i <= segments; i++) {
      const a = a0 + ((a1 - a0) * i) / segments;
      this.current.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r]);
    }
    return this;
  }

  circle(cx, cy, r) {
    const k = 0.5522847498307936 * r;
    this.moveTo(cx + r, cy);
    this.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
    this.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    this.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    this.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    return this;
  }

  /** A rectangle, wound clockwise. */
  rect(x, y, w, h) {
    return this.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h);
  }
}

/* ------------------------------------------------------------------ *
 * Rasterising
 * ------------------------------------------------------------------ */

/**
 * Rasterise a path into a coverage mask.
 *
 * The mask holds a value from 0 to 255 per pixel. Each pixel row is sampled
 * at four sub-rows and the horizontal coverage of each span is computed
 * exactly, which gives clean antialiased edges.
 */
function rasterize(path) {
  const mask = new Float32Array(SIZE * SIZE);
  const SUBSAMPLES = 4;

  // Flatten every contour into edges.
  const edges = [];
  for (const contour of path.contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i];
      const b = contour[(i + 1) % contour.length];
      if (a[1] === b[1]) continue;
      edges.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1] });
    }
  }

  for (let py = 0; py < SIZE; py++) {
    for (let s = 0; s < SUBSAMPLES; s++) {
      const sy = py + (s + 0.5) / SUBSAMPLES;
      const crossings = [];
      for (const e of edges) {
        const { y0, y1 } = e;
        if (sy < Math.min(y0, y1) || sy >= Math.max(y0, y1)) continue;
        const t = (sy - y0) / (y1 - y0);
        crossings.push({ x: e.x0 + t * (e.x1 - e.x0), dir: y1 > y0 ? 1 : -1 });
      }
      if (crossings.length < 2) continue;

      crossings.sort((a, b) => a.x - b.x);

      // Nonzero winding: walk the crossings and fill where the winding is
      // non-zero.
      let winding = 0;
      for (let i = 0; i < crossings.length - 1; i++) {
        winding += crossings[i].dir;
        if (winding === 0) continue;

        const spanStart = crossings[i].x;
        const spanEnd = crossings[i + 1].x;
        if (spanEnd <= 0 || spanStart >= SIZE) continue;

        const from = Math.max(0, Math.floor(spanStart));
        const to = Math.min(SIZE - 1, Math.ceil(spanEnd) - 1);
        for (let px = from; px <= to; px++) {
          const left = Math.max(spanStart, px);
          const right = Math.min(spanEnd, px + 1);
          if (right <= left) continue;
          mask[py * SIZE + px] += (right - left) / SUBSAMPLES;
        }
      }
    }
  }

  // Clamp to 0..1 and convert to 0..255.
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Math.min(1, mask[i]) * 255;
  }
  return mask;
}

/** Grow a mask by the given radius, for the outline. */
function dilate(mask, radius) {
  const out = new Float32Array(SIZE * SIZE);
  const r2 = radius * radius;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (mask[y * SIZE + x] <= 0) continue;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(SIZE - 1, y + radius);
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(SIZE - 1, x + radius);
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          if (dx * dx + dy * dy > r2) continue;
          const i = ny * SIZE + nx;
          if (mask[i] > out[i]) out[i] = mask[i];
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * PNG encoding
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Encode an RGBA pixel buffer as a PNG. */
function encodePng(rgba) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (SIZE * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Piece artwork
 * ------------------------------------------------------------------ */

const CX = 256;

/** The pedestal every piece stands on. */
function pedestal(path) {
  path
    .moveTo(148, 470)
    .lineTo(364, 470)
    .lineTo(364, 432)
    .curveTo(340, 432, 322, 424, 312, 412)
    .lineTo(200, 412)
    .curveTo(190, 424, 172, 432, 148, 432)
    ;;
  return path;
}

/** The pawn. */
function drawPawn() {
  const p = new Path();
  p.circle(CX, 152, 58);
  p.moveTo(214, 214)
    .lineTo(298, 214)
    .lineTo(306, 248)
    .lineTo(206, 248)
    ;;
  p.moveTo(226, 252)
    .curveTo(206, 300, 194, 350, 190, 410)
    .lineTo(322, 410)
    .curveTo(318, 350, 306, 300, 286, 252)
    ;;
  pedestal(p);
  return p;
}

/** The rook. */
function drawRook() {
  const p = new Path();
  // Crenellations.
  p.moveTo(178, 108).lineTo(334, 108).lineTo(334, 168).lineTo(178, 168);;
  p.rect(178, 108, 36, 26);
  p.rect(240, 108, 32, 26);
  p.rect(298, 108, 36, 26);
  // Body.
  p.moveTo(200, 168)
    .lineTo(312, 168)
    .curveTo(316, 260, 312, 340, 322, 412)
    .lineTo(190, 412)
    .curveTo(200, 340, 196, 260, 200, 168)
    ;;
  // Collar.
  p.moveTo(190, 168).lineTo(322, 168).lineTo(322, 196).lineTo(190, 196);;
  pedestal(p);
  return p;
}

/** The bishop. */
function drawBishop() {
  const p = new Path();
  // Mitre.
  p.moveTo(CX, 62)
    .curveTo(302, 128, 310, 176, 292, 214)
    .lineTo(220, 214)
    .curveTo(202, 176, 210, 128, CX, 62)
    ;;
  // The slit in the mitre.
  p.moveTo(276, 96).lineTo(258, 150).lineTo(274, 150).lineTo(292, 100);;
  // Collar.
  p.moveTo(206, 214).lineTo(306, 214).lineTo(314, 250).lineTo(198, 250);;
  // Body.
  p.moveTo(228, 254)
    .curveTo(210, 300, 198, 352, 194, 412)
    .lineTo(318, 412)
    .curveTo(314, 352, 302, 300, 284, 254)
    ;;
  pedestal(p);
  return p;
}

/** The knight. */
function drawKnight() {
  const p = new Path();
  p.moveTo(300, 60)
    .curveTo(330, 92, 336, 140, 330, 190)
    .curveTo(324, 236, 306, 266, 300, 296)
    .lineTo(316, 300)
    .curveTo(330, 306, 330, 322, 318, 330)
    .lineTo(300, 342)
    .lineTo(316, 372)
    .lineTo(330, 402)
    .lineTo(190, 412)
    .curveTo(196, 372, 208, 344, 226, 322)
    .curveTo(244, 300, 268, 288, 292, 280)
    .curveTo(298, 258, 290, 236, 272, 220)
    .curveTo(252, 202, 228, 196, 210, 202)
    .curveTo(212, 176, 226, 150, 250, 132)
    .curveTo(268, 118, 288, 104, 300, 60)
    ;;
  // The eye.
  p.circle(276, 150, 9);
  // The mane.
  p.moveTo(302, 74)
    .curveTo(316, 118, 322, 160, 318, 200)
    .curveTo(312, 232, 300, 254, 296, 268)
    .lineTo(282, 262)
    .curveTo(292, 240, 298, 214, 300, 188)
    .curveTo(302, 150, 300, 110, 294, 80)
    ;;
  pedestal(p);
  return p;
}

/** The queen. */
function drawQueen() {
  const p = new Path();
  // Crown with five points.
  p.moveTo(170, 300)
    .lineTo(146, 132)
    .lineTo(196, 200)
    .lineTo(256, 96)
    .lineTo(316, 200)
    .lineTo(366, 132)
    .lineTo(342, 300)
    ;;
  // Orbs on the points.
  p.circle(146, 122, 16);
  p.circle(196, 190, 13);
  p.circle(256, 86, 18);
  p.circle(316, 190, 13);
  p.circle(366, 122, 16);
  // Collar.
  p.moveTo(168, 300).lineTo(344, 300).lineTo(336, 336).lineTo(176, 336);;
  // Body.
  p.moveTo(206, 340)
    .curveTo(196, 372, 190, 392, 188, 412)
    .lineTo(324, 412)
    .curveTo(322, 392, 316, 372, 306, 340)
    ;;
  pedestal(p);
  return p;
}

/** The king. */
function drawKing() {
  const p = new Path();
  // The cross.
  p.rect(244, 44, 24, 78);
  p.rect(216, 70, 80, 24);
  // Crown band.
  p.moveTo(180, 216)
    .lineTo(332, 216)
    .lineTo(344, 158)
    .lineTo(306, 196)
    .lineTo(286, 140)
    .lineTo(256, 186)
    .lineTo(226, 140)
    .lineTo(206, 196)
    .lineTo(168, 158)
    ;;
  // Body.
  p.moveTo(180, 216).lineTo(332, 216).lineTo(326, 262).lineTo(186, 262);;
  p.moveTo(212, 266)
    .curveTo(200, 320, 192, 366, 190, 412)
    .lineTo(322, 412)
    .curveTo(320, 366, 312, 320, 300, 266)
    ;;
  pedestal(p);
  return p;
}

const PIECES = {
  pawn: drawPawn,
  knight: drawKnight,
  bishop: drawBishop,
  rook: drawRook,
  queen: drawQueen,
  king: drawKing,
};

const COLOURS = {
  white: { fill: [242, 240, 232], outline: [58, 56, 50] },
  black: { fill: [40, 40, 44], outline: [214, 210, 198] },
};

/**
 * Render one piece into an RGBA buffer.
 */
function renderPiece(drawPath, colour) {
  const mask = rasterize(drawPath());
  const grown = dilate(mask, 6);

  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const fillAlpha = mask[i] / 255;
      const outlineAlpha = Math.max(0, grown[i] - mask[i]) / 255;
      const alpha = Math.max(fillAlpha, outlineAlpha);
      if (alpha <= 0) continue;

      // A soft vertical gradient gives the pieces a little depth.
      const t = y / SIZE;
      const shade = 1 - t * 0.18;
      const base = fillAlpha > 0 ? colour.fill : colour.outline;
      const r = Math.round(base[0] * shade);
      const g = Math.round(base[1] * shade);
      const b = Math.round(base[2] * shade);

      const o = i * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

let written = 0;
for (const [colour, palette] of Object.entries(COLOURS)) {
  const dir = join(ROOT, 'public', 'assets', 'pieces', colour);
  mkdirSync(dir, { recursive: true });

  for (const [name, draw] of Object.entries(PIECES)) {
    const png = encodePng(renderPiece(draw, palette));
    writeFileSync(join(dir, `${name}.png`), png);
    written++;
    console.log(`  ${colour}/${name}.png (${png.length} bytes)`);
  }
}

console.log(`\nWrote ${written} piece sprites.`);
