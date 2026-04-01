# Background Audio Migration

## Goal

Let the app continue playback in the background and expose play/stop controls from the system UI.

## Current State

- The app still uses `expo-speech` for text-to-speech.
- Playback control is isolated behind `services/speech-controller.ts`.
- The UI calls a single speech controller boundary instead of talking to `expo-speech` directly.
- `expo-audio` is installed and the app config enables background playback.
- The root layout now initializes the audio session with background playback enabled.

## Important Constraint

- `expo-speech` is fine for foreground TTS, but it does not provide system notification or lock-screen playback controls.
- To get those controls, the playback layer must change.

## Recommended Path

1. Replace the current speech implementation with an audio-backed playback pipeline.
2. Use `expo-audio` for background playback once speech audio is available as a real audio source.
3. Configure background audio support for Android and iOS.
4. Wire play / stop actions into the system media controls after the player is stable.

## References

- Expo Speech: https://docs.expo.dev/versions/latest/sdk/speech/
- Expo Audio: https://docs.expo.dev/versions/v54.0.0/sdk/audio

## Next Implementation Step

- Build the local TTS source as a native module so it can emit audio for `expo-audio` playback.
- After that, wire play / pause / stop into the audio player and lock-screen controls.
