import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './icons.jsx';
import {
  loadImage,
  buildGeometryCanvas,
  cropCanvas,
  applyColor,
  computeWhiteBalanceFactors,
  computeEnhanceParams,
  clamp,
  applyStack,
  hasManualAdjustments,
} from './process.js';

const MAX_PREVIEW = 960;
const DEFAULT_SETTINGS = {
  autoColor: false,
  autoEnhance: false,
  autoColorFactors: null,
  autoEnhanceParams: null,
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  clarity: 0,
  denoise: 0,
  soften: 0,
  hue: 0,
  vibrance: 0,
  posterize: 0,
  effect: null,
};

const ENHANCEMENTS = [
  { id: 'auto', name: 'Auto Enhance', icon: 'sparkles', sub: 'Balanced light and color', settings: { autoEnhance: true } },
  { id: 'wb', name: 'Auto White Balance', icon: 'sun', sub: 'Remove color casts', settings: { autoColor: true } },
  { id: 'ai', name: 'Smart Enhance', icon: 'wand', sub: 'Light, color and clarity', settings: { autoEnhance: true, autoColor: true, clarity: 30, saturation: 15 } },
  { id: 'hdr', name: 'HDR', icon: 'contrast', sub: 'Lift shadows, tame highlights', settings: { clarity: 40, contrast: 15, saturation: 10 } },
  { id: 'dehaze', name: 'Dehaze', icon: 'droplet', sub: 'Cut through haze and fog', settings: { clarity: 35, contrast: 20, saturation: 15 } },
  { id: 'sharpen', name: 'Sharpen', icon: 'sharpen', sub: 'Crisper, defined edges', settings: { sharpness: 45 } },
  { id: 'highpass', name: 'High Pass', icon: 'sharpen', sub: 'Fine detail boost', settings: { sharpness: 70, clarity: 25 } },
  { id: 'details', name: 'Detail Equalizer', icon: 'sliders', sub: 'Reveal micro-contrast', settings: { clarity: 55 } },
  { id: 'deblur', name: 'Deblur', icon: 'sharpen', sub: 'Recover soft focus', settings: { sharpness: 65, contrast: 10 } },
  { id: 'denoise', name: 'Denoise', icon: 'droplet', sub: 'Smooth sensor grain', settings: { denoise: 55 } },
  { id: 'smooth', name: 'Smooth', icon: 'droplet', sub: 'Soft, skin-friendly finish', settings: { soften: 45, denoise: 25 } },
  { id: 'portrait', name: 'Portrait Light', icon: 'portrait', sub: 'Flattering skin tones', settings: { brightness: 12, exposure: 8, clarity: 15, temperature: 6 } },
  { id: 'vivid', name: 'Vivid', icon: 'palette', sub: 'Punchy, saturated color', settings: { saturation: 40, contrast: 20 } },
  { id: 'warm', name: 'Warm', icon: 'sun', sub: 'Golden, cozy tones', settings: { temperature: 32, saturation: 8 } },
  { id: 'cool', name: 'Cool', icon: 'snow', sub: 'Crisp blue cast', settings: { temperature: -32 } },
  { id: 'bw', name: 'Black & White', icon: 'contrast', sub: 'Classic monochrome', settings: { saturation: -100, contrast: 12 } },
  { id: 'vintage', name: 'Vintage', icon: 'camera', sub: 'Soft film nostalgia', settings: { temperature: 20, saturation: -20, contrast: -10 } },
  { id: 'fade', name: 'Fade', icon: 'sun', sub: 'Matte, lifted blacks', settings: { contrast: -22, brightness: 10 } },
  { id: 'cinema', name: 'Cinematic', icon: 'film', sub: 'Teal-and-orange drama', settings: { contrast: 18, temperature: -10, saturation: 15 } },
  { id: 'hotpixel', name: 'Remove Hot Pixels', icon: 'reset', sub: 'Clean up bright specks', settings: { denoise: 35 } },
];

const FILTER_CATS = [
  ['effects', 'Effects'],
  ['color', 'Color'],
  ['bw', 'B&W'],
  ['vintage', 'Vintage'],
  ['artistic', 'Artistic'],
  ['lut', 'LUT'],
];

