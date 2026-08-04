// Records the lecture audio alongside speech recognition, so the browser's
// transcript is never the only record of a class.
//
// Why this exists: Chrome's SpeechRecognition is built for short commands. On 90
// minutes of accented lecture speech at room distance it produces barely usable
// text, where Whisper on the same audio produces clean sentences. Keeping the
// audio means a bad live transcript is an inconvenience rather than a lost class.
//
// The audio never leaves the browser. It goes to IndexedDB on this origin and is
// deleted when the session is saved or discarded.

const DB_NAME = 'live-audio';
const DB_VERSION = 1;
const STORE = 'chunks';

/**
 * Opus at 32 kbps mono is about 20 MB for a 90 minute lecture. Whisper resamples
 * to 16 kHz mono anyway, so a higher bitrate would cost storage and buy nothing.
 */
export const AUDIO_BITS_PER_SECOND = 32_000;

/**
 * Flush to IndexedDB every 30s. A crash, a closed lid or a killed tab then costs
 * at most half a minute, which matches the promise the transcript mirror makes.
 */
export const CHUNK_MS = 30_000;

/** Ordered by preference; Chrome gives webm/opus, Safari gives mp4. */
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

/**
 * Pick a container the browser will actually produce.
 *
 * Passing an unsupported mimeType to MediaRecorder throws, and an empty string
 * means "you choose", which is the correct fallback rather than a hard failure.
 */
export function pickMimeType(isSupported: (type: string) => boolean): string {
  return CANDIDATE_TYPES.find((type) => isSupported(type)) ?? '';
}

/** File extension for the container we ended up with. */
export function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/** Human size for the UI. Bytes are meaningless to read mid lecture. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A recording filename that sorts and reads well: em5020-2026-08-03.webm */
export function audioFilename(slugPrefix: string, date: Date, mimeType: string): string {
  const iso = date.toISOString().slice(0, 10);
  const prefix = slugPrefix || 'lecture';
  return `${prefix}-${iso}.${extensionFor(mimeType)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // autoIncrement keeps the chunks in arrival order, which is the only
        // order in which they can be reassembled into a playable file.
        db.createObjectStore(STORE, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function appendChunk(blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, 'readwrite', (store) => store.add(blob));
  } finally {
    db.close();
  }
}

/** Everything recorded so far, reassembled in arrival order. */
export async function readRecording(mimeType: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const chunks = await tx<Blob[]>(db, 'readonly', (store) => store.getAll() as IDBRequest<Blob[]>);
    if (!chunks.length) return null;
    return new Blob(chunks, { type: mimeType || chunks[0].type });
  } finally {
    db.close();
  }
}

export async function recordedBytes(): Promise<number> {
  const db = await openDb();
  try {
    const chunks = await tx<Blob[]>(db, 'readonly', (store) => store.getAll() as IDBRequest<Blob[]>);
    return chunks.reduce((total, chunk) => total + chunk.size, 0);
  } finally {
    db.close();
  }
}

export async function clearRecording(): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, 'readwrite', (store) => store.clear());
  } finally {
    db.close();
  }
}

export type AudioState = 'recording' | 'unavailable' | 'stopped';

export interface AudioRecorder {
  start(): Promise<void>;
  stop(): void;
  mimeType(): string;
}

/**
 * Wraps MediaRecorder on its own microphone stream.
 *
 * SpeechRecognition opens the microphone itself and cannot be handed a
 * MediaStream, so this deliberately takes a second one. If that fails, for any
 * reason, the lecture must carry on with speech recognition alone: losing the
 * audio backup is bad, stopping the class recording over it is worse.
 */
export function createAudioRecorder(callbacks: {
  onState(state: AudioState, detail?: string): void;
  onProgress(bytes: number): void;
}): AudioRecorder {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let bytes = 0;
  let type = '';

  return {
    mimeType: () => type,

    async start() {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        callbacks.onState('unavailable', 'this browser cannot record audio');
        return;
      }
      try {
        // Deliberately permissive. Asking for specific constraints
        // (channelCount, echoCancellation: false) forces Chrome to reopen the
        // microphone in a different mode, and that reconfiguration kills the
        // capture SpeechRecognition is already holding: the transcript died the
        // moment recording started. Whisper resamples to 16 kHz mono anyway, so
        // the tighter constraints bought nothing worth that.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        type = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
        recorder = new MediaRecorder(
          stream,
          type
            ? { mimeType: type, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
            : { audioBitsPerSecond: AUDIO_BITS_PER_SECOND },
        );
        if (!type) type = recorder.mimeType;

        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          bytes += event.data.size;
          callbacks.onProgress(bytes);
          // Fire and forget: a failed write must not interrupt the recording.
          void appendChunk(event.data).catch(() => {
            callbacks.onState('unavailable', 'could not store audio, check disk space');
          });
        };

        recorder.start(CHUNK_MS);
        callbacks.onState('recording');
      } catch (err) {
        const reason = err instanceof Error && err.name === 'NotAllowedError'
          ? 'microphone permission denied for recording'
          : 'could not start the audio recording';
        callbacks.onState('unavailable', reason);
        this.stop();
      }
    },

    stop() {
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
      } catch {
        // already stopped
      }
      stream?.getTracks().forEach((track) => track.stop());
      recorder = null;
      stream = null;
      callbacks.onState('stopped');
    },
  };
}
