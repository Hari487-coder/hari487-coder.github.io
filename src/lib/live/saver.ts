// Saving a finished lecture: build the markdown note file, commit it straight
// to the repo from the browser via the GitHub contents API, with download and
// copy as escape hatches that can never fail silently.

import { putNewFile } from '../github';
import { transcriptText, type LiveSession } from './session';

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

export async function saveToRepo(args: {
  token: string;
  session: LiveSession;
  date: Date;
}): Promise<{ path: string; url: string; siteUrl: string }> {
  const { token, session, date } = args;
  const { slugBase, content, title } = buildMarkdown(session, date);

  const result = await putNewFile({
    token,
    dir: DIR,
    slugBase,
    content,
    message: `notes: ${title}`,
  });

  return {
    path: result.path,
    url: result.url,
    siteUrl: `https://hari487-coder.github.io/iith/notes/${result.slug}/`,
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
