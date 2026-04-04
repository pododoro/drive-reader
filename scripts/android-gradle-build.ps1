param(
  [string]$Task = 'app:assembleRelease',
  [string]$GradleUserHome = 'C:\Users\Public\Documents\ESTsoft\CreatorTemp\gr'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'

if (-not (Test-Path -LiteralPath $GradleUserHome)) {
  New-Item -ItemType Directory -Path $GradleUserHome -Force | Out-Null
}

$env:GRADLE_USER_HOME = $GradleUserHome
$env:NODE_ENV = 'production'

# Clear stale native build outputs so Gradle/CMake do not reuse broken paths on Windows.
$cleanupPaths = @(
  (Join-Path $androidDir '.gradle'),
  (Join-Path $androidDir 'app\build\generated\autolinking'),
  (Join-Path $repoRoot 'node_modules\react-native-screens\android\.cxx'),
  (Join-Path $repoRoot 'node_modules\react-native-screens\android\build'),
  (Join-Path $repoRoot 'node_modules\expo-modules-core\android\build'),
  (Join-Path $repoRoot 'node_modules\expo-constants\android\build'),
  (Join-Path $repoRoot 'node_modules\expo-share-intent\android\build')
)

foreach ($path in $cleanupPaths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Push-Location $androidDir
try {
  & .\gradlew.bat $Task --no-daemon
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
