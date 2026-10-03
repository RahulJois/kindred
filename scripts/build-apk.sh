#!/usr/bin/env bash
# Builds a release APK locally and signs it with Kindred's permanent key
# (credentials.json + credentials/kindred-release.jks, both git-ignored).
# Usage: scripts/build-apk.sh [--install]
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)apksigner"

[ -f credentials.json ] || { echo "credentials.json missing: restore it from your backup"; exit 1; }
[ -d android ] || npx expo prebuild --platform android --no-install

(cd android && ./gradlew assembleRelease --console=plain -q)

OUT=build/kindred-release.apk
mkdir -p build
# The generated project signs release builds with the debug key; re-sign with the real one.
KS_PW="$(python3 -c 'import json;print(json.load(open("credentials.json"))["android"]["keystore"]["keystorePassword"])')" \
  "$APKSIGNER" sign --ks credentials/kindred-release.jks --ks-key-alias kindred \
  --ks-pass env:KS_PW --key-pass env:KS_PW \
  --out "$OUT" android/app/build/outputs/apk/release/app-release.apk
"$APKSIGNER" verify --print-certs "$OUT" | grep -m1 "SHA-256 digest"
echo "Built $OUT"

if [ "${1:-}" = "--install" ]; then
  "$ANDROID_HOME/platform-tools/adb" install -r "$OUT"
fi
