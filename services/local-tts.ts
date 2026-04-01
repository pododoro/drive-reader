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

export const LOCAL_TTS_PLAN = {
  android: 'Native speech synthesis that returns audio the player can keep alive in a foreground service.',
  ios: 'Native speech synthesis that returns audio and enables background audio playback with lock-screen controls.',
  playback: 'Use expo-audio to play the generated audio source and expose pause / stop / resume controls.',
} as const;