const FILTERS = [
  // ---- Effects ----
  { id: 'spring', name: 'Spring', cat: 'effects', settings: { temperature: 6, saturation: 25, hue: -8, brightness: 6, vibrance: 15 } },
  { id: 'summer', name: 'Summer', cat: 'effects', settings: { temperature: 26, saturation: 30, contrast: 10, exposure: 5, vibrance: 20 } },
  { id: 'sunrise', name: 'Sunrise', cat: 'effects', settings: { temperature: 22, saturation: 18, exposure: 10, brightness: 8, vibrance: 15 } },
  { id: 'sunset', name: 'Sunset', cat: 'effects', settings: { temperature: 42, saturation: 30, contrast: 12, hue: 6 } },
  { id: 'autumn', name: 'Autumn', cat: 'effects', settings: { temperature: 45, saturation: 28, hue: 10, contrast: 8 } },
  { id: 'autumnTones', name: 'Autumn Tones', cat: 'effects', settings: { temperature: 30, saturation: 16, contrast: 5, brightness: 4 } },
  { id: 'winter', name: 'Winter', cat: 'effects', settings: { temperature: -35, saturation: 10, brightness: 8, contrast: 5 } },
  { id: 'twilight', name: 'Twilight', cat: 'effects', settings: { temperature: -12, saturation: 22, contrast: 12, hue: 20 } },
  { id: 'twilightShifted', name: 'Twilight Shifted', cat: 'effects', settings: { temperature: -20, saturation: 18, hue: 42, clarity: 15 } },
  { id: 'goldenHour', name: 'Golden Hour', cat: 'effects', settings: { temperature: 35, brightness: 8, saturation: 16, soften: 5, vibrance: 15 } },
  { id: 'tropical', name: 'Tropical', cat: 'effects', settings: { temperature: 10, saturation: 40, contrast: 12, clarity: 10, vibrance: 20 } },
  { id: 'daylight', name: 'Daylight', cat: 'effects', settings: { temperature: 8, saturation: 8, contrast: 5 } },
  { id: 'vivid', name: 'Vivid', cat: 'effects', settings: { saturation: 45, contrast: 20, vibrance: 25 } },
  { id: 'fade', name: 'Fade', cat: 'effects', settings: { contrast: -20, brightness: 10, saturation: -10 } },
  { id: 'cinematic', name: 'Cinematic', cat: 'effects', settings: { contrast: 18, temperature: -8, saturation: 12, vibrance: 18 } },
  { id: 'turbo', name: 'Turbo', cat: 'effects', settings: { saturation: 55, contrast: 30, vibrance: 30, clarity: 20 } },
  { id: 'viridis', name: 'Viridis', cat: 'effects', settings: { temperature: -10, saturation: 25, hue: 55, contrast: 12 } },
  { id: 'aurora', name: 'Aurora', cat: 'effects', settings: { temperature: -20, saturation: 35, hue: 70, contrast: 15 } },

  // ---- Color ----
  { id: 'boostChrom', name: 'Boost Chromaticity', cat: 'color', settings: { saturation: 30, vibrance: 30 } },
  { id: 'channelMix', name: 'Channel Mix', cat: 'color', settings: { temperature: 14, tint: 12, saturation: 15, contrast: 8 } },
  { id: 'colorBalance', name: 'Color Balance', cat: 'color', settings: { temperature: 8, tint: -8, saturation: 10 } },
  { id: 'colorTemperature', name: 'Color Temperature', cat: 'color', settings: { temperature: 22 } },
  { id: 'colorFilter', name: 'Color Filter', cat: 'color', settings: { saturation: 20, hue: 15, contrast: 10 } },
  { id: 'hue', name: 'Hue', cat: 'color', settings: { hue: 35, saturation: 15 } },
  { id: 'hueShift', name: 'Hue Shift', cat: 'color', settings: { hue: -35, saturation: 12 } },
  { id: 'posterize', name: 'Posterize', cat: 'color', settings: { posterize: 4 } },
  { id: 'luma', name: 'Luma', cat: 'color', settings: { saturation: -100, contrast: 25 } },
  { id: 'monochrome', name: 'Monochrome', cat: 'color', settings: { saturation: -100, contrast: 12 } },
  { id: 'falseColor', name: 'False Color', cat: 'color', settings: { hue: 120, saturation: 50, contrast: 20 } },
  { id: 'gradientMap', name: 'Gradient Map', cat: 'color', settings: { contrast: 22, saturation: -10, temperature: 10 } },
  { id: 'triTone', name: 'Tri Tone', cat: 'color', settings: { temperature: 15, saturation: 20, contrast: 15, hue: 15 } },
  { id: 'selectiveDesat', name: 'Selective Desaturation', cat: 'color', settings: { saturation: -25, vibrance: 25 } },
  { id: 'saturation', name: 'Saturation', cat: 'color', settings: { saturation: 35 } },
  { id: 'vibrance', name: 'Vibrance', cat: 'color', settings: { vibrance: 45 } },
  { id: 'warm', name: 'Warm', cat: 'color', settings: { temperature: 30, saturation: 10 } },
  { id: 'cool', name: 'Cool', cat: 'color', settings: { temperature: -30, saturation: 6 } },
  { id: 'infrared', name: 'Infrared', cat: 'color', settings: { saturation: 40, hue: 120, contrast: 20 } },
  { id: 'cyanotype', name: 'Cyanotype', cat: 'color', settings: { saturation: -40, temperature: -40, hue: 60, contrast: 15 } },

  // ---- B&W ----
  { id: 'bwFilm', name: 'Black and White Film', cat: 'bw', settings: { saturation: -100, contrast: 28, denoise: 10, clarity: 10 } },
  { id: 'grayscale', name: 'Gray Scale', cat: 'bw', settings: { saturation: -100 } },
  { id: 'noir', name: 'Noir', cat: 'bw', settings: { saturation: -100, contrast: 35, clarity: 12 } },
  { id: 'monoHigh', name: 'High Contrast Mono', cat: 'bw', settings: { saturation: -100, contrast: 45, brightness: -5 } },
  { id: 'sepia', name: 'Sepia', cat: 'bw', settings: { saturation: -60, temperature: 35, contrast: 8 } },
  { id: 'platinum', name: 'Platinum', cat: 'bw', settings: { saturation: -100, contrast: 20, brightness: 6, temperature: 5 } },

  // ---- Vintage ----
  { id: 'vintage', name: 'Vintage', cat: 'vintage', settings: { temperature: 20, saturation: -20, contrast: -10, soften: 10 } },
  { id: 'retro', name: 'Retro', cat: 'vintage', settings: { temperature: 25, saturation: -10, contrast: 8, vibrance: 10 } },
  { id: 'film', name: 'Film', cat: 'vintage', settings: { contrast: 12, saturation: -8, clarity: 8, denoise: 8 } },
  { id: 'kodachrome', name: 'Kodachrome', cat: 'vintage', settings: { temperature: 12, saturation: 25, contrast: 15, vibrance: 15 } },
  { id: 'polaroid', name: 'Polaroid', cat: 'vintage', settings: { temperature: 10, saturation: -15, contrast: -12, brightness: 8, soften: 8 } },
  { id: 'fadedFilm', name: 'Faded Film', cat: 'vintage', settings: { contrast: -25, brightness: 12, saturation: -20, temperature: 8 } },
  { id: 'lomo', name: 'Lomo', cat: 'vintage', settings: { saturation: 25, contrast: 25, clarity: 20 } },
  { id: 'crossProcess', name: 'Cross Process', cat: 'vintage', settings: { temperature: -15, tint: 15, saturation: 30, contrast: 20, hue: 10 } },
  { id: 'toyCamera', name: 'Toy Camera', cat: 'vintage', settings: { saturation: 20, contrast: 15, soften: 15 } },

  // ---- LUT ----
  { id: 'tealOrange', name: 'Teal & Orange', cat: 'lut', settings: { temperature: 10, tint: -10, saturation: 20, contrast: 15, hue: -8 } },
  { id: 'bleachBypass', name: 'Bleach Bypass', cat: 'lut', settings: { saturation: -30, contrast: 35, clarity: 20 } },
  { id: 'dayForNight', name: 'Day for Night', cat: 'lut', settings: { temperature: -30, brightness: -15, contrast: 15, saturation: -10 } },
  { id: 'matrixGreen', name: 'Matrix Green', cat: 'lut', settings: { tint: 25, saturation: 15, contrast: 20, hue: 40 } },
  { id: 'cyberpunk', name: 'Cyberpunk', cat: 'lut', settings: { temperature: -10, saturation: 45, hue: 60, contrast: 25, clarity: 15 } },
  { id: 'orangeSunset', name: 'Orange Sunset', cat: 'lut', settings: { temperature: 40, saturation: 30, contrast: 15 } },
  { id: 'blueSteel', name: 'Blue Steel', cat: 'lut', settings: { temperature: -35, saturation: 10, contrast: 15 } },
  { id: 'moody', name: 'Moody', cat: 'lut', settings: { brightness: -10, contrast: 20, saturation: -10, clarity: 15 } },
  { id: 'dreamy', name: 'Dreamy', cat: 'lut', settings: { brightness: 8, soften: 25, saturation: 10, temperature: 10 } },
  { id: 'neonCity', name: 'Neon City', cat: 'lut', settings: { effect: 'neon', saturation: 20 } },

  // ---- Artistic ----
  { id: 'sketch', name: 'Sketch', cat: 'artistic', settings: { effect: 'sketch' } },
  { id: 'pencil', name: 'Pencil Drawing', cat: 'artistic', settings: { effect: 'pencil' } },
  { id: 'graphite', name: 'Graphite', cat: 'artistic', settings: { effect: 'pencil', contrast: 20 } },
  { id: 'charcoal', name: 'Charcoal', cat: 'artistic', settings: { effect: 'xdog', contrast: 15 } },
  { id: 'inkDrawing', name: 'Ink Drawing', cat: 'artistic', settings: { effect: 'ink' } },
  { id: 'xdog', name: 'XDoG', cat: 'artistic', settings: { effect: 'xdog' } },
  { id: 'toon', name: 'Toon', cat: 'artistic', settings: { effect: 'toon', saturation: 35, clarity: 15 } },
  { id: 'cartoon', name: 'Cartoon', cat: 'artistic', settings: { effect: 'toon', saturation: 45, contrast: 10 } },
  { id: 'comic', name: 'Comic', cat: 'artistic', settings: { effect: 'toon', contrast: 30, saturation: 30 } },
  { id: 'popArt', name: 'Pop Art', cat: 'artistic', settings: { posterize: 4, saturation: 60, contrast: 25 } },
  { id: 'warhol', name: 'Warhol', cat: 'artistic', settings: { effect: 'warhol', posterize: 4 } },
  { id: 'halftone', name: 'Halftone', cat: 'artistic', settings: { effect: 'halftone' } },
  { id: 'pointillism', name: 'Pointillism', cat: 'artistic', settings: { effect: 'halftone', saturation: 30 } },
  { id: 'mosaic', name: 'Mosaic', cat: 'artistic', settings: { effect: 'mosaic', saturation: 20 } },
  { id: 'pixelate', name: 'Pixelate', cat: 'artistic', settings: { effect: 'pixelate' } },
  { id: 'oil', name: 'Oil Painting', cat: 'artistic', settings: { effect: 'oil', saturation: 30, contrast: 10 } },
  { id: 'watercolor', name: 'Watercolor', cat: 'artistic', settings: { effect: 'watercolor', saturation: 20 } },
  { id: 'thermal', name: 'Thermal', cat: 'artistic', settings: { effect: 'thermal' } },
  { id: 'neon', name: 'Neon', cat: 'artistic', settings: { effect: 'neon' } },
  { id: 'negative', name: 'Negative', cat: 'artistic', settings: { effect: 'negative' } },
  { id: 'stainedGlass', name: 'Stained Glass', cat: 'artistic', settings: { effect: 'mosaic', saturation: 50, contrast: 20 } },
];

