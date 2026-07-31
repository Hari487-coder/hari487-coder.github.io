// Chrome SpeechRecognition wrapper for lecture-length capture.
// Chrome silently ends continuous recognition after silence or ~60s chunks;
// the wrapper treats every end-while-active as "restart immediately".

export type RecognizerState = 'listening' | 'restarting' | 'stopped' | 'unsupported' | 'denied';

export interface RecognizerCallbacks {
  onFinal(text: string): void;
  onInterim(text: string): void;
  onState(state: RecognizerState): void;
}

export interface Recognizer {
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => any;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSupported(): boolean {
  return getCtor() !== null;
}

export function createRecognizer(cb: RecognizerCallbacks): Recognizer {
  const Ctor = getCtor();
  let active = false;
  let rec: any = null;
  let restartTimer: number | undefined;

  if (!Ctor) {
    cb.onState('unsupported');
    return { start() {}, stop() {} };
  }

  function build(): any {
    const r = new Ctor!();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-IN';

    r.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          if (text.trim()) cb.onFinal(text.trim());
        } else {
          interim += text;
        }
      }
      cb.onInterim(interim);
    };

    r.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        active = false;
        cb.onState('denied');
      }
      // 'no-speech', 'network', 'aborted': onend fires next and handles restart.
    };

    r.onend = () => {
      if (!active) {
        cb.onState('stopped');
        return;
      }
      cb.onState('restarting');
      // Small delay avoids a tight failure loop when the service is unhappy.
      restartTimer = window.setTimeout(() => {
        if (!active) return;
        try {
          rec = build();
          rec.start();
          cb.onState('listening');
        } catch {
          // start() can throw if called while another instance winds down; retry once more.
          restartTimer = window.setTimeout(() => {
            if (!active) return;
            rec = build();
            rec.start();
            cb.onState('listening');
          }, 700);
        }
      }, 300);
    };

    return r;
  }

  return {
    start() {
      if (active) return;
      active = true;
      rec = build();
      rec.start();
      cb.onState('listening');
    },
    stop() {
      active = false;
      window.clearTimeout(restartTimer);
      try {
        rec?.stop();
      } catch {
        // already stopped
      }
      cb.onState('stopped');
    },
  };
}
