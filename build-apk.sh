#!/usr/bin/env bash
set -e

echo "=== Smart Router Control APK Builder ==="
npm install
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

# Ensure Android allows HTTP connections to 192.168.1.1
if ! grep -q "usesCleartextTraffic" android/app/src/main/AndroidManifest.xml; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/g' android/app/src/main/AndroidManifest.xml
fi

cd android
chmod +x gradlew
./gradlew assembleDebug

echo ""
echo "✅ APK Built Successfully!"
echo "👉 File Location: android/app/build/outputs/apk/debug/app-debug.apk"
