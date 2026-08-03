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
  const category = session.category || 'iith';
  const isCourse = category === 'iith' && Boolean(session.courseId);

  const subject = isCourse ? session.courseCode : session.topic || CATEGORY_TITLE[category];
  const title = isCourse
    ? `${session.courseCode} lecture, ${displayDate(date)}${session.topic ? `: ${session.topic}` : ''}`
    : `${subject}, ${displayDate(date)}`;

  const body = session.notes.trim() || ['## Transcript', '', transcriptText(session).trim()].join('\n');

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `category: ${category}`,
    ...(isCourse ? [`course: ${session.courseId}`] : []),
    `date: ${isoDate(date)}`,
    '---',
  ];

  const slugPrefix = isCourse ? session.courseId : category;
  return {
    slugBase: `${slugPrefix}-${isoDate(date)}`,
    content: [...frontmatter, '', body, ''].join('\n'),
    title,
  };
}

const CATEGORY_TITLE: Record<string, string> = {
  projects: 'Project notes',
  workspace: 'Work notes',
  iith: 'Lecture notes',
  content: 'Content notes',
};

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
    siteUrl: `https://hari487-coder.github.io/notes/${result.slug}/`,
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
