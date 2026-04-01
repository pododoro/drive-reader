import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import {
  clearLocalTts,
  isLocalTtsAvailable,
  synthesizeLocalTts,
  stopLocalTts,
} from './local-tts';

type SpeechControllerHandlers = {
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

type PlaybackPlayer = ReturnType<typeof createAudioPlayer>;

function splitTextForSpeech(input: string, maxChunkLength = 3800) {
  const normalized = input.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const limit = Math.max(1000, Math.min(maxChunkLength, Speech.maxSpeechInputLength - 1));
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    current = '';
  };

  const pushHardSplit = (text: string) => {
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + limit, text.length);
      if (end < text.length) {
        const window = text.slice(start, end);
        const breakPoints = [
          window.lastIndexOf('\n'),
          window.lastIndexOf('. '),
          window.lastIndexOf('! '),
          window.lastIndexOf('? '),
          window.lastIndexOf(', '),
          window.lastIndexOf('; '),
        ];
        const breakPoint = Math.max(...breakPoints);
        if (breakPoint > Math.floor(limit * 0.6)) {
          end = start + breakPoint + 1;
        }
      }

      const part = text.slice(start, end).trim();
      if (part) {
        chunks.push(part);
      }
      start = end;
    }
  };

  for (const line of normalized.split('\n')) {
    const segment = line.trim();
    if (!segment) {
      if (current) {
        current += '\n';
      }
      continue;
    }

    if (segment.length > limit) {
      if (current) {
        pushCurrent();
      }
      pushHardSplit(segment);
      continue;
    }

    const candidate = current ? `${current}\n${segment}` : segment;
    if (candidate.length > limit && current) {
      pushCurrent();
      current = segment;
      continue;
    }

    current = candidate;
  }

  if (current) {
    pushCurrent();
  }

  return chunks;
}

function getLockScreenMetadata() {
  return {
    title: 'Drive Reader',
    artist: 'Local TTS',
    album: 'Drive Reader',
  };
}

export function createSpeechController(handlers: SpeechControllerHandlers) {
  let runId = 0;
  let currentPlayer: PlaybackPlayer | null = null;
  let currentSubscription: { remove: () => void } | null = null;

  const releasePlayer = async () => {
    currentSubscription?.remove();
    currentSubscription = null;

    if (!currentPlayer) {
      return;
    }

    try {
      currentPlayer.clearLockScreenControls();
    } catch {
      // Ignore lock-screen cleanup failures.
    }

    try {
      currentPlayer.pause();
    } catch {
      // Ignore pause failures during teardown.
    }

    try {
      currentPlayer.remove();
    } catch {
      // Ignore dispose failures during teardown.
    }

    currentPlayer = null;
  };

  const stop = async () => {
    runId += 1;

    await stopLocalTts();
    await releasePlayer();
    await clearLocalTts();

    handlers.onStatus('Speech stopped.');
  };

  const speakWithExpoSpeech = async (input: string) => {
    const content = input.trim();
    if (!content) {
      handlers.onStatus('Type or load some text before speaking.');
      return;
    }

    await Speech.stop();
    const chunks = splitTextForSpeech(content);
    if (!chunks.length) {
      handlers.onStatus('Type or load some text before speaking.');
      return;
    }

    const currentRun = ++runId;
    const total = chunks.length;
    const speakChunk = (chunk: string, index: number) =>
      new Promise<void>((resolve, reject) => {
        Speech.speak(chunk, {
          rate: 0.96,
          pitch: 1.0,
          onStart: () => {
            if (currentRun === runId) {
              handlers.onStatus(`Speaking part ${index + 1} of ${total}.`);
            }
          },
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => reject(new Error('Speech failed to start.')),
        });
      });

    try {
      if (total === 1) {
        handlers.onStatus('Speaking now.');
      } else {
        handlers.onStatus(`Speaking long text in ${total} parts.`);
      }

      for (let i = 0; i < chunks.length; i += 1) {
        if (currentRun !== runId) {
          return;
        }
        await speakChunk(chunks[i], i);
      }

      if (currentRun === runId) {
        handlers.onStatus('Finished speaking.');
      }
    } catch (error) {
      if (currentRun === runId) {
        const message = error instanceof Error ? error.message : 'Speech failed to start.';
        handlers.onError(message);
      }
    }
  };

  const speakWithLocalAudio = async (input: string) => {
    const content = input.trim();
    if (!content) {
      handlers.onStatus('Type or load some text before speaking.');
      return;
    }

    const currentRun = ++runId;

    await stopLocalTts();
    await releasePlayer();
    await clearLocalTts();

    try {
      handlers.onStatus('Preparing local audio.');
      const audio = await synthesizeLocalTts({
        text: content,
        rate: 0.96,
        pitch: 1,
        language: 'en-US',
      });

      if (currentRun !== runId) {
        return;
      }

      const player = createAudioPlayer(audio.uri, {
        keepAudioSessionActive: true,
      });
      currentPlayer = player;
      currentSubscription = player.addListener('playbackStatusUpdate', async (status) => {
        if (currentRun !== runId) {
          return;
        }

        if (status.isBuffering) {
          handlers.onStatus('Loading audio.');
          return;
        }

        if (status.playing) {
          handlers.onStatus('Speaking now.');
          return;
        }

        if (status.didJustFinish) {
          await releasePlayer();
          await clearLocalTts();
          if (currentRun === runId) {
            handlers.onStatus('Finished speaking.');
          }
        }
      });

      try {
        player.setActiveForLockScreen(true, getLockScreenMetadata());
      } catch {
        // The player still works without lock-screen activation.
      }

      player.play();
      handlers.onStatus('Speaking now.');
    } catch (error) {
      if (currentRun === runId) {
        const message = error instanceof Error ? error.message : 'Speech failed to start.';
        handlers.onError(message);
      }
      await releasePlayer();
      await clearLocalTts();
    }
  };

  const speak = async (input: string) => {
    if (Platform.OS === 'android' && isLocalTtsAvailable()) {
      await speakWithLocalAudio(input);
      return;
    }

    await speakWithExpoSpeech(input);
  };

  return { speak, stop };
}
