#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
SRC="$ANDROID/app/src/main"
OUT="$ANDROID/build"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
KEYSTORE="${VIOLET_KEYSTORE:-$ANDROID/violet.keystore}"
STOREPASS="${VIOLET_STOREPASS:-violet-photo-editor}"
KEYPASS="${VIOLET_KEYPASS:-$STOREPASS}"
ALIAS="${VIOLET_KEY_ALIAS:-violet}"

# aapt2 / zipalign / apksigner are native tools, so on ARM hosts use the
# distro-provided ARM builds instead of Google's x86_64 binaries.
AAPT2="${AAPT2:-$(command -v aapt2 || echo "$BT/aapt2")}"
ZIPALIGN="${ZIPALIGN:-$(command -v zipalign || echo "$BT/zipalign")}"
APKSIGNER="${APKSIGNER:-$(command -v apksigner || echo "$BT/apksigner")}"
D8="${D8:-$BT/d8}"

for tool in "$AAPT2" "$D8" "$ZIPALIGN" "$APKSIGNER" "$PLATFORM"; do
  if [ ! -e "$tool" ]; then
    echo "Missing $tool. Install Android build-tools and platform android-34." >&2
    exit 1
  fi
done

echo "==> Building web bundle"
npm --prefix "$ROOT" run build

echo "==> Copying web assets"
rm -rf "$SRC/assets/www"
mkdir -p "$SRC/assets/www"
cp -r "$ROOT/dist/." "$SRC/assets/www/"

echo "==> Compiling resources"
rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/classes" "$OUT/dex" "$OUT/gen"
"$AAPT2" compile --dir "$SRC/res" -o "$OUT/compiled/res.zip"
"$AAPT2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$OUT/compiled/res.zip" \
  --java "$OUT/gen" \
  --version-code 1 \
  --version-name 1.0.0 \
  --auto-add-overlay

echo "==> Compiling Java"
mapfile -t JAVA_FILES < <(find "$SRC/java" "$OUT/gen" -name '*.java')
javac -source 8 -target 8 -classpath "$PLATFORM" -d "$OUT/classes" "${JAVA_FILES[@]}"

echo "==> Dexing"
mapfile -t CLASS_FILES < <(find "$OUT/classes" -name '*.class')
"$D8" --lib "$PLATFORM" --min-api 29 --output "$OUT/dex" "${CLASS_FILES[@]}"

echo "==> Packaging"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk dex/classes.dex)
(cd "$SRC" && zip -q -r "$OUT/unsigned.apk" assets)

echo "==> Aligning"
"$ZIPALIGN" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "==> Creating signing key at $KEYSTORE"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STOREPASS" -keypass "$KEYPASS" \
    -dname "CN=Violet Photo Editor, O=Violet, C=US"
fi

echo "==> Signing"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$STOREPASS" \
  --key-pass "pass:$KEYPASS" \
  --out "$OUT/violet-photo-editor.apk" \
  "$OUT/aligned.apk"

"$APKSIGNER" verify --verbose "$OUT/violet-photo-editor.apk" | head -20
echo "==> APK: $OUT/violet-photo-editor.apk"
ls -lh "$OUT/violet-photo-editor.apk"
