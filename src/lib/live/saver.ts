// Saving a finished lecture: build the markdown note file, commit it straight
// to the repo from the browser via the GitHub contents API, with download and
// copy as escape hatches that can never fail silently.

import { transcriptText, type LiveSession } from './session';

const OWNER = 'Hari487-coder';
const REPO = 'hari487-coder.github.io';
const DIR = 'src/content/notes';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function displayDate(d: Date): string {
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildMarkdown(
  session: LiveSession,
  date: Date,
): { slugBase: string; content: string; title: string } {
  const title = `${session.courseCode} lecture, ${displayDate(date)}${session.topic ? `: ${session.topic}` : ''}`;
  const body = session.notes.trim() || ['## Transcript', '', transcriptText(session).trim()].join('\n');
  const content = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `course: ${session.courseId}`,
    `date: ${isoDate(date)}`,
    '---',
    '',
    body,
    '',
  ].join('\n');
  return { slugBase: `${session.courseId}-${isoDate(date)}`, content, title };
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
}

export async function saveToRepo(args: {
  token: string;
  session: LiveSession;
  date: Date;
}): Promise<{ path: string; url: string; siteUrl: string }> {
  const { token, session, date } = args;
  const { slugBase, content, title } = buildMarkdown(session, date);

  // Find a free filename: base, then -2, -3... (second lecture the same day).
  let slug = slugBase;
  for (let i = 2; i <= 9; i++) {
    const head = await gh(token, `/repos/${OWNER}/${REPO}/contents/${DIR}/${slug}.md`);
    if (head.status === 404) break;
    if (!head.ok) throw new Error(`GitHub check failed (${head.status})`);
    slug = `${slugBase}-${i}`;
  }

  const put = await gh(token, `/repos/${OWNER}/${REPO}/contents/${DIR}/${slug}.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `notes: ${title}`,
      content: toBase64(content),
    }),
  });

  if (!put.ok) {
    const detail = await put.text().catch(() => '');
    throw new Error(`GitHub save failed (${put.status}): ${detail.slice(0, 200)}`);
  }

  const json = await put.json();
  return {
    path: `${DIR}/${slug}.md`,
    url: json.content?.html_url ?? `https://github.com/${OWNER}/${REPO}/blob/main/${DIR}/${slug}.md`,
    siteUrl: `https://hari487-coder.github.io/iith/notes/${slug}/`,
  };
}

export function downloadMd(session: LiveSession, date: Date): void {
  const { slugBase, content } = buildMarkdown(session, date);
  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slugBase}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
