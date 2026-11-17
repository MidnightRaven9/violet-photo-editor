// Pure image-processing helpers. All operate on ImageData or canvases.

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

export function computeWhiteBalanceFactors(imageData) {
  const r = [], g = [], b = [];
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
  }
  r.sort((a, c) => a - c); g.sort((a, c) => a - c); b.sort((a, c) => a - c);
  const pr = percentile(r, 0.95);
  const pg = percentile(g, 0.95);
  const pb = percentile(b, 0.95);
  const avg = (pr + pg + pb) / 3 || 1;
  let sr = avg / (pr || 1);
  let sg = avg / (pg || 1);
  let sb = avg / (pb || 1);
  sr = clamp(sr, 0.5, 2); sg = clamp(sg, 0.5, 2); sb = clamp(sb, 0.5, 2);
  return { sr, sg, sb };
}

export function computeEnhanceParams(imageData) {
  const r = [], g = [], b = [];
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
  }
  r.sort((a, c) => a - c); g.sort((a, c) => a - c); b.sort((a, c) => a - c);
  const br = percentile(r, 0.01), gr = percentile(g, 0.01), blr = percentile(b, 0.01);
  const wr = percentile(r, 0.99), wg = percentile(g, 0.99), wb = percentile(b, 0.99);
  return {
    black: { r: br, g: gr, b: blr },
    white: { r: Math.max(wr, br + 1), g: Math.max(wg, gr + 1), b: Math.max(wb, blr + 1) },
  };
}

export function buildGeometryCanvas(img, rotation, crop) {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const W = Math.max(1, Math.round(w0 * cos + h0 * sin));
  const H = Math.max(1, Math.round(w0 * sin + h0 * cos));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -w0 / 2, -h0 / 2);
  if (crop) {
    const cw = Math.max(1, Math.min(crop.w, W - crop.x));
    const ch = Math.max(1, Math.min(crop.h, H - crop.y));
    const cx = clamp(crop.x, 0, W - 1);
    const cy = clamp(crop.y, 0, H - 1);
    const cc = document.createElement('canvas');
    cc.width = cw; cc.height = ch;
    const cctx = cc.getContext('2d');
    cctx.drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
    return cc;
  }
  return c;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// 3x3 median filter — removes hot pixels / color noise.
function medianPass(out, amount) {
  const w = out.width, h = out.height;
  const src = new Uint8ClampedArray(out.data);
  const d = out.data;
  const vals = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            vals[k++] = src[((y + ky) * w + (x + kx)) * 4 + ch];
          }
        }
        vals.sort((a, b) => a - b);
        d[i + ch] = src[i + ch] + amount * (vals[4] - src[i + ch]);
      }
    }
  }
}

// Separable box blur on RGB channels, O(px) via prefix sums.
function boxBlurRGB(data, w, h, radius) {
  const tmp = new Float32Array(w * h * 3);
  const outB = new Float32Array(w * h * 3);
  const r = Math.max(1, Math.round(radius));
  const pref = new Float64Array((w > h ? w : h) + 1);

  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let ch = 0; ch < 3; ch++) {
      pref[0] = 0;
      for (let x = 0; x < w; x++) pref[x + 1] = pref[x] + data[(row + x) * 4 + ch];
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w - 1, x + r);
        tmp[(row + x) * 3 + ch] = (pref[x1 + 1] - pref[x0]) / (x1 - x0 + 1);
      }
    }
  }

  // vertical
  for (let x = 0; x < w; x++) {
    for (let ch = 0; ch < 3; ch++) {
      pref[0] = 0;
      for (let y = 0; y < h; y++) pref[y + 1] = pref[y] + tmp[(y * w + x) * 3 + ch];
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(h - 1, y + r);
        outB[(y * w + x) * 3 + ch] = (pref[y1 + 1] - pref[y0]) / (y1 - y0 + 1);
      }
    }
  }
  return outB;
}

// ---- artistic effect helpers ----

