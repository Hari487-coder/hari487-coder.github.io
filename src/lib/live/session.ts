// Live session state, mirrored to localStorage so a crash, a closed lid, or an
// accidental navigation can never lose a lecture. Cleared on save or discard.

export interface LiveSession {
  courseId: string;
  courseCode: string;
  courseName: string;
  topic: string;
  startedAt: number;
  finals: string[];
  notes: string;
  /** Chars of the concatenated finals text already incorporated into notes. */
  cursor: number;
}

const KEY = 'live.session';

export function createSession(args: {
  courseId: string;
  courseCode: string;
  courseName: string;
  topic: string;
}): LiveSession {
  return { ...args, startedAt: Date.now(), finals: [], notes: '', cursor: 0 };
}

export function loadSession(): LiveSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.finals)) return null;
    return s as LiveSession;
  } catch {
    return null;
  }
}

let saveTimer: number | undefined;

/** Throttled mirror write (~2s) so onresult bursts don't hammer localStorage. */
export function persistSession(session: LiveSession): void {
  if (saveTimer !== undefined) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // Quota errors: nothing sane to do; download remains the escape hatch.
    }
  }, 2000);
}

export function persistSessionNow(session: LiveSession): void {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // see above
  }
}

export function clearSession(): void {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  localStorage.removeItem(KEY);
}

export function transcriptText(session: LiveSession): string {
  return session.finals.join(' ');
}

export function wordCount(session: LiveSession): number {
  const t = transcriptText(session).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function elapsed(session: LiveSession): string {
  const s = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
