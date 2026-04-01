# drive-reader

Expo app for reading and handling text from local files, shared content, deep links, and Naver blog pages.

## Project Docs

- `docs/daily-log.md` for daily handoff notes
- `docs/development-status-next.md` for current status and next steps
- `docs/prd.md` for product requirements and planning
- `docs/branching.md` for branch naming and PR workflow
- `.github/pull_request_template.md` for the PR template

## Daily Log

- `npm run log:new` to add today's entry before writing notes

## Scripts

- `npm run lint`
- `npm run test:naver`
- `npm run test:naver-live`

## Android Dev Client

Use this path when you need native Android features such as local TTS or background playback controls.

1. Set JDK 17 in the current terminal.
2. Build the Android debug app.
3. Install the APK on the connected device.
4. Start Metro for the dev client.

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:ANDROID_SDK_ROOT='C:\Users\USER\AppData\Local\Android\Sdk'
$env:ANDROID_HOME=$env:ANDROID_SDK_ROOT
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:PATH"
$env:GRADLE_USER_HOME='Z:\7.coding\my-tts-app\drive-reader\.gradle-home'

cd Z:\7.coding\my-tts-app\drive-reader\android
.\gradlew.bat app:assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk

cd Z:\7.coding\my-tts-app\drive-reader
npx expo start --dev-client
```

Notes:

- Keep the Android device connected and USB debugging approved for `adb install`.
- If `--tunnel` is needed, prefer it only when LAN is not available.
- Background playback QA steps live in `docs/testing-strategy.md`.
