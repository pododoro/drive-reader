# Android Local TTS Plan

## Goal

Generate speech audio locally on Android, keep playback alive in the background, and expose play / pause / stop from the system notification.

## Required Pieces

- A native speech synthesis module that writes generated speech into a cache file.
- `expo-audio` as the playback layer that owns the audio session and lock-screen controls.
- A stable cleanup path for temporary speech files after playback ends or stops.

## Playback Flow

1. User taps `Speak`.
2. The local TTS module synthesizes the text into audio.
3. The returned audio source is passed to `expo-audio`.
4. `setActiveForLockScreen(true)` enables lock-screen / notification controls.
5. The player remains alive in the background while playback continues.

## Android Notes

- Background playback needs the config plugin already added to the app config.
- The native module now lives in `android/app/src/main/java/com/anonymous/drivereader/LocalTtsModule.kt`.
- The package is registered manually in `MainApplication.kt`.
- The player path now sets lock-screen metadata before playback.
- Notification controls should map to the audio player actions.

## Open Questions

- Whether the Android TTS engine needs per-request queueing for longer text blocks.
- Whether voice selection should stay app-level or be exposed from the native module.
