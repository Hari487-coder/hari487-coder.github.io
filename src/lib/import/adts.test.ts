import { describe, expect, it } from 'vitest';
import { planAdtsChunks } from './adts';

/** Build one ADTS frame: 7 byte header + filler payload. */
function frame(sfIndex: number, payloadBytes = 9, channels = 1): Uint8Array {
  const length = 7 + payloadBytes;
  const f = new Uint8Array(length);
  f[0] = 0xff;
  f[1] = 0xf1; // sync tail, MPEG-4, layer 00, no CRC
  f[2] = (1 << 6) | ((sfIndex & 0x0f) << 2) | ((channels >> 2) & 0x01);
  f[3] = ((channels & 0x03) << 6) | ((length >> 11) & 0x03);
  f[4] = (length >> 3) & 0xff;
  f[5] = ((length & 0x07) << 5) | 0x1f;
  f[6] = 0xfc; // one raw data block, so 1024 samples
  return f;
}

function stream(count: number, sfIndex = 4): Uint8Array {
  const one = frame(sfIndex);
  const out = new Uint8Array(one.length * count);
  for (let i = 0; i < count; i++) out.set(one, i * one.length);
  return out;
}

const SR_44100 = 4;

describe('planAdtsChunks', () => {
  it('returns null for bytes that are not an ADTS stream', () => {
    expect(planAdtsChunks(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 900)).toBeNull();
  });

  it('returns null for a reserved sample rate index', () => {
    // Index 15 has no defined rate, so we must not guess one.
    expect(planAdtsChunks(stream(4, 15), 900)).toBeNull();
  });

  it('reads the sample rate out of the header', () => {
    expect(planAdtsChunks(stream(4, SR_44100), 900)?.sampleRate).toBe(44100);
    expect(planAdtsChunks(stream(4, 8), 900)?.sampleRate).toBe(16000);
  });

  it('counts 1024 samples per frame', () => {
    expect(planAdtsChunks(stream(10, SR_44100), 900)?.totalSamples).toBe(10240);
  });

  it('keeps a short stream in a single range covering every byte', () => {
    const bytes = stream(10, SR_44100);
    const plan = planAdtsChunks(bytes, 900)!;
    expect(plan.ranges).toEqual([[0, bytes.length]]);
  });

  it('splits a long stream into chunks under the limit', () => {
    // 100 frames of 1024 samples at 44100 Hz is ~2.32 s. A 1 s cap gives
    // 43 frames per chunk (44100/1024 = 43.06), so three chunks.
    const bytes = stream(100, SR_44100);
    const plan = planAdtsChunks(bytes, 1)!;
    expect(plan.ranges.length).toBe(3);
    for (const [start, end] of plan.ranges) {
      const seconds = ((end - start) / 16) * (1024 / 44100); // 16 bytes per frame here
      expect(seconds).toBeLessThanOrEqual(1);
    }
  });

  it('produces contiguous ranges that cover the whole stream', () => {
    const bytes = stream(100, SR_44100);
    const { ranges } = planAdtsChunks(bytes, 1)!;
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(bytes.length);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1]);
  });

  it('starts every range on a syncword, which is what makes the pieces decodable', () => {
    const bytes = stream(100, SR_44100);
    for (const [start] of planAdtsChunks(bytes, 1)!.ranges) {
      expect(bytes[start]).toBe(0xff);
      expect(bytes[start + 1] & 0xf6).toBe(0xf0);
    }
  });

  it('skips an ID3v2 tag before the first frame', () => {
    const tag = new Uint8Array(10 + 40);
    tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // "ID3"
    tag[9] = 40; // syncsafe size of the tag body
    const frames = stream(5, SR_44100);
    const bytes = new Uint8Array(tag.length + frames.length);
    bytes.set(tag, 0);
    bytes.set(frames, tag.length);

    const plan = planAdtsChunks(bytes, 900)!;
    expect(plan.totalSamples).toBe(5120);
    expect(plan.ranges).toEqual([[tag.length, bytes.length]]);
  });

  it('drops a truncated final frame rather than handing Chrome a partial one', () => {
    const whole = stream(5, SR_44100);
    const cut = whole.slice(0, whole.length - 4);
    const plan = planAdtsChunks(cut, 900)!;
    expect(plan.totalSamples).toBe(4096); // four complete frames, not five
    expect(plan.ranges).toEqual([[0, 64]]);
  });

  it('rejects a frame whose declared length is impossible', () => {
    const bad = frame(SR_44100);
    bad[3] = 0x00; bad[4] = 0x00; bad[5] = 0x00; // declared length 0
    expect(planAdtsChunks(bad, 900)).toBeNull();
  });
});
