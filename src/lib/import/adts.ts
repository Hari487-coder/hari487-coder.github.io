/**
 * Minimal ADTS (raw .aac) frame walker, used to split a long recording into
 * byte ranges that Chrome will actually decode.
 *
 * Why this exists: decodeAudioData decodes the WHOLE file to PCM at the file's
 * own sample rate before resampling to the AudioContext rate, and Chrome caps
 * that intermediate allocation at 1 GiB. Measured on Chrome 2026-08: a 100 min
 * 44.1 kHz mono file decodes (1.06 GB) and a 105 min one does not (1.11 GB),
 * failing with a bare "EncodingError: Unable to decode audio data" that looks
 * exactly like an unsupported codec. A two hour lecture needs ~1.27 GB and so
 * always fails, whatever the codec.
 *
 * ADTS is self framing: every frame carries a syncword and its own length, so
 * a stream can be cut at any frame boundary and each piece decodes on its own.
 * That is not true of MP4/M4A, which needs a real demuxer, so this returns null
 * for anything it cannot walk and the caller falls back to a whole file decode.
 */

/** ISO/IEC 14496-3 sampling_frequency_index. */
const SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

const HEADER_BYTES = 7;

export interface AdtsPlan {
  /** The stream's own sample rate, which is what the 1 GiB cap is measured in. */
  sampleRate: number;
  /** Total decodable samples per channel, from complete frames only. */
  totalSamples: number;
  /** Half open [start, end) byte ranges, each aligned to a frame boundary. */
  ranges: Array<[number, number]>;
}

/** A frame starts with 12 sync bits and layer 00. */
function isSync(b: Uint8Array, i: number): boolean {
  return (
    i + HEADER_BYTES <= b.length &&
    b[i] === 0xff &&
    (b[i + 1] & 0xf6) === 0xf0 // 1111 0xx0: sync tail + layer 00
  );
}

/** .aac files in the wild often carry an ID3v2 tag before the first frame. */
function id3Length(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  // A syncsafe 28 bit integer: 7 bits per byte.
  const size =
    ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
  return 10 + size;
}

/**
 * Walk the frames and group them into chunks of at most `maxSecondsPerChunk`.
 *
 * Returns null when the bytes are not a stream we can walk, which is the signal
 * to fall back rather than to fail: guessing at cut points in a container we do
 * not understand would corrupt the audio silently.
 */
export function planAdtsChunks(bytes: Uint8Array, maxSecondsPerChunk: number): AdtsPlan | null {
  let pos = id3Length(bytes);
  if (!isSync(bytes, pos)) return null;

  const sampleRate = SAMPLE_RATES[(bytes[pos + 2] >> 2) & 0x0f];
  if (!sampleRate) return null;

  const maxSamples = Math.max(1, Math.floor(maxSecondsPerChunk * sampleRate));
  const ranges: Array<[number, number]> = [];
  let chunkStart = pos;
  let chunkSamples = 0;
  let totalSamples = 0;
  let frames = 0;

  while (isSync(bytes, pos)) {
    const frameLength =
      ((bytes[pos + 3] & 0x03) << 11) | (bytes[pos + 4] << 3) | (bytes[pos + 5] >> 5);
    // A truncated or nonsense tail ends the walk; we keep what decoded cleanly.
    if (frameLength < HEADER_BYTES || pos + frameLength > bytes.length) break;

    const frameSamples = 1024 * ((bytes[pos + 6] & 0x03) + 1);

    // Close the chunk BEFORE the frame that would overflow it, so every range
    // starts exactly on a syncword.
    if (chunkSamples > 0 && chunkSamples + frameSamples > maxSamples) {
      ranges.push([chunkStart, pos]);
      chunkStart = pos;
      chunkSamples = 0;
    }

    chunkSamples += frameSamples;
    totalSamples += frameSamples;
    pos += frameLength;
    frames++;
  }

  if (frames === 0) return null;
  if (chunkSamples > 0) ranges.push([chunkStart, pos]);

  return { sampleRate, totalSamples, ranges };
}
