// One-click track: turn a pending Classroom item into a site assignment file.

import { putNewFile } from '../github';
import type { PendingItem } from './classroom';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'assignment'
  );
}

export async function trackAssignment(args: {
  ghToken: string;
  item: PendingItem;
  courseId: string;
}): Promise<{ path: string }> {
  const { ghToken, item, courseId } = args;
  const due = item.due ?? new Date(Date.now() + 7 * 86_400_000);
  const content = [
    '---',
    `title: ${JSON.stringify(item.title)}`,
    `course: ${courseId}`,
    `due: ${isoDate(due)}`,
    'status: todo',
    `link: ${item.link}`,
    '---',
    '',
    `Tracked from Google Classroom (${item.courseName}).`,
    '',
  ].join('\n');

  const result = await putNewFile({
    token: ghToken,
    dir: 'src/content/assignments',
    slugBase: `${courseId}-${slugify(item.title)}`,
    content,
    message: `assignment: ${item.title}`,
  });
  return { path: result.path };
}
