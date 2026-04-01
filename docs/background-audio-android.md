# Android Local TTS Plan

## Goal

Generate speech audio locally on Android, keep playback alive in the background, and expose play / pause / stop from the system notification.

## Required Pieces

- A native speech synthesis module that returns an audio source URI or streamable file.
- A foreground media playback service for sustained background playback.
- `expo-audio` as the playback layer that owns the audio session and lock-screen controls.

## Playback Flow

1. User taps `Speak`.
2. The local TTS module synthesizes the text into audio.
3. The returned audio source is passed to `expo-audio`.
4. `setActiveForLockScreen(true)` enables lock-screen / notification controls.
5. The player remains alive in the background while playback continues.

## Android Notes

- Background playback needs the config plugin already added to the app config.
- The native module should write generated speech to a cache file if the TTS engine cannot stream directly.
- The player should expose `play`, `pause`, `resume`, and `stop`.
- Notification controls should map to those player actions.

## Open Questions

- Whether the Android TTS engine can emit a file directly or needs a cache-file bridge.
- Whether the voice selection should stay app-level or be exposed from the native module.
