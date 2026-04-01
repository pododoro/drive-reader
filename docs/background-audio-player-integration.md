# Expo Audio Integration Plan

## Goal

Connect the local TTS output to `expo-audio` so the app can use background playback and system controls.

## Integration Shape

- `services/local-tts.ts` defines the native TTS contract and platform availability.
- `services/speech-controller.ts` orchestrates synthesis, playback, cleanup, and fallback behavior.
- `expo-audio` owns playback, lock-screen registration, and background audio behavior.

## Implementation Steps

1. Generate or obtain speech audio from the native TTS module.
2. Load the audio URI into an `expo-audio` player.
3. Call `setActiveForLockScreen(true, metadata)` before playback.
4. Map the UI buttons to player actions:
   - `Speak` -> synthesize and play
   - `Stop` -> pause or stop
   - optional future `Pause` / `Resume`
5. Clear lock-screen controls and temporary audio files when playback ends or stops.

## Constraints

- The controller still falls back to `expo-speech` when the native path is unavailable.
- `expo-audio` is ready for the playback side, but it needs real audio output from the native TTS engine.

## Suggested Order

1. Harden the Android local TTS module and verify it in a device build.
2. Mirror the same interface on iOS when the project is generated.
3. Keep the speech controller as the single orchestration layer for both platforms.
