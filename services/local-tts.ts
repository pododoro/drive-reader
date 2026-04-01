import { NativeModules, Platform } from 'react-native';

export type LocalTtsAudioSource = {
  uri: string;
  durationMs?: number;
  title?: string;
  artist?: string;
};

export type LocalTtsRequest = {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  language?: string;
};

export type LocalTtsEngine = {
  synthesize(request: LocalTtsRequest): Promise<LocalTtsAudioSource>;
  stop(): Promise<void>;
  clear(): Promise<void>;
};

type NativeLocalTtsModule = {
  synthesize(request: LocalTtsRequest): Promise<LocalTtsAudioSource>;
  stop(): Promise<void>;
  clear(): Promise<void>;
};

const nativeLocalTts = NativeModules.LocalTts as NativeLocalTtsModule | undefined;

export const LOCAL_TTS_PLAN = {
  android:
    'Native speech synthesis that writes audio files for expo-audio playback and lock-screen controls.',
  ios:
    'Native speech synthesis that writes audio files for expo-audio playback and lock-screen controls.',
  playback: 'Use expo-audio to play the generated audio source and expose pause / stop / resume controls.',
} as const;

export function isLocalTtsAvailable() {
  return Platform.OS === 'android' && !!nativeLocalTts;
}

export async function synthesizeLocalTts(request: LocalTtsRequest): Promise<LocalTtsAudioSource> {
  if (!nativeLocalTts?.synthesize) {
    throw new Error('Local TTS is not available on this platform.');
  }

  return nativeLocalTts.synthesize(request);
}

export async function stopLocalTts(): Promise<void> {
  if (!nativeLocalTts?.stop) {
    return;
  }

  await nativeLocalTts.stop();
}

export async function clearLocalTts(): Promise<void> {
  if (!nativeLocalTts?.clear) {
    return;
  }

  await nativeLocalTts.clear();
}
