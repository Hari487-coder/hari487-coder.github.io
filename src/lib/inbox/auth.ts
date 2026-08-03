// Scriptless Google OAuth: plain implicit redirect flow against
// accounts.google.com, so the site keeps its zero-third-party-scripts rule.
// The short-lived access token lives in sessionStorage (this tab only).

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * Hari's Google OAuth client ID.
 *
 * This is NOT a secret and is safe in a public repo: OAuth client IDs are sent
 * to the browser on every Google sign-in page. Security comes from the
 * authorized JavaScript origins and redirect URIs configured on the client,
 * not from hiding this string. The confidential half is the client secret,
 * which the implicit flow does not use and this site never holds.
 *
 * Baked in so sign-in works on any browser without pasting it first; the
 * settings field still overrides it (see resolveClientId).
 */
export const DEFAULT_CLIENT_ID =
  '409923533357-j7cq10ncqh0114hl5vu7rqfdnkelkasi.apps.googleusercontent.com';

/** Stored override wins, so a different client can be tried without a rebuild. */
export function resolveClientId(): string {
  try {
    return (localStorage.getItem('inbox.clientId') ?? '').trim() || DEFAULT_CLIENT_ID;
  } catch {
    return DEFAULT_CLIENT_ID;
  }
}

export const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

const TOKEN_KEY = 'inbox.token';
const STATE_KEY = 'inbox.state';

export function buildAuthUrl(clientId: string): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${location.origin}/iith/inbox/`,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function beginAuth(clientId: string): void {
  location.assign(buildAuthUrl(clientId));
}

export type RedirectResult = { token: string } | { error: string } | null;

/** Call once on page load. Parses and strips the OAuth response fragment. */
export function handleRedirect(): RedirectResult {
  if (!location.hash || location.hash.length < 2) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const error = params.get('error');
  const token = params.get('access_token');
  if (!error && !token) return null;

  history.replaceState(null, '', location.pathname + location.search);

  if (error) return { error };

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!expectedState || params.get('state') !== expectedState) {
    return { error: 'state_mismatch' };
  }

  const expiresIn = Number(params.get('expires_in') ?? '3600');
  const record = { token: token!, exp: Date.now() + (expiresIn - 60) * 1000 };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(record));
  return { token: token! };
}

export function getToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record.token || Date.now() >= record.exp) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return record.token;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Human explanation for OAuth error codes we expect to see. */
export function explainAuthError(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'You declined the Google consent screen. Connect again and allow read-only access.';
    case 'admin_policy_enforced':
    case 'org_internal':
      return 'Your IITH Google Workspace blocks this app. Ask IITH IT to allow it, or check the OAuth client configuration.';
    case 'state_mismatch':
      return 'The sign-in response could not be verified. Try connecting again.';
    case 'invalid_client':
      return 'The OAuth client ID is wrong. Check it in settings below.';
    default:
      return `Google sign-in failed (${code}). Try connecting again.`;
  }
}
