# Testing Strategy

## Current Coverage

- `npm run lint` for code style and static issues.
- `npm run test:naver` for golden Naver extraction output.
- `npm run test:naver-live` for live Naver extraction checks.
- `npm run qa:workflow` for web UI smoke coverage.
- GitHub Actions runs lint, typecheck, and the workflow QA smoke test on push and pull request.
- Android dev-client manual QA is now part of the background playback verification path.

## What `qa:workflow` Verifies

- The main workflow entry points are visible.
- The help page opens and returns to the app.
- Input mode selection works.
- The preview panel expands and collapses.
- The preview content area is scrollable.

## Expo Go / Native Automation Strategy

Expo Go itself is not a good target for DOM-style automation. The practical options are:

1. Keep Expo Go for manual device verification.
2. Use web QA for cheap and repeatable interaction coverage.
3. If native automation is needed, move to a dev-client build and add a native runner such as Detox or Appium.

## Android Device QA Scenario

Run this scenario on an installed Android dev client whenever the playback stack or audio session changes.

1. Build and install the debug app with JDK 17 active.
2. Start Metro with `npx expo start --dev-client`.
3. Open the app on the device and load readable text.
4. Press `Speak`.
5. Send the app to the background.
6. Confirm the system playback notification or lock-screen card appears.
7. Press `Stop` from the system control surface and confirm playback stops.
8. Press `Play` or resume from the same control surface and confirm playback resumes.
9. Lock the device screen and confirm playback continues.
10. Switch to another app and confirm playback still continues.

## Native QA Result on 2026-04-01

- Device build installed successfully with `adb install -r app\\build\\outputs\\apk\\debug\\app-debug.apk`.
- Android background playback stayed active after the app moved to the background.
- The system playback notification or lock-screen control surface appeared.
- System `Stop` and `Play` controls both worked.
- Playback continued while the device was locked.
- Playback continued while another app was in the foreground.

## Native Automation Backlog

- Add a dedicated Android dev-client QA command for background playback validation.
- Evaluate Detox against the installed dev client for notification and background playback assertions.
- If notification-level assertions are unstable in Detox, add an Appium path for Android system UI checks.

## Recommended Path

- Keep `qa:workflow` as the fast smoke test.
- Use Expo Go for manual QA on gestures, keyboard behavior, and native file/share flows.
- Use the Android device QA scenario above after changes to local TTS, `expo-audio`, or Android manifest playback wiring.
- Add native automation only after the UI stabilizes enough to justify the setup cost.
