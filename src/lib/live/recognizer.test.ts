import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Drives the recognizer with the event shape Chrome actually produces.
 *
 * The 31 Jul lecture came back with 27,823 words built from 534 unique ones,
 * because every onresult event re-emitted the finals that had already been
 * emitted. Chrome does not reliably advance event.resultIndex when
 * continuous is true, so the index cannot be trusted as "start from here".
 */

class FakeRecognition {
  static last: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;

  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
}

/** A SpeechRecognitionResultList as Chrome hands it over: cumulative. */
function results(items: Array<{ text: string; final: boolean }>) {
  const list: any = items.map((i) => {
    const r: any = [{ transcript: i.text }];
    r.isFinal = i.final;
    return r;
  });
  list.length = items.length;
  return list;
}

let createRecognizer: typeof import('./recognizer').createRecognizer;

beforeEach(async () => {
  FakeRecognition.last = null;
  const w = globalThis as any;
  w.window = w;
  w.SpeechRecognition = FakeRecognition;
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;
  vi.resetModules();
  ({ createRecognizer } = await import('./recognizer'));
});

function harness() {
  const finals: string[] = [];
  const interims: string[] = [];
  const rec = createRecognizer({
    onFinal: (t) => finals.push(t),
    onInterim: (t) => interims.push(t),
    onState: () => {},
  });
  rec.start();
  return { finals, interims, fire: (e: any) => FakeRecognition.last!.onresult!(e) };
}

describe('recognizer onresult', () => {
  it('emits a final exactly once even when resultIndex never advances', () => {
    const { finals, fire } = harness();

    // Chrome, continuous mode: resultIndex stays 0 while results accumulate.
    fire({ resultIndex: 0, results: results([{ text: 'innovation is', final: false }]) });
    fire({ resultIndex: 0, results: results([{ text: 'innovation is new', final: true }]) });
    fire({
      resultIndex: 0,
      results: results([
        { text: 'innovation is new', final: true },
        { text: 'and it', final: false },
      ]),
    });
    fire({
      resultIndex: 0,
      results: results([
        { text: 'innovation is new', final: true },
        { text: 'and it requires application', final: true },
      ]),
    });

    expect(finals).toEqual(['innovation is new', 'and it requires application']);
  });

  it('does not re-emit earlier finals as the lecture grows', () => {
    const { finals, fire } = harness();
    const spoken = ['one', 'two', 'three', 'four', 'five'];

    for (let n = 1; n <= spoken.length; n++) {
      fire({
        resultIndex: 0,
        results: results(spoken.slice(0, n).map((t) => ({ text: t, final: true }))),
      });
    }

    // Five utterances must yield five finals, not 1+2+3+4+5 = 15.
    expect(finals).toEqual(spoken);
  });

  it('still works when Chrome does advance resultIndex', () => {
    const { finals, fire } = harness();

    fire({ resultIndex: 0, results: results([{ text: 'alpha', final: true }]) });
    fire({
      resultIndex: 1,
      results: results([
        { text: 'alpha', final: true },
        { text: 'beta', final: true },
      ]),
    });

    expect(finals).toEqual(['alpha', 'beta']);
  });

  it('reports only the current interim text, never the accumulated finals', () => {
    const { interims, fire } = harness();

    fire({
      resultIndex: 0,
      results: results([
        { text: 'settled text', final: true },
        { text: 'still speaking', final: false },
      ]),
    });

    expect(interims.at(-1)).toBe('still speaking');
  });

  it('starts a fresh count after Chrome restarts recognition', () => {
    const { finals, fire } = harness();

    fire({ resultIndex: 0, results: results([{ text: 'before restart', final: true }]) });

    // Chrome ends continuous recognition every minute or so; the wrapper rebuilds.
    FakeRecognition.last!.onend!();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        FakeRecognition.last!.onresult!({
          resultIndex: 0,
          results: results([{ text: 'after restart', final: true }]),
        });
        expect(finals).toEqual(['before restart', 'after restart']);
        resolve();
      }, 400);
    });
  });
});
