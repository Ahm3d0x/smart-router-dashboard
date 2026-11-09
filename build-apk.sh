#!/usr/bin/env bash
set -e

echo "=== Smart Router Control APK Builder ==="
npm install
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

# 1. Configure network security config (cleartext HTTP + trusted local certificates)
mkdir -p android/app/src/main/res/xml
cat << 'EOF' > android/app/src/main/res/xml/network_security_config.xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
EOF

# 2. Ensure Android allows HTTP connections & uses network security config
if ! grep -q "networkSecurityConfig" android/app/src/main/AndroidManifest.xml; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml\/network_security_config"/g' android/app/src/main/AndroidManifest.xml
elif ! grep -q "usesCleartextTraffic" android/app/src/main/AndroidManifest.xml; then
  sed -i 's/<application/<application android:usesCleartextTraffic="true"/g' android/app/src/main/AndroidManifest.xml
fi

# 3. Patch MainActivity.java to bypass self-signed SSL certificate errors (CertPathValidatorException) on router gateways
MAIN_ACTIVITY=$(find android/app/src/main/java -name "MainActivity.java" | head -n 1)
if [ -n "$MAIN_ACTIVITY" ]; then
  cat << 'EOF' > "$MAIN_ACTIVITY"
package com.smartrouter.dashboard;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        trustAllRouterCertificates();
        super.onCreate(savedInstanceState);
    }

    private void trustAllRouterCertificates() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true;
                }
            });
        } catch (Exception ignored) {}
    }
}
EOF
fi

cd android
chmod +x gradlew
./gradlew assembleDebug

echo ""
echo "✅ APK Built Successfully!"
echo "👉 File Location: android/app/build/outputs/apk/debug/app-debug.apk"
