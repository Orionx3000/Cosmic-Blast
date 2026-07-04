# Cosmic Blast - Build & Install APK
# Run this to package the web game into an Android APK and push it to your phone.

$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Definition
$apkDir = Join-Path $base 'apk-build'
$apkOut = Join-Path $apkDir 'android\app\build\outputs\apk\debug\app-debug.apk'

# Find ADB
function Find-ADB {
    $inPath = Get-Command adb -ErrorAction SilentlyContinue
    if ($inPath) { return $inPath.Source }
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
        "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe"
        "$env:ProgramFiles\Android\platform-tools\adb.exe"
        "${env:ProgramFiles(x86)}\Android\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    throw "adb.exe not found. Check Android SDK installation."
}

$adb = Find-ADB
Write-Host "ADB: $adb" -ForegroundColor Green

# Check device
$devices = (& $adb devices) | Where-Object { $_ -match "device$" }
if (-not $devices) { throw "No Android device connected. Enable USB debugging." }
Write-Host "Device connected." -ForegroundColor Green

# Ensure Capacitor project exists
if (-not (Test-Path $apkDir)) {
    Write-Host "Creating Capacitor project..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $apkDir | Out-Null
    Set-Location $apkDir
    npm init -y
    npm install @capacitor/core @capacitor/cli @capacitor/android
    npx cap init FranticFlood com.orion.franticflood --web-dir "$base\www"
    npx cap add android
} else {
    Set-Location $apkDir
}

# Sync web assets
Write-Host "Syncing web assets..." -ForegroundColor Cyan
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
npx cap sync android

# Build APK
Write-Host "Building APK..." -ForegroundColor Cyan
Set-Location (Join-Path $apkDir 'android')
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\orion\AppData\Local\Android\Sdk'
.\gradlew.bat assembleDebug

# Install and launch
Write-Host "Installing APK..." -ForegroundColor Cyan
& $adb install -r $apkOut

Write-Host "Launching Cosmic Blast Optimized..." -ForegroundColor Green
& $adb shell monkey -p com.orion.cosmicblastv2 -c android.intent.category.LAUNCHER 1

Write-Host "Done." -ForegroundColor Green
