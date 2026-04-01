# Development Status and Next Plan

Last updated: 2026-04-01

## Current Status

- Project name: `drive-reader`
- Git branch: `main`
- Commit history: initialized
- Baseline: first local commit plus GitHub remote history reconciled
- Remote version control: configured and tracking `origin/main`

## What Exists Now

- Expo Router app scaffold is present.
- Naver blog extraction flow is implemented in `app/index.tsx`.
- Supporting scripts exist for live and golden validation.
- Validation is driven by the repository's own `scripts/`-based checks.
- Web workflow QA is covered by `npm run qa:workflow`.
- GitHub Actions now runs the workflow QA path on push and pull request.
- Project documentation now lives in `docs/` for daily logging, status tracking, and PRD planning.
- Branch naming and PR workflow notes live in `docs/branching.md`.
- Testing guidance and native automation strategy live in `docs/testing-strategy.md`.
- Background audio migration notes now live in `docs/background-audio-migration.md`.
- Android-specific local TTS planning now lives in `docs/background-audio-android.md`.
- iOS-specific local TTS planning now lives in `docs/background-audio-ios.md`.
- `expo-audio` integration notes now live in `docs/background-audio-player-integration.md`.
- `expo-audio` is installed and the app is configured for background playback.
- Android now has a local TTS native module at `android/app/src/main/java/com/anonymous/drivereader/LocalTtsModule.kt`.
- The speech controller uses the Android local TTS path first and falls back to `expo-speech` elsewhere.
- An iOS source scaffold exists at `ios/LocalTtsModule.swift`, but the iOS project is not generated in this repository yet.

## Current Risks

- The Naver extraction flow can drift when page structure changes.
- Generated or fixture-based checks need periodic refresh when the upstream content changes.

## Next Development Plan

1. Keep work on short-lived topic branches.
2. Open pull requests against `main` for any non-trivial change.
3. Run the core checks for the current codebase before merging:
   - `npm run lint`
   - `npm run test:naver`
   - `npm run test:naver-live`
   - `npm run qa:workflow`
4. Keep workflow QA aligned with the current UI and interaction model.
5. Finish the speech-controller boundary and implement the local TTS native module that can feed `expo-audio`.
5. Harden the Android local TTS native module and verify it in a device build.
6. Bring the iOS implementation in once the iOS project is generated.
7. Keep the native plan aligned across Android, iOS, and the player integration docs.
8. Tighten the Naver extraction flow if live pages drift.
9. Keep daily progress in `docs/daily-log.md` after each work session.
10. Use `npm run log:new` to add a fresh dated section before writing the day's notes.
11. Use `docs/testing-strategy.md` to decide when web QA is enough and when native verification is needed.

## Reporting Standard

When you update this file, include:

- What changed since the previous snapshot.
- What is now verified.
- What remains risky or incomplete.
- The next concrete step, written as an action.

## Branch and PR Workflow

- Use `main` as the stable integration branch.
- See `docs/branching.md` for naming conventions.
- Create a topic branch for feature work, fixes, or doc updates.
- Keep each PR focused on one concern.
- Prefer small PRs that can be reviewed and merged independently.
- Update the daily log and status doc before merging when the change affects process, behavior, or roadmap.
