// Генерация PNG-иконок для домашнего экрана (iOS не умеет SVG в apple-touch-icon).
// Запуск: node bim/build-icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "icons");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    pixels.copy(raw, p, y * size * 4, (y + 1) * size * 4);
    p += size * 4;
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c1 = [79, 124, 247];
  const c2 = [124, 108, 245];
  const s = size / 128;
  const cx = 64 * s;
  const cy = 62 * s;
  const w = 34 * s;
  const faces = [
    { pts: [[0, -w], [w, -w / 2], [0, 0], [-w, -w / 2]], a: 1 },
    { pts: [[-w, -w / 2], [0, 0], [0, w], [-w, w / 2]], a: 0.72 },
    { pts: [[w, -w / 2], [0, 0], [0, w], [w, w / 2]], a: 0.88 }
  ];
  const barY = 106 * s;
  const barH = 3 * s;
  const barX0 = 40 * s;
  const barX1 = 88 * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x / size + y / size) / 2;
      let col = mix(c1, c2, t);
      const lx = x - cx;
      const ly = y - cy;
      for (const f of faces) {
        if (inPoly(lx, ly, f.pts)) {
          col = mix(col, [255, 255, 255], f.a);
          break;
        }
      }
      if (y > barY - barH && y < barY + barH && x > barX0 && x < barX1) {
        col = mix(col, [255, 255, 255], 0.85);
      }
      const i = (y * size + x) * 4;
      px[i] = Math.round(col[0]);
      px[i + 1] = Math.round(col[1]);
      px[i + 2] = Math.round(col[2]);
      px[i + 3] = 255;
    }
  }
  return px;
}

[180, 192, 512].forEach((size) => {
  const file = path.join(OUT, "bim-icon-" + size + ".png");
  const bytes = writePng(file, size, render(size));
  console.log("создано", path.basename(file), bytes, "байт");
});
