# Violet Photo Editor

A fast, offline photo editor with automatic enhancement, color correction, professional filters, and artistic effects. Built as a React web app and packaged as an Android APK using a lightweight WebView shell.

## Download

Grab the latest APK from [Releases](https://github.com/MidnightRaven9/violet-photo-editor/releases/latest). Requires Android 10 or newer.

## Features

- **Auto Enhance** and **Auto Color** (white balance)
- **Stackable filters** with per-layer strength control and reordering
- **80+ filters** across Effects, Color, B&W, Vintage, LUT, and Artistic categories
- **Artistic effects**: sketch, pencil, ink, toon, halftone, mosaic, thermal, Warhol, watercolor, neon, negative
- **Manual adjustments**: brightness, contrast, exposure, saturation, vibrance, hue, warmth, tint, sharpness, clarity, denoise, soften, posterize
- **Crop** with aspect ratios, **rotate** (90° steps + free angle), zoom
- **Hold the photo** to compare with the original at any time
- Exports full-resolution PNG straight to **Pictures/Violet** on Android

Everything runs on-device. No uploads, no accounts, no network required.

## Web development

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # single-file production build in dist/
```

## Android APK

The app is wrapped in `android/` with a minimal WebView `MainActivity` and built by `android/build-apk.sh`.

Requirements: JDK 17, Android SDK build-tools 34.0.0, platform android-34.

```bash
ANDROID_HOME=/opt/android-sdk ./android/build-apk.sh
```

The signed APK is written to `android/build/violet-photo-editor.apk`.

## License

MIT