const ADJUST_GROUPS = [
  ['Light', [
    ['exposure', 'Exposure', -100, 100],
    ['brightness', 'Brightness', -100, 100],
    ['contrast', 'Contrast', -100, 100],
  ]],
  ['Color', [
    ['saturation', 'Saturation', -100, 100],
    ['vibrance', 'Vibrance', -100, 100],
    ['temperature', 'Warmth', -100, 100],
    ['tint', 'Tint', -100, 100],
    ['hue', 'Hue', -180, 180],
  ]],
  ['Detail', [
    ['sharpness', 'Sharpness', 0, 100],
    ['clarity', 'Clarity', 0, 100],
    ['denoise', 'Denoise', 0, 100],
    ['soften', 'Soften', 0, 100],
  ]],
  ['Creative', [
    ['posterize', 'Posterize', 0, 16],
  ]],
];

const TABS = [
  ['suggest', 'Suggestions', 'sparkles'],
  ['crop', 'Crop', 'crop'],
  ['adjust', 'Adjust', 'sliders'],
  ['filters', 'Filters', 'filters'],
  ['stack', 'Stack', 'stack'],
  ['view', 'View', 'eye'],
];

const PANEL_HEADINGS = {
  suggest: ['Suggested', 'One-tap looks tuned to this photo'],
  crop: ['Crop & Rotate', 'Straighten, reframe and set a ratio'],
  adjust: ['Adjust', 'Fine-tune light, color and detail'],
  filters: ['Filters', 'Professional presets, ready to stack'],
  stack: ['Edit stack', 'Combine looks for total control'],
  view: ['View', 'Zoom in to inspect the details'],
};

