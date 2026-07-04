$ErrorActionPreference = "Stop"

function Find-ADB {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe",
        "$env:ProgramFiles\Android\platform-tools\adb.exe",
        "${env:ProgramFiles(x86)}\Android\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    throw "adb.exe not found"
}

$adb = Find-ADB
Write-Host "ADB: $adb" -ForegroundColor Green

Write-Host "Syncing capacitor..."
Set-Location "D:\App Creation\CosmicBlast-Fresh"
npx.cmd cap sync android
if (-not $?) { Write-Host "npx cap sync failed but continuing..." -ForegroundColor Yellow }

Write-Host "Building APK..."
Set-Location "D:\App Creation\CosmicBlast-Fresh\android"
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\orion\AppData\Local\Android\Sdk'

.\gradlew.bat assembleDebug

Write-Host "Installing APK..."
$apkOut = "D:\App Creation\CosmicBlast-Fresh\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb install -r $apkOut

Write-Host "Launching app..."
& $adb shell monkey -p com.orion.cosmicblastv2 -c android.intent.category.LAUNCHER 1

Write-Host "Done!"