function luminance(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function sobelMagnitude(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) gray[p] = luminance(data, i);
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
        + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

function applySketch(out, kind) {
  const w = out.width, h = out.height, d = out.data;
  const mag = sobelMagnitude(d, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      let v;
      if (kind === 'ink') v = mag[p] > 90 ? 0 : 255;
      else if (kind === 'xdog') v = mag[p] > 45 ? 0 : 255;
      else v = 255 - clamp(mag[p] * (kind === 'pencil' ? 2.4 : 3.2), 0, 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
}

function applyToon(out) {
  const w = out.width, h = out.height, d = out.data;
  const mag = sobelMagnitude(d, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      const edge = clamp(mag[p] * 1.4, 0, 90);
      for (let ch = 0; ch < 3; ch++) d[i + ch] = clamp(d[i + ch] - edge, 0, 255);
    }
  }
}

function applyHalftone(out) {
  const w = out.width, h = out.height, d = out.data;
  const src = new Uint8ClampedArray(d);
  const cell = 4;
  for (let by = 0; by < h; by += cell) {
    for (let bx = 0; bx < w; bx += cell) {
      let sum = 0, cnt = 0;
      for (let y = by; y < Math.min(h, by + cell); y++) {
        for (let x = bx; x < Math.min(w, bx + cell); x++) {
          sum += luminance(src, (y * w + x) * 4); cnt++;
        }
      }
      const lum = sum / Math.max(1, cnt);
      const radius = (1 - lum / 255) * (cell * 0.62);
      const cx = bx + cell / 2, cy = by + cell / 2;
      for (let y = by; y < Math.min(h, by + cell); y++) {
        for (let x = bx; x < Math.min(w, bx + cell); x++) {
          const i = (y * w + x) * 4;
          const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          const v = dist < radius ? 0 : 255;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
    }
  }
}

function applyPixelate(out, block) {
  const w = out.width, h = out.height, d = out.data;
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let y = by; y < Math.min(h, by + block); y++) {
        for (let x = bx; x < Math.min(w, bx + block); x++) {
          const i = (y * w + x) * 4;
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++;
        }
      }
      sr /= cnt; sg /= cnt; sb /= cnt;
      for (let y = by; y < Math.min(h, by + block); y++) {
        for (let x = bx; x < Math.min(w, bx + block); x++) {
          const i = (y * w + x) * 4;
          d[i] = sr; d[i + 1] = sg; d[i + 2] = sb;
        }
      }
    }
  }
}

function applyThermal(out) {
  const stops = [
    [0, 0, 20, 60], [0.25, 0, 170, 200], [0.5, 60, 220, 120],
    [0.72, 255, 200, 40], [0.88, 255, 90, 20], [1, 255, 255, 220],
  ];
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = clamp(luminance(d, i) / 255, 0, 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1];
    const f = (t - a[0]) / (b[0] - a[0] || 1);
    d[i] = a[1] + (b[1] - a[1]) * f;
    d[i + 1] = a[2] + (b[2] - a[2]) * f;
    d[i + 2] = a[3] + (b[3] - a[3]) * f;
  }
}

function applyWarhol(out) {
  const w = out.width, h = out.height, d = out.data;
  const shifts = [0, 120, 240, 60];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const q = (y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1);
      let [hh, ss, ll] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      hh = (hh + shifts[q] / 360) % 1;
      const [r, g, b] = hslToRgb(hh, clamp(ss * 1.5 + 0.3, 0, 1), ll);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
}

function applyWatercolor(out) {
  const w = out.width, h = out.height, d = out.data;
  const blur = boxBlurRGB(d, w, h, 2);
  const levels = 6, step = 255 / (levels - 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = (y * w + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        const v = d[i + ch] * 0.55 + blur[o + ch] * 0.45;
        d[i + ch] = Math.round(v / step) * step;
      }
    }
  }
}

function applyNeon(out) {
  const w = out.width, h = out.height, d = out.data;
  const mag = sobelMagnitude(d, w, h);
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      const e = clamp(mag[p] * 2.2, 0, 255);
      const base = luminance(src, i) * 0.25;
      d[i] = clamp(base + e * 0.9, 0, 255);
      d[i + 1] = clamp(base + e * 0.15, 0, 255);
      d[i + 2] = clamp(base + e, 0, 255);
    }
  }
}

