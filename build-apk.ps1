$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   Smart Router Control - Windows Auto APK Builder   " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Install NPM packages & sync Capacitor Android
Write-Host "`n[1/4] Syncing Capacitor Android project..." -ForegroundColor Yellow
cmd.exe /c "npm install"
if (-not (Test-Path "android")) {
    cmd.exe /c "npx cap add android"
}
cmd.exe /c "npx cap sync android"

# 1b. Configure network_security_config.xml & MainActivity SSL/Cleartext trust (UTF-8 WITHOUT BOM so javac never fails)
$xmlDir = Join-Path $PSScriptRoot "android\app\src\main\res\xml"
New-Item -ItemType Directory -Force -Path $xmlDir | Out-Null
$netSecPath = Join-Path $xmlDir "network_security_config.xml"
$netSecXml = @"
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
"@
[System.IO.File]::WriteAllText($netSecPath, $netSecXml, $utf8NoBom)

$manifestPath = Join-Path $PSScriptRoot "android\app\src\main\AndroidManifest.xml"
if (Test-Path $manifestPath) {
    $manifest = [System.IO.File]::ReadAllText($manifestPath)
    if ($manifest -notmatch "usesCleartextTraffic") {
        $manifest = $manifest -replace "<application", "<application android:usesCleartextTraffic=`"true`" android:networkSecurityConfig=`"@xml/network_security_config`""
        [System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)
    }
}

# Patch MainActivity.java WITHOUT BOM (\ufeff)
$mainAct = Get-ChildItem -Path (Join-Path $PSScriptRoot "android\app\src\main\java") -Filter "MainActivity.java" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mainAct) {
    $javaCode = @"
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
        super.onCreate(savedInstanceState);
        trustAllRouterCertificates();
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
"@
    [System.IO.File]::WriteAllText($mainAct.FullName, $javaCode, $utf8NoBom)
}

$toolsDir = Join-Path $PSScriptRoot ".android-build-tools"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

# 2. Check or Portable-Download JDK 17
Write-Host "`n[2/4] Checking Java JDK 17..." -ForegroundColor Yellow
$javaCmd = Get-Command javac -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    $portableJdkDir = Join-Path $toolsDir "jdk-17"
    $javacExe = Get-ChildItem -Path $portableJdkDir -Filter "javac.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $javacExe) {
        Write-Host "Java JDK not installed. Downloading Portable OpenJDK 17 (~180 MB)..." -ForegroundColor Cyan
        $jdkZip = Join-Path $toolsDir "jdk17.zip"
        Invoke-WebRequest -Uri "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse" -OutFile $jdkZip
        Expand-Archive -Path $jdkZip -DestinationPath $portableJdkDir -Force
        Remove-Item $jdkZip -Force
        $javacExe = Get-ChildItem -Path $portableJdkDir -Filter "javac.exe" -Recurse | Select-Object -First 1
    }
    $env:JAVA_HOME = $javacExe.Directory.Parent.FullName
    $env:PATH = "$($javacExe.Directory.FullName);$env:PATH"
}
Write-Host "Using JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green

# 3. Check or Portable-Download Android SDK Command-Line Tools
Write-Host "`n[3/4] Checking Android SDK..." -ForegroundColor Yellow
$defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if ((Test-Path $defaultSdk) -and (Test-Path (Join-Path $defaultSdk "platforms"))) {
    $sdkPath = $defaultSdk
} else {
    $sdkPath = Join-Path $toolsDir "android-sdk"
    $sdkManagerBat = Join-Path $sdkPath "cmdline-tools\latest\bin\sdkmanager.bat"
    if (-not (Test-Path $sdkManagerBat)) {
        Write-Host "Android SDK not found. Downloading Portable Android Command-Line Tools (~140 MB)..." -ForegroundColor Cyan
        $sdkZip = Join-Path $toolsDir "cmdline-tools.zip"
        Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $sdkZip
        $extractTmp = Join-Path $toolsDir "cmdline-tmp"
        Expand-Archive -Path $sdkZip -DestinationPath $extractTmp -Force
        Remove-Item $sdkZip -Force
        $latestDir = Join-Path $sdkPath "cmdline-tools\latest"
        New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
        Move-Item -Path (Join-Path $extractTmp "cmdline-tools\*") -Destination $latestDir -Force
        Remove-Item $extractTmp -Recurse -Force
    }
    if (-not (Test-Path (Join-Path $sdkPath "platforms\android-34"))) {
        Write-Host "Installing Android SDK Platform 34 & Build-Tools 34.0.0..." -ForegroundColor Cyan
        $yesInputs = "y`ny`ny`ny`ny`ny`ny`ny`n"
        $yesInputs | & $sdkManagerBat --sdk_root="$sdkPath" "platform-tools" "platforms;android-34" "build-tools;34.0.0"
    }
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$escapedSdk = $sdkPath -replace "\\", "\\"
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "android\local.properties"), "sdk.dir=$escapedSdk", $utf8NoBom)
Write-Host "Using ANDROID_HOME: $sdkPath" -ForegroundColor Green

# 4. Clean stale APK, run Gradle assembleDebug, and verify exit code
$builtApk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\debug\app-debug.apk"
$finalApk = Join-Path $PSScriptRoot "Smart-Router-Control.apk"
if (Test-Path $builtApk) { Remove-Item $builtApk -Force }

Write-Host "`n[4/4] Building Android APK via Gradle..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot "android")
cmd.exe /c "gradlew.bat assembleDebug"
$gradleExit = $LASTEXITCODE
Pop-Location

if (($gradleExit -eq 0) -and (Test-Path $builtApk)) {
    Copy-Item -Path $builtApk -Destination $finalApk -Force
    Write-Host "`n=====================================================" -ForegroundColor Green
    Write-Host " SUCCESS! New APK Built and Copied to Project Folder:" -ForegroundColor Green
    Write-Host " -> $finalApk" -ForegroundColor Yellow
    Write-Host " -> $builtApk" -ForegroundColor Gray
    Write-Host "=====================================================" -ForegroundColor Green
    explorer.exe "/select,`"$finalApk`""
} else {
    Write-Host "`n[ERROR] Gradle build failed with exit code $gradleExit." -ForegroundColor Red
}
