// Whisper, in the browser. The audio never leaves the laptop.
//
// The ONNX runtime WASM is served from this origin (see scripts/copy-ort.mjs);
// only the model weights come from the Hugging Face CDN, and weights are data
// our own runtime consumes rather than executable code.

import { env, pipeline } from '@huggingface/transformers';
import { planAdtsChunks, type AdtsPlan } from './adts';

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

/**
 * Chrome's decodeAudioData ceiling, measured on Chrome 2026-08.
 *
 * It decodes the whole file to PCM at the file's OWN sample rate before
 * resampling to the context rate, and refuses more than 2^28 sample frames per
 * channel. Channel count does not count against it: 60 min of 44.1 kHz stereo
 * (158.8M frames) decodes, while 105 min of 44.1 kHz mono (277.8M) does not.
 * Over the line it throws a bare "EncodingError: Unable to decode audio data",
 * which is indistinguishable from an unsupported codec and sent us chasing the
 * wrong bug once already.
 *
 * In hours: ~101 min at 44.1 kHz, ~93 min at 48 kHz, ~4.6 h at 16 kHz.
 */
const MAX_FRAMES_PER_CHANNEL = 2 ** 28;

/**
 * Native seconds to decode at a time when we can split the file.
 *
 * 10 minutes is ~29M frames at 48 kHz, nine times under the ceiling, and it
 * also keeps the intermediate buffer small enough to matter on a phone.
 */
const DECODE_CHUNK_S = 600;

/** Whisper is single channel. */
function mixdown(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2;
  return mono;
}

/**
 * Report what actually went wrong.
 *
 * The old message blamed the codec and told people to convert to WAV, which is
 * exactly backwards when the cause is length: WAV is uncompressed, and the
 * ceiling is on samples, not bytes on disk.
 */
function decodeError(file: File, err: unknown, nativeRate?: number, frames?: number): Error {
  const real = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  if (nativeRate && frames && frames > MAX_FRAMES_PER_CHANNEL) {
    const minutes = Math.round(frames / nativeRate / 60);
    const ceiling = Math.round(MAX_FRAMES_PER_CHANNEL / nativeRate / 60);
    return new Error(
      `"${file.name}" is about ${minutes} minutes at ${(nativeRate / 1000).toFixed(1)} kHz, ` +
        `and Chrome will not decode more than about ${ceiling} minutes at that sample rate ` +
        'in one go. Split the recording into parts and import them one after another, or ' +
        're-encode it to 16 kHz mono, which raises the ceiling to roughly 4.5 hours. ' +
        `Converting to WAV will not help, the limit is on length rather than file size. (${real})`,
    );
  }

  return new Error(
    `Could not decode "${file.name}". Chrome rejected it, either because the codec is not ` +
      'one it supports or because the recording is too long to decode in one piece ' +
      '(roughly 100 minutes at 44.1 kHz). Splitting it into shorter parts fixes the second ' +
      `case; converting to m4a or mp3 fixes the first. (${real})`,
  );
}

/** Decode any browser-supported audio file to 16 kHz mono samples. */
export async function decodeAudio(file: File, onProgress?: Progress): Promise<Float32Array> {
  const Ctor: typeof AudioContext =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  const ctx = new Ctor({ sampleRate: SAMPLE_RATE });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const plan = planAdtsChunks(bytes, DECODE_CHUNK_S);

    if (plan && plan.ranges.length > 1) return decodeInChunks(ctx, bytes, plan, file, onProgress);

    try {
      // decodeAudioData detaches the buffer it is handed, which is fine here
      // because this is the last thing we do with it.
      return mixdown(await ctx.decodeAudioData(bytes.buffer as ArrayBuffer));
    } catch (err) {
      throw decodeError(file, err, plan?.sampleRate, plan?.totalSamples);
    }
  } finally {
    void ctx.close();
  }
}

/**
 * Decode a long self-framing stream one piece at a time.
 *
 * Each range starts on a syncword, so every piece is a valid stream on its own
 * and stays far under the per-call ceiling however long the lecture ran.
 */
async function decodeInChunks(
  ctx: AudioContext,
  bytes: Uint8Array,
  plan: AdtsPlan,
  file: File,
  onProgress?: Progress,
): Promise<Float32Array> {
  // The native frame count is known from the scan, so the 16 kHz length is too.
  // Writing into one array avoids the transient double allocation that
  // concatenating at the end would cost on a two hour recording.
  const expected = Math.ceil((plan.totalSamples * SAMPLE_RATE) / plan.sampleRate);
  let out = new Float32Array(expected + SAMPLE_RATE);
  let written = 0;

  for (let i = 0; i < plan.ranges.length; i++) {
    const [start, end] = plan.ranges[i];
    onProgress?.({
      status: 'decoding',
      detail: `decoding audio, part ${i + 1} of ${plan.ranges.length}`,
      pct: Math.round((i / plan.ranges.length) * 100),
    });

    let buffer: AudioBuffer;
    try {
      // slice copies, so each call owns the buffer it detaches.
      buffer = await ctx.decodeAudioData(bytes.slice(start, end).buffer);
    } catch (err) {
      throw decodeError(file, err, plan.sampleRate, plan.totalSamples);
    }

    const mono = mixdown(buffer);
    if (written + mono.length > out.length) {
      // Per chunk resampling rounding should never reach the slack above, but
      // growing beats silently dropping the tail of a lecture.
      const grown = new Float32Array(written + mono.length + SAMPLE_RATE);
      grown.set(out.subarray(0, written));
      out = grown;
    }
    out.set(mono, written);
    written += mono.length;

    // Yield so the progress text repaints between pieces.
    await new Promise((r) => setTimeout(r, 0));
  }

  return out.subarray(0, written);
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
  const audio = await decodeAudio(file, onProgress);

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
