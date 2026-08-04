import { describe, expect, it } from 'vitest';
import { audioFilename, extensionFor, formatBytes, pickMimeType } from './audio';

describe('pickMimeType', () => {
  it('prefers webm/opus, which is what Chrome actually gives us', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus');
  });

  it('falls back through the list rather than failing', () => {
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType((t) => t === 'audio/ogg;codecs=opus')).toBe('audio/ogg;codecs=opus');
  });

  it('returns empty string when nothing matches, so MediaRecorder can choose', () => {
    // Passing an unsupported mimeType throws; "" means "you decide".
    expect(pickMimeType(() => false)).toBe('');
  });
});

describe('extensionFor', () => {
  it('maps each container to the extension a player expects', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
  });

  it('defaults to webm when the browser reported nothing', () => {
    expect(extensionFor('')).toBe('webm');
  });
});

describe('formatBytes', () => {
  it('keeps the number readable at every scale a lecture reaches', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(21 * 1024 * 1024)).toBe('21.0 MB');
  });
});

describe('audioFilename', () => {
  it('matches the note slug so the pair is obvious in a downloads folder', () => {
    const name = audioFilename('em5020', new Date('2026-08-03T10:43:00Z'), 'audio/webm;codecs=opus');
    expect(name).toBe('em5020-2026-08-03.webm');
  });

  it('falls back to a generic prefix for non course categories', () => {
    const name = audioFilename('', new Date('2026-08-03T10:43:00Z'), 'audio/mp4');
    expect(name).toBe('lecture-2026-08-03.m4a');
  });
});
