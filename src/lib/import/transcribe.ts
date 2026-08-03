// Whisper, in the browser. The audio never leaves the laptop.
//
// The ONNX runtime WASM is served from this origin (see scripts/copy-ort.mjs);
// only the model weights come from the Hugging Face CDN, and weights are data
// our own runtime consumes rather than executable code.

import { env, pipeline } from '@huggingface/transformers';

const MODEL = 'onnx-community/whisper-base.en';

/**
 * Point the runtime at our own copy of the WASM.
 *
 * Called lazily rather than at module scope for two reasons: a failure here
 * must not break the photo and PDF paths that share this page, and if the
 * config shape ever moves we want a loud error instead of a silent fall back
 * to the CDN, which would put third-party executable code on the origin that
 * holds the API keys.
 */
function configureRuntime(): void {
  const wasm = env.backends?.onnx?.wasm;
  if (!wasm) {
    throw new Error(
      'Could not point the ONNX runtime at the local WASM, so transcription was stopped rather than loading a third-party runtime.',
    );
  }
  wasm.wasmPaths = '/ort/';
  env.allowLocalModels = false;
}

/** Whisper expects 16 kHz mono. */
const SAMPLE_RATE = 16_000;

export type Progress = (info: { status: string; detail?: string; pct?: number }) => void;

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as any).gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

let pipePromise: Promise<any> | null = null;

/**
 * Loads the model once per page. The first call downloads roughly 50MB of
 * weights, which the browser then caches.
 */
export async function loadTranscriber(onProgress?: Progress): Promise<any> {
  if (pipePromise) return pipePromise;
  configureRuntime();
  const device = (await hasWebGPU()) ? 'webgpu' : 'wasm';
  onProgress?.({
    status: 'loading',
    detail: device === 'webgpu' ? 'loading model (WebGPU)' : 'loading model (CPU, slower)',
  });

  pipePromise = pipeline('automatic-speech-recognition', MODEL, {
    device,
    dtype: 'q8',
    progress_callback: (p: any) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        onProgress?.({
          status: 'loading',
          detail: `downloading model ${Math.round(p.progress)}%`,
          pct: p.progress,
        });
      }
    },
  }).catch((err) => {
    pipePromise = null;
    throw err;
  });

  return pipePromise;
}

/** Decode any browser-supported audio file to 16 kHz mono samples. */
export async function decodeAudio(file: File): Promise<Float32Array> {
  const Ctor: typeof AudioContext =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  const ctx = new Ctor({ sampleRate: SAMPLE_RATE });
  try {
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    } catch (err) {
      // Chrome refuses some container/codec combinations outright, and very
      // large files can fail the allocation instead.
      throw new Error(
        `Could not decode "${file.name}". Chrome could not read this audio. ` +
          'Converting it to WAV or MP3 usually fixes it, and splitting a very long ' +
          'recording into parts helps if the file is large.',
      );
    }

    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);

    // Mix down to mono; Whisper is single channel.
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2;
    return mono;
  } finally {
    void ctx.close();
  }
}

/**
 * Transcribe in windows rather than one call.
 *
 * A 90 minute lecture is ~86 million samples. Handing that to the pipeline in
 * a single call builds tensors proportional to the whole recording and falls
 * over in the browser. Windowing keeps peak memory flat regardless of length,
 * and gives real progress instead of an hour of silence.
 */
const WINDOW_S = 240;

function readText(result: unknown): string {
  if (Array.isArray(result)) return result.map((r: any) => r?.text ?? '').join(' ');
  return String((result as any)?.text ?? '');
}

export async function transcribe(file: File, onProgress?: Progress): Promise<string> {
  const asr = await loadTranscriber(onProgress);

  onProgress?.({ status: 'decoding', detail: 'decoding audio' });
  const audio = await decodeAudio(file);

  const totalSeconds = audio.length / SAMPLE_RATE;
  const label =
    totalSeconds < 90
      ? `${Math.max(1, Math.round(totalSeconds))} sec`
      : `${Math.round(totalSeconds / 60)} min`;

  const windowSamples = WINDOW_S * SAMPLE_RATE;
  const windows = Math.max(1, Math.ceil(audio.length / windowSamples));

  if (windows === 1) {
    onProgress?.({
      status: 'transcribing',
      detail: `transcribing ${label} of audio on this machine`,
    });
    const result = await asr(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });
    return readText(result).trim();
  }

  const parts: string[] = [];
  for (let i = 0; i < windows; i++) {
    onProgress?.({
      status: 'transcribing',
      detail: `transcribing ${label} of audio, part ${i + 1} of ${windows}`,
      pct: Math.round((i / windows) * 100),
    });
    // subarray is a view, so windowing costs no extra memory.
    const slice = audio.subarray(i * windowSamples, Math.min((i + 1) * windowSamples, audio.length));
    const result = await asr(slice, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });
    parts.push(readText(result).trim());
    // Yield to the event loop so the progress text repaints between windows.
    await new Promise((r) => setTimeout(r, 0));
  }

  return parts.filter(Boolean).join(' ').trim();
}