function sampleImageData(source, max = 480) {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function presetWithAuto(base, preset) {
  const s = { ...DEFAULT_SETTINGS, ...preset.settings };
  if (s.autoColor) s.autoColorFactors = computeWhiteBalanceFactors(base);
  if (s.autoEnhance) s.autoEnhanceParams = computeEnhanceParams(base);
  return s;
}

function PanelHead({ title, meta, right }) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {right || null}
    </div>
  );
}

export default function App() {
  const [img, setImg] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState(null);
  const [ratio, setRatio] = useState('Free');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [cropMode, setCropMode] = useState(false);
  const [tab, setTab] = useState('suggest');
  const [drag, setDrag] = useState(null); // {startX,startY,curX,curY} preview coords
  const [zoom, setZoom] = useState(1);
  const [holding, setHolding] = useState(false);
  const [stack, setStack] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [filterCat, setFilterCat] = useState('effects');
  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const [toast, setToast] = useState(null);

  const previewCanvasRef = useRef(null);
  const geomCanvasRef = useRef(null);
  const baseGeomRef = useRef(null);
  const previewScaleRef = useRef(1);
  const stageScrollRef = useRef(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // measure the available stage area so the preview always fits the screen
  useEffect(() => {
    const el = stageScrollRef.current;
    if (!el || !img) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setFit((prev) => (
        Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
          ? prev
          : { w: r.width, h: r.height }
      ));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // rebuild geometry canvas when img/rotation/crop change
  useEffect(() => {
    if (!img) { geomCanvasRef.current = null; baseGeomRef.current = null; return; }
    // Base canvas is the rotated photo only; crop math always works against it
    // so repeated ratio changes stay centered on the original frame.
    const base = buildGeometryCanvas(img, rotation, null);
    baseGeomRef.current = base;
    geomCanvasRef.current = crop ? cropCanvas(base, crop) : base;
    // reset auto params when geometry changes
    setSettings((prev) => ({ ...prev, autoColorFactors: null, autoEnhanceParams: null }));
  }, [img, rotation, crop]);

  // build enhancement thumbnails from the current (geometry) image
  useEffect(() => {
    const gc = geomCanvasRef.current;
    if (!gc) { setThumbs({}); return; }
    let cancelled = false;
    const base = sampleImageData(gc, 128);
    const result = {};
    const all = [
      ...ENHANCEMENTS.map((p) => ['en:' + p.id, p]),
      ...FILTERS.map((p) => ['fl:' + p.id, p]),
    ];
    for (const [key, preset] of all) {
      const s = presetWithAuto(base, preset);
      const outData = applyColor(base, s);
      const c = document.createElement('canvas');
      c.width = outData.width; c.height = outData.height;
      c.getContext('2d').putImageData(outData, 0, 0);
      result[key] = c.toDataURL('image/jpeg', 0.72);
    }
    if (!cancelled) setThumbs(result);
    return () => { cancelled = true; };
  }, [img, rotation, crop]);

  // render preview
  const renderPreview = useCallback(() => {
    const gc = geomCanvasRef.current;
    const canvas = previewCanvasRef.current;
    if (!gc || !canvas) return;
    const maxDim = Math.max(gc.width, gc.height);
    const availW = Math.max(120, (fit.w || 360) - 24);
    const availH = Math.max(120, (fit.h || 420) - 24);
    const baseScale = Math.min(
      availW / gc.width,
      availH / gc.height,
      MAX_PREVIEW / maxDim,
    );
    const scale = Math.max(0.02, baseScale * zoom);
    previewScaleRef.current = scale;
    const pw = Math.max(1, Math.round(gc.width * scale));
    const ph = Math.max(1, Math.round(gc.height * scale));

    const tmp = document.createElement('canvas');
    tmp.width = pw; tmp.height = ph;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(gc, 0, 0, pw, ph);
    const base = tctx.getImageData(0, 0, pw, ph);

    let out;
    if (holding) {
      out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    } else {
      out = base;
      if (hasManualAdjustments(settings)) {
        const s = { ...settings };
        if (s.autoColor && !s.autoColorFactors) s.autoColorFactors = computeWhiteBalanceFactors(base);
        if (s.autoEnhance && !s.autoEnhanceParams) s.autoEnhanceParams = computeEnhanceParams(base);
        out = applyColor(base, s);
      }
      if (stack.length) out = applyStack(out, stack);
    }
    canvas.width = pw;
    canvas.height = ph;
    canvas.getContext('2d').putImageData(out, 0, 0);
  }, [settings, zoom, holding, stack, fit]);

  useEffect(() => { renderPreview(); }, [renderPreview, img, rotation, crop, zoom, holding]);

  const resetSession = () => {
    setRotation(0);
    setCrop(null);
    setRatio('Free');
    setZoom(1);
    setSettings({ ...DEFAULT_SETTINGS });
    setStack([]);
    setCropMode(false);
    setTab('suggest');
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const image = await loadImage(f);
    setImg(image);
    resetSession();
    e.target.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setFileName(f.name);
    const image = await loadImage(f);
    setImg(image);
    resetSession();
  };

  const updateSetting = (key, val) => {
    setSettings((p) => ({ ...p, [key]: val }));
  };

  const rotateBy = (deg) => {
    setRotation((r) => r + deg);
    setCrop(null);
    setRatio('Free');
  };
  const setRotationVal = (v) => {
    setRotation(v);
    setCrop(null);
    setRatio('Free');
  };

  // crop drag handlers
  const onPointerDown = (e) => {
    if (!img) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (cropMode) {
      setDrag({ startX: x, startY: y, curX: x, curY: y });
      return;
    }
    // hold to compare: show original while pressed
    setHolding(true);
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) * (canvas.width / rect.width), 0, canvas.width);
    const y = clamp((e.clientY - rect.top) * (canvas.height / rect.height), 0, canvas.height);
    setDrag((d) => ({ ...d, curX: x, curY: y }));
  };
  const onPointerUp = () => {
    if (drag) {
      const scale = previewScaleRef.current;
      const x1 = Math.min(drag.startX, drag.curX);
      const y1 = Math.min(drag.startY, drag.curY);
      const x2 = Math.max(drag.startX, drag.curX);
      const y2 = Math.max(drag.startY, drag.curY);
      const pw = x2 - x1, ph = y2 - y1;
      if (pw > 5 && ph > 5) {
        setCrop({
          x: Math.round(x1 / scale),
          y: Math.round(y1 / scale),
          w: Math.round(pw / scale),
          h: Math.round(ph / scale),
        });
        setRatio('Free');
      }
      setDrag(null);
      setCropMode(false);
      return;
    }
    setHolding(false);
  };

  const resetCrop = () => { setCrop(null); setRatio('Free'); };
  const resetAll = () => {
    if (!img) return;
    resetSession();
    notify('All edits reset');
  };

  const handleExport = async () => {
    const gc = geomCanvasRef.current;
    if (!gc) return;
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const fullData = gc.getContext('2d').getImageData(0, 0, gc.width, gc.height);
      let out = fullData;
      if (hasManualAdjustments(settings)) {
        const s = { ...settings };
        if (s.autoColor && !s.autoColorFactors) s.autoColorFactors = computeWhiteBalanceFactors(fullData);
        if (s.autoEnhance && !s.autoEnhanceParams) s.autoEnhanceParams = computeEnhanceParams(fullData);
        out = applyColor(fullData, s);
      }
      if (stack.length) out = applyStack(out, stack);
      const c = document.createElement('canvas');
      c.width = out.width; c.height = out.height;
      c.getContext('2d').putImageData(out, 0, 0);
      const base = (fileName || 'photo').replace(/\.[^.]+$/, '');
      // Android WebView bridge saves straight to the gallery.
      if (window.Violet && typeof window.Violet.saveImage === 'function') {
        window.Violet.saveImage(c.toDataURL('image/jpeg', 0.92), base + '-violet.jpg');
        setExporting(false);
        notify('Saved to Pictures/Violet');
        return;
      }
      const downloadName = base + '-violet.png';
      c.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setExporting(false);
        notify('Photo exported');
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setExporting(false);
      notify('Export failed');
    }
  };

  const applyAspectRatio = (value, label) => {
    const base = baseGeomRef.current;
    if (!base) return;
    const W = base.width, H = base.height;
    setRatio(label);
    if (value === null) { setCrop(null); return; }
    let cw, ch;
    if (W / H > value) { ch = H; cw = Math.round(H * value); }
    else { cw = W; ch = Math.round(W / value); }
    setCrop({ x: Math.round((W - cw) / 2), y: Math.round((H - ch) / 2), w: cw, h: ch });
  };

  const toggleCropMode = () => {
    setCropMode((active) => {
      // start a fresh selection from the full frame
      if (!active) { setCrop(null); setRatio('Free'); }
      return !active;
    });
  };

  const togglePreset = (preset, key) => {
    setStack((prev) => {
      const exists = prev.findIndex((l) => l.key === key);
      if (exists >= 0) return prev.filter((l) => l.key !== key);
      return [...prev, { key, preset, strength: 100 }];
    });
  };

  const inStack = (key) => stack.some((l) => l.key === key);

  const setLayerStrength = (key, strength) => {
    setStack((prev) => prev.map((l) => (l.key === key ? { ...l, strength } : l)));
  };
  const removeLayer = (key) => setStack((prev) => prev.filter((l) => l.key !== key));
  const moveLayer = (key, dir) => {
    setStack((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };
  const clearStack = () => setStack([]);
  const changeZoom = (factor) => setZoom((z) => clamp(+(z * factor).toFixed(2), 0.5, 4));

  // drag overlay rect
  let overlayRect = null;
  if (drag) {
    overlayRect = {
      left: Math.min(drag.startX, drag.curX),
      top: Math.min(drag.startY, drag.curY),
      width: Math.abs(drag.curX - drag.startX),
      height: Math.abs(drag.curY - drag.startY),
    };
  }

  const heading = PANEL_HEADINGS[tab];
  const catLabel = FILTER_CATS.find(([id]) => id === filterCat)?.[1] || '';

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="sparkles" size={16} strokeWidth={1.9} />
          </span>
          <div className="brand-text">
            <h1>Violet</h1>
            <span>{img ? (fileName || 'Untitled photo') : 'Photo Editor'}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {img && (
            <button className="icon-btn" onClick={resetAll} title="Reset all edits" aria-label="Reset all edits">
              <Icon name="reset" size={18} />
            </button>
          )}
          {img && (
            <button className="btn-primary" onClick={handleExport} disabled={exporting} aria-label="Save photo">
              {exporting ? <span className="spinner" /> : <Icon name="save" size={15} />}
              <span>{exporting ? 'Saving' : 'Save'}</span>
            </button>
          )}
          {img && (
            <label className="icon-btn file-btn" title="Open another photo">
              <Icon name="upload" size={18} />
              <input type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
          )}
        </div>
      </header>

      {!img ? (
        <div className="empty">
          <div className="empty-card">
            <div className="empty-icon">
              <Icon name="image" size={30} strokeWidth={1.5} />
            </div>
            <h2>Start with a photo</h2>
            <p>Drop an image here, or open one from your library to begin editing.</p>
            <label className="btn-primary empty-cta">
              <Icon name="upload" size={16} />
              <span>Open photo</span>
              <input type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
            <span className="drop-hint">JPG, PNG, WebP · up to full resolution</span>
            <div className="feature-row">
              <span className="feature-chip"><Icon name="check" size={12} /> On-device</span>
              <span className="feature-chip"><Icon name="check" size={12} /> No sign-in</span>
              <span className="feature-chip"><Icon name="check" size={12} /> Non-destructive</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="editor">
          <div className="stage">
            <div className="canvas-scroll" ref={stageScrollRef}>
              <div
                className="canvas-container"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <canvas ref={previewCanvasRef} />
                {overlayRect && (
                  <div className="crop-overlay drag" style={overlayRect} />
                )}
                {holding && (
                  <span className="compare-badge">
                    <Icon name="eye" size={12} /> Original
                  </span>
                )}
              </div>
            </div>

            <div className="stage-foot">
              <div className="zoom-pill">
                <button onClick={() => changeZoom(1 / 1.25)} aria-label="Zoom out">
                  <Icon name="minus" size={14} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => changeZoom(1.25)} aria-label="Zoom in">
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <span className="hold-hint">
                <Icon name="eye" size={13} /> Hold to compare
              </span>
            </div>

            {toast && (
              <div className="toast" role="status" aria-live="polite">
                <span className="dot" />
                {toast}
              </div>
            )}
          </div>

          <div className="dock">
            <nav className="tabbar" aria-label="Editor tools">
              {TABS.map(([id, label, icon]) => (
                <button
                  key={id}
                  className={'tab' + (tab === id ? ' active' : '')}
                  onClick={() => setTab(id)}
                  aria-label={label}
                  data-testid={'tab-' + id}
                >
                  <span className="tab-icon">
                    <Icon name={icon} size={19} />
                    {id === 'stack' && stack.length > 0 && (
                      <span className="tab-count">{stack.length}</span>
                    )}
                  </span>
                  <span className="tab-label">{label}</span>
                </button>
              ))}
            </nav>

            <div className="panel">
              <div className="sheet-handle" />
              <PanelHead
                title={heading[0]}
                meta={
                  tab === 'filters'
                    ? `${FILTERS.length} presets · ${catLabel}`
                    : tab === 'stack'
                      ? (stack.length
                        ? `${stack.length} layer${stack.length > 1 ? 's' : ''} · applied in order`
                        : 'Nothing stacked yet')
                      : heading[1]
                }
                right={
                  tab === 'stack' && stack.length > 0 ? (
                    <button className="text-btn" onClick={clearStack}>Clear all</button>
                  ) : null
                }
              />

              {tab === 'suggest' && (
                <div className="enhance-list">
                  {ENHANCEMENTS.map((item) => {
                    const key = 'en:' + item.id;
                    const active = inStack(key);
                    return (
                      <button
                        key={item.id}
                        className={'enhance-card' + (active ? ' active' : '')}
                        onClick={() => togglePreset(item, key)}
                        data-testid={'enh-' + item.id}
                      >
                        <span className="enhance-thumb">
                          {thumbs[key]
                            ? <img src={thumbs[key]} alt="" />
                            : <Icon name={item.icon} size={19} />}
                        </span>
                        <span className="enhance-text">
                          <span className="enhance-name">{item.name}</span>
                          <span className="enhance-sub">{item.sub}</span>
                        </span>
                        <span className={'add-toggle' + (active ? ' on' : '')}>
                          <Icon name={active ? 'check' : 'plus'} size={14} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {tab === 'crop' && (
                <div className="crop-panel">
                  <div className="crop-actions">
                    <button className="tool-btn" onClick={() => rotateBy(-90)}>
                      <Icon name="rotateLeft" size={19} />
                      <span>Rotate left</span>
                    </button>
                    <button className="tool-btn" onClick={() => rotateBy(90)}>
                      <Icon name="rotateRight" size={19} />
                      <span>Rotate right</span>
                    </button>
                    <button
                      className={'tool-btn' + (cropMode ? ' on' : '')}
                      onClick={toggleCropMode}
                      data-testid="crop-toggle"
                    >
                      <Icon name={cropMode ? 'check' : 'crop'} size={19} />
                      <span>{cropMode ? 'Done' : 'Crop'}</span>
                    </button>
                  </div>

                  <div className="chip-row">
                    {[
                      ['Free', null],
                      ['1:1', 1],
                      ['4:3', 4 / 3],
                      ['16:9', 16 / 9],
                      ['3:4', 3 / 4],
                    ].map(([label, value]) => (
                      <button
                        key={label}
                        className={'chip' + (ratio === label ? ' active' : '')}
                        onClick={() => applyAspectRatio(value, label)}
                        data-testid={'ratio-' + label.replace(':', '-')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="slider-row">
                    <div className="slider-head">
                      <span>Angle</span>
                      <b>{rotation}°</b>
                    </div>
                    <input
                      type="range" min="-180" max="180" value={rotation}
                      onChange={(e) => setRotationVal(Number(e.target.value))}
                      aria-label="Rotation angle"
                    />
                  </div>

                  {crop ? (
                    <div className="crop-meta">
                      <span>Selection {crop.w} × {crop.h} px</span>
                      <button className="text-btn" onClick={resetCrop}>Reset crop</button>
                    </div>
                  ) : (
                    <p className="panel-note">
                      {cropMode
                        ? 'Drag over the photo to set your crop, then release to apply.'
                        : 'Tap the crop tool, then drag over the photo to set a custom selection.'}
                    </p>
                  )}
                </div>
              )}

              {tab === 'adjust' && (
                <div className="adjust-panel">
                  {ADJUST_GROUPS.map(([group, rows]) => (
                    <div className="adjust-group" key={group}>
                      <h3 className="group-title">{group}</h3>
                      {rows.map(([key, label, min, max]) => (
                        <div className="slider-row" key={key}>
                          <div className="slider-head">
                            <span>{label}</span>
                            <b>{settings[key]}</b>
                          </div>
                          <input
                            type="range"
                            min={min} max={max} step="1"
                            value={settings[key]}
                            onChange={(e) => updateSetting(key, Number(e.target.value))}
                            aria-label={label}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'filters' && (
                <div className="filter-panel">
                  <div className="cat-tabs">
                    {FILTER_CATS.map(([id, label]) => (
                      <button
                        key={id}
                        className={'cat-tab' + (filterCat === id ? ' active' : '')}
                        onClick={() => setFilterCat(id)}
                        data-testid={'cat-' + id}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="filter-grid">
                    {FILTERS.filter((f) => f.cat === filterCat).map((f) => {
                      const key = 'fl:' + f.id;
                      const active = inStack(key);
                      return (
                        <button
                          key={f.id}
                          className={'filter-card' + (active ? ' active' : '')}
                          onClick={() => togglePreset(f, key)}
                          data-testid={'filter-' + f.id}
                        >
                          <span className="filter-thumb">
                            {thumbs[key]
                              ? <img src={thumbs[key]} alt="" />
                              : <span className="filter-placeholder" />}
                            {active && (
                              <span className="thumb-check">
                                <Icon name="check" size={11} strokeWidth={2.4} />
                              </span>
                            )}
                          </span>
                          <span className="filter-name">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === 'stack' && (
                <div className="stack-panel">
                  {stack.length === 0 ? (
                    <div className="empty-panel">
                      <span className="empty-ring">
                        <Icon name="layers" size={21} />
                      </span>
                      <h3>Build your look</h3>
                      <p>Tap any suggestion or filter to add it here. Stack several looks, then tune each one's strength.</p>
                    </div>
                  ) : (
                    <div className="layer-list">
                      {stack.map((l, idx) => (
                        <div className="layer" key={l.key}>
                          <span className="layer-thumb">
                            {thumbs[l.key] ? <img src={thumbs[l.key]} alt="" /> : null}
                          </span>
                          <div className="layer-body">
                            <div className="layer-head">
                              <span className="layer-name">
                                <span className="layer-index">{String(idx + 1).padStart(2, '0')}</span>
                                {l.preset.name}
                              </span>
                              <span className="layer-actions">
                                <button
                                  className="mini" onClick={() => moveLayer(l.key, -1)}
                                  disabled={idx === 0} aria-label="Move layer up"
                                >
                                  <Icon name="up" size={13} />
                                </button>
                                <button
                                  className="mini" onClick={() => moveLayer(l.key, 1)}
                                  disabled={idx === stack.length - 1} aria-label="Move layer down"
                                >
                                  <Icon name="down" size={13} />
                                </button>
                                <button
                                  className="mini" onClick={() => removeLayer(l.key)} aria-label="Remove layer"
                                >
                                  <Icon name="close" size={13} />
                                </button>
                              </span>
                            </div>
                            <div className="layer-strength-row">
                              <input
                                type="range" min="0" max="100"
                                value={l.strength}
                                onChange={(e) => setLayerStrength(l.key, Number(e.target.value))}
                                aria-label={`${l.preset.name} strength`}
                              />
                              <span className="layer-strength">{l.strength}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'view' && (
                <div className="view-panel">
                  <div className="zoom-card">
                    <div className="zoom-big">
                      <button onClick={() => changeZoom(1 / 1.25)} aria-label="Zoom out">
                        <Icon name="minus" size={18} />
                      </button>
                      <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => changeZoom(1.25)} aria-label="Zoom in">
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                    <button className="icon-btn" onClick={() => setZoom(1)} title="Fit to screen">
                      <Icon name="fit" size={18} />
                    </button>
                  </div>
                  <div className="zoom-presets">
                    {[0.5, 1, 2, 4].map((z) => (
                      <button
                        key={z}
                        className={'chip' + (Math.abs(zoom - z) < 0.01 ? ' active' : '')}
                        onClick={() => setZoom(z)}
                      >
                        {z === 1 ? 'Fit' : `${Math.round(z * 100)}%`}
                      </button>
                    ))}
                  </div>
                  <p className="panel-note">
                    Press and hold the photo at any time to compare your edit with the original.
                    Zooming only changes the preview — exports stay full resolution.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
