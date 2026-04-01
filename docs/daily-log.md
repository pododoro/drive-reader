# Daily Log

Purpose: capture one concise entry per workday so the next agent can reconstruct context quickly.

## How to use

- Write one entry per day.
- Keep each entry short and factual.
- Record what changed, what was verified, what is blocked, and what comes next.
- Treat this as the running handoff log for the project.

## Entry Template

```md
## 2026-04-01
- Context: What task or issue you picked up.
- Done: What you changed or investigated.
- Verified: Commands, tests, or manual checks you ran.
- Blocked: Anything unresolved or risky.
- Next: The next concrete step for the following session.
```

## Current Entries

### 2026-04-01

- Context: Baseline setup, documentation handoff, and GitHub version control initialization.
- Done: Created the first stable commit, connected the repository to GitHub, merged the remote initial commit history, and added the working docs for daily logs, status tracking, and product planning.
- Done: Added workflow QA automation, GitHub Actions CI wiring, and a testing strategy document for web QA versus native Expo Go verification.
- Done: Started the background-audio migration by isolating speech control behind `services/speech-controller.ts` and documenting the `expo-audio` path in `docs/background-audio-migration.md`.
- Done: Installed `expo-audio`, enabled background playback in app config, and initialized the audio session at app start.
- Done: Added Android, iOS, and player integration plans for the local TTS path, plus a shared `services/local-tts.ts` contract for the upcoming native module.
- Done: Added an Android local TTS native module, wired the speech controller to prefer local audio on Android, and added an iOS source scaffold for the same contract.
- Done: Fixed Android Gradle settings for this repo's Expo/React Native version and pinned the local Android build flow to JDK 17 instead of the installed JDK 25.
- Done: Added the Android media playback foreground service and related permissions to the native manifest so `expo-audio` lock-screen controls can bind correctly in the dev-client build.
- Done: Verified on a physical Android device that background playback keeps running, the system playback card appears, and system stop/resume controls work while locked and while other apps are open.
- Done: Updated the testing strategy with a concrete Android device QA scenario and a native automation backlog for future Detox/Appium coverage.
- Done: Added a short Android dev-client build and run procedure to `README.md` so the native playback path can be re-run without reconstructing the terminal steps.
- Verified: `git push -u origin main` completed successfully after reconciling the remote `main` branch; local branch now tracks `origin/main`. The workflow QA smoke test passed with `npm run qa:workflow` against the local web build, and `npm run lint` / `npx tsc --noEmit` remained clean.
- Verified: `gradlew.bat app:assembleDebug` completed successfully with JDK 17, `adb install -r app\build\outputs\apk\debug\app-debug.apk` completed successfully, and manual Android device QA passed for background playback and system controls.
- Blocked: iOS still needs a generated project before the local TTS scaffold can be wired and verified there.
- Next: Decide whether Android native playback verification should stay manual for now or move into a dedicated Detox/Appium automation pass.
