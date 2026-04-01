# iOS Local TTS Plan

## Goal

Generate speech audio locally on iOS, keep playback alive in the background, and expose lock-screen controls.

## Required Pieces

- A native speech synthesis module that can return an audio asset usable by the player.
- An audio session configured with `shouldPlayInBackground: true`.
- `expo-audio` for playback and media controls.

## Playback Flow

1. User taps `Speak`.
2. The native TTS module synthesizes the requested text.
3. The resulting audio source is loaded into `expo-audio`.
4. The audio session stays active in the background.
5. The system lock screen can show play / pause / stop controls.

## iOS Notes

- iOS already supports background audio when the session is configured correctly.
- The app should preserve the current text and playback state if it returns to foreground.
- Pause and resume are enough for most lock-screen flows; stop should clear the current audio source.
- A source scaffold now exists at `ios/LocalTtsModule.swift`, but the iOS project itself is not generated in this repository yet.

## Open Questions

- Whether the native iOS TTS module should write a temporary file or stream directly.
- How to expose voice selection consistently with Android.
- When to generate the iOS project so the scaffold can be wired into the real target.
