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
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
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

export async function transcribe(file: File, onProgress?: Progress): Promise<string> {
  const asr = await loadTranscriber(onProgress);

  onProgress?.({ status: 'decoding', detail: 'decoding audio' });
  const audio = await decodeAudio(file);
  const minutes = Math.round(audio.length / SAMPLE_RATE / 60);

  onProgress?.({
    status: 'transcribing',
    detail: `transcribing ${minutes} min of audio, this runs on your machine`,
  });

  const result = await asr(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });

  const text = Array.isArray(result)
    ? result.map((r: any) => r.text).join(' ')
    : (result?.text ?? '');
  return String(text).trim();
}
