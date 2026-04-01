import * as Speech from 'expo-speech';

type SpeechControllerHandlers = {
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

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

export function createSpeechController(handlers: SpeechControllerHandlers) {
  let runId = 0;

  const stop = async () => {
    runId += 1;
    await Speech.stop();
    handlers.onStatus('Speech stopped.');
  };

  const speak = async (input: string) => {
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

  return { speak, stop };
}
