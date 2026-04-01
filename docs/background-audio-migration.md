# Background Audio Migration

## Goal

Let the app continue playback in the background and expose play/stop controls from the system UI.

## Current State

- The app uses a speech controller boundary in `services/speech-controller.ts`.
- On Android, the controller now prefers the local TTS native module and feeds the result into `expo-audio`.
- On unsupported platforms, the controller still falls back to `expo-speech`.
- `expo-audio` is installed and the app config enables background playback.
- The root layout initializes the audio session with background playback enabled.
- Lock-screen registration is enabled on the audio player path.

## Important Constraint

- `expo-speech` is fine for foreground TTS, but it does not provide system notification or lock-screen playback controls.
- To get those controls, the playback layer must change.

## Recommended Path

1. Keep the speech controller boundary in place.
2. Use the Android local TTS module as the first real audio source.
3. Mirror the same contract on iOS when an iOS project is available.
4. Keep `expo-audio` as the playback layer for background audio and lock-screen controls.

## References

- Expo Speech: https://docs.expo.dev/versions/latest/sdk/speech/
- Expo Audio: https://docs.expo.dev/versions/v54.0.0/sdk/audio

## Next Implementation Step

- Harden the Android local TTS module and verify it in a device build.
- After that, complete the iOS implementation when the iOS project is generated.