function applyEffect(out, effect) {
  switch (effect) {
    case 'negative':
      for (let i = 0; i < out.data.length; i += 4) {
        out.data[i] = 255 - out.data[i];
        out.data[i + 1] = 255 - out.data[i + 1];
        out.data[i + 2] = 255 - out.data[i + 2];
      }
      break;
    case 'sketch': applySketch(out, 'sketch'); break;
    case 'pencil': applySketch(out, 'pencil'); break;
    case 'ink': applySketch(out, 'ink'); break;
    case 'xdog': applySketch(out, 'xdog'); break;
    case 'toon': applyToon(out); break;
    case 'halftone': applyHalftone(out); break;
    case 'mosaic': applyPixelate(out, 8); break;
    case 'pixelate': applyPixelate(out, 12); break;
    case 'thermal': applyThermal(out); break;
    case 'warhol': applyWarhol(out); break;
    case 'oil': applyPixelate(out, 2); break;
    case 'watercolor': applyWatercolor(out); break;
    case 'neon': applyNeon(out); break;
    default: break;
  }
}

export function blendImageData(a, b, t) {
  const out = new ImageData(new Uint8ClampedArray(a.data), a.width, a.height);
  const d = out.data, bd = b.data;
  const inv = 1 - t;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = a.data[i] * inv + bd[i] * t;
    d[i + 1] = a.data[i + 1] * inv + bd[i + 1] * t;
    d[i + 2] = a.data[i + 2] * inv + bd[i + 2] * t;
  }
  return out;
}

export function hasManualAdjustments(s) {
  if (!s) return false;
  if (s.autoColor || s.autoEnhance) return true;
  return [
    'brightness', 'contrast', 'exposure', 'saturation', 'vibrance', 'hue',
    'temperature', 'tint', 'sharpness', 'clarity', 'denoise', 'soften', 'posterize',
  ].some((k) => (s[k] || 0) !== 0) || !!s.effect;
}

