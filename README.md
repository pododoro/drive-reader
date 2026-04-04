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
- `npm run android:apk`
- `npm run android:apk:debug`

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

cd Z:\7.coding\my-tts-app\drive-reader
npm run android:apk:debug
adb install -r app\build\outputs\apk\debug\app-debug.apk

npx expo start --dev-client
```

Notes:

- Keep the Android device connected and USB debugging approved for `adb install`.
- If `--tunnel` is needed, prefer it only when LAN is not available.
- Background playback QA steps live in `docs/testing-strategy.md`.

## Standalone Android APK

Use this path when you want the app to run on Android without a PC-hosted Metro session.

1. Set JDK 17 in the current terminal.
2. Build the release APK.
3. Copy the APK to the phone and install it.

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:ANDROID_SDK_ROOT='C:\Users\USER\AppData\Local\Android\Sdk'
$env:ANDROID_HOME=$env:ANDROID_SDK_ROOT
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:PATH"

cd Z:\7.coding\my-tts-app\drive-reader
npm run android:apk
```

The APK output path is:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Notes:

- This release APK includes the bundled JavaScript, so it can start without `npx expo start --dev-client`.
- The Windows build helper now forces a short `GRADLE_USER_HOME`, sets `NODE_ENV=production`, and clears stale native build outputs before invoking Gradle. That avoids the path-length and stale CMake cache failures seen with the raw Gradle commands in this repo.
- If no release signing properties are configured, the current Android `release` build falls back to the debug keystore in [android/app/build.gradle](Z:\7.coding\my-tts-app\drive-reader\android\app\build.gradle). That is acceptable for direct device installs, but you should replace it with your own keystore before broad distribution or store submission.
- For Play Store distribution, build an AAB and use a dedicated signing key. That is a separate path from this direct-install APK flow.

## Android Release Signing

Use this before sharing the APK outside your own devices.

1. Generate a release keystore.
2. Store the keystore somewhere outside git, for example `android/keystores/drive-reader-upload.jks`.
3. Add these properties to `~/.gradle/gradle.properties` or your local [android/gradle.properties](Z:\7.coding\my-tts-app\drive-reader\android\gradle.properties).

```properties
DRIVE_READER_UPLOAD_STORE_FILE=keystores/drive-reader-upload.jks
DRIVE_READER_UPLOAD_STORE_PASSWORD=your-store-password
DRIVE_READER_UPLOAD_KEY_ALIAS=upload
DRIVE_READER_UPLOAD_KEY_PASSWORD=your-key-password
```

4. Build the release APK again with `npm run android:apk`.

Create the keystore with `keytool`:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore android\keystores\drive-reader-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Notes:

- [android/app/build.gradle](Z:\7.coding\my-tts-app\drive-reader\android\app\build.gradle) now uses the release keystore automatically when all four `DRIVE_READER_UPLOAD_*` properties are present.
- If any of those properties are missing, the build still works but falls back to the debug keystore and logs a warning.
- Keep the `.jks` file and passwords backed up. Losing them breaks future app updates for installed users.
