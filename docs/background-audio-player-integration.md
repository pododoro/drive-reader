# Expo Audio Integration Plan

## Goal

Connect the local TTS output to `expo-audio` so the app can use background playback and system controls.

## Integration Shape

- `services/local-tts.ts` defines the native TTS contract.
- `services/speech-controller.ts` becomes the orchestration layer for the UI.
- `expo-audio` owns playback, lock-screen registration, and background audio behavior.

## Implementation Steps

1. Generate or obtain speech audio from the native TTS module.
2. Load the audio URI into an `expo-audio` player.
3. Call `setActiveForLockScreen(true, metadata)` before playback.
4. Map the UI buttons to player actions:
   - `Speak` -> synthesize and play
   - `Stop` -> pause or stop
   - optional future `Pause` / `Resume`
5. Clear lock-screen controls when playback ends or stops.

## Constraints

- The current app still uses `expo-speech`, so this document is the migration target.
- `expo-audio` is ready for the playback side, but it needs real audio output from the native TTS engine.

## Suggested Order

1. Build the Android local TTS module.
2. Mirror the same interface on iOS.
3. Swap the speech controller from `expo-speech` to `expo-audio`.