function autoSample(src) {
  const total = src.width * src.height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / 40000)));
  if (step === 1) return src;
  const w = Math.max(1, Math.floor(src.width / step));
  const h = Math.max(1, Math.floor(src.height / step));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y * step) * src.width + x * step) * 4;
      const di = (y * w + x) * 4;
      data[di] = src.data[si];
      data[di + 1] = src.data[si + 1];
      data[di + 2] = src.data[si + 2];
      data[di + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

// Apply a stack of presets. Each layer is blended with its input by strength.
export function applyStack(imageData, layers) {
  let current = imageData;
  for (const layer of layers) {
    if (!layer || layer.strength <= 0) continue;
    const preset = layer.preset;
    let ls = { ...DEFAULT_PRESET_BASE, ...preset.settings };
    if (ls.autoColor || ls.autoEnhance) {
      const sample = autoSample(current);
      if (ls.autoColor) ls.autoColorFactors = computeWhiteBalanceFactors(sample);
      if (ls.autoEnhance) ls.autoEnhanceParams = computeEnhanceParams(sample);
    }
    const filtered = applyColor(current, ls);
    current = blendImageData(current, filtered, layer.strength / 100);
  }
  return current;
}

export const DEFAULT_PRESET_BASE = {
  autoColor: false,
  autoEnhance: false,
  autoColorFactors: null,
  autoEnhanceParams: null,
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  clarity: 0,
  denoise: 0,
  soften: 0,
  posterize: 0,
  effect: null,
};

export function applyColor(src, settings) {
  const w = src.width, h = src.height;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  const d = out.data;
  const s = settings;

  // 1. denoise / hot-pixel removal first
  const denoise = (s.denoise || 0) / 100;
  if (denoise > 0) medianPass(out, denoise);

  // 2. color grading
  const brightness = (s.brightness || 0) / 100;
  const contrast = s.contrast || 0;
  const exposure = s.exposure || 0;
  const temperature = s.temperature || 0;
  const tint = s.tint || 0;
  const saturation = (s.saturation || 0) / 100;
  const vibrance = (s.vibrance || 0) / 100;
  const hueShift = (s.hue || 0) / 360;
  const cf = s.autoColorFactors;
  const ep = s.autoEnhanceParams;
  const expFactor = Math.pow(2, exposure / 50);
  const contrastFactor = contrast === 0 ? 1 : (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satMulAuto = s.autoEnhance ? 1.15 : 1;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];

    if (s.autoColor && cf) {
      r = clamp(r * cf.sr, 0, 255);
      g = clamp(g * cf.sg, 0, 255);
      b = clamp(b * cf.sb, 0, 255);
    }

    if (s.autoEnhance && ep) {
      const br = ep.black, wh = ep.white;
      r = clamp((r - br.r) * 255 / (wh.r - br.r), 0, 255);
      g = clamp((g - br.g) * 255 / (wh.g - br.g), 0, 255);
      b = clamp((b - br.b) * 255 / (wh.b - br.b), 0, 255);
      const [hh, ss, ll] = rgbToHsl(r, g, b);
      const [rr, gg, bb] = hslToRgb(hh, Math.min(1, ss * satMulAuto), ll);
      r = rr; g = gg; b = bb;
    }

    r = clamp(r * expFactor, 0, 255);
    g = clamp(g * expFactor, 0, 255);
    b = clamp(b * expFactor, 0, 255);

    r = clamp(r + brightness * 255, 0, 255);
    g = clamp(g + brightness * 255, 0, 255);
    b = clamp(b + brightness * 255, 0, 255);

    r = clamp(contrastFactor * (r - 128) + 128, 0, 255);
    g = clamp(contrastFactor * (g - 128) + 128, 0, 255);
    b = clamp(contrastFactor * (b - 128) + 128, 0, 255);

    r = clamp(r + temperature * 1.2, 0, 255);
    b = clamp(b - temperature * 1.2, 0, 255);

    g = clamp(g + tint * 1.2, 0, 255);
    r = clamp(r - tint * 0.6, 0, 255);
    b = clamp(b - tint * 0.6, 0, 255);

    if (saturation !== 0 || vibrance !== 0 || hueShift !== 0) {
      let [hh, ss, ll] = rgbToHsl(r, g, b);
      if (hueShift) hh = (hh + hueShift + 1) % 1;
      let ns = ss;
      if (saturation) ns = clamp(ns + saturation, 0, 1);
      if (vibrance) ns = clamp(ns + vibrance * (1 - ns) * 0.9, 0, 1);
      const [rr, gg, bb] = hslToRgb(hh, ns, ll);
      r = rr; g = gg; b = bb;
    }

    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }

  // 2b. posterize
  const posterize = s.posterize || 0;
  if (posterize >= 2) {
    const levels = Math.min(32, Math.round(posterize));
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step;
      d[i + 1] = Math.round(d[i + 1] / step) * step;
      d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
  }

  // 3. clarity — local contrast (large-radius unsharp mask)
  const clarity = (s.clarity || 0) / 100;
  if (clarity > 0) {
    const radius = Math.max(2, Math.round(Math.min(w, h) / 100));
    const blur = boxBlurRGB(out.data, w, h, radius);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const o = (y * w + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const orig = d[i + ch];
          d[i + ch] = clamp(orig + clarity * (orig - blur[o + ch]), 0, 255);
        }
      }
    }
  }

  // 4. soften — blur blend
  const soften = (s.soften || 0) / 100;
  if (soften > 0) {
    const blur = boxBlurRGB(out.data, w, h, 2 + Math.round(soften * 4));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const o = (y * w + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          d[i + ch] = clamp(d[i + ch] + soften * (blur[o + ch] - d[i + ch]), 0, 255);
        }
      }
    }
  }

  // 5. sharpness — small-radius unsharp mask
  const sharp = s.sharpness || 0;
  if (sharp > 0) {
    const amt = sharp / 100;
    const src2 = new Uint8ClampedArray(out.data);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let ch = 0; ch < 3; ch++) {
          let acc = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * w + (x + kx)) * 4 + ch;
              const k = kernel[(ky + 1) * 3 + (kx + 1)];
              acc += src2[idx] * k;
            }
          }
          const iidx = (y * w + x) * 4 + ch;
          const orig = src2[iidx];
          d[iidx] = clamp(orig + amt * (acc - orig), 0, 255);
        }
      }
    }
  }

  if (s.effect) applyEffect(out, s.effect);

  return out;
}
