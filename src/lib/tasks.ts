// Board logic for the task kanban.
//
// Tasks live as markdown in the repo, so a change is a commit and the site takes
// about two minutes to rebuild. A board that only showed built state would feel
// broken: you move a card, reload, and it snaps back. So local changes go into an
// overlay in localStorage and are merged over the built tasks until the rebuild
// catches up, at which point the override is dropped as redundant.
//
// The merge is pure and lives here so it can be tested without a browser.

export const BOARDS = ['workspace', 'iith', 'content'] as const;
export const STATUSES = ['todo', 'doing', 'done'] as const;

export type Board = (typeof BOARDS)[number];
export type TaskStatus = (typeof STATUSES)[number];

export const BOARD_META: Record<Board, { label: string; blurb: string }> = {
  workspace: { label: 'Workspace', blurb: 'Builds, clients, everything that is not coursework.' },
  iith: { label: 'IIT manager', blurb: 'Coursework, submissions, admin.' },
  content: { label: 'Content creation', blurb: 'Videos, writing, everything to publish.' },
};

export const STATUS_META: Record<TaskStatus, { label: string }> = {
  todo: { label: 'To do' },
  doing: { label: 'Doing' },
  done: { label: 'Done' },
};

export interface Task {
  slug: string;
  title: string;
  board: Board;
  status: TaskStatus;
  /** ISO yyyy-mm-dd, or empty. Kept as a string so nothing depends on a timezone. */
  due: string;
  created: string;
}

export interface Overlay {
  /** slug to status, for cards moved since the last build. */
  moved: Record<string, TaskStatus>;
  /** Tasks created locally that the build has not picked up yet. */
  added: Task[];
  /** Slugs deleted locally that the build still contains. */
  removed: string[];
}

export const EMPTY_OVERLAY: Overlay = { moved: {}, added: [], removed: [] };

export interface MergeResult {
  tasks: Task[];
  /** The overlay with entries the build has caught up on removed. */
  overlay: Overlay;
  /** True when something was dropped, so the caller knows to persist. */
  changed: boolean;
}

/**
 * Combine built tasks with local pending edits.
 *
 * Self healing on purpose: every entry that the built content now agrees with is
 * discarded, so the overlay drains to empty instead of growing forever and
 * masking the real state.
 */
export function mergeTasks(built: Task[], overlay: Overlay): MergeResult {
  const builtBySlug = new Map(built.map((t) => [t.slug, t]));

  const moved: Record<string, TaskStatus> = {};
  for (const [slug, status] of Object.entries(overlay.moved ?? {})) {
    const source = builtBySlug.get(slug);
    // Gone from the build, or the build already has this status: drop it.
    if (!source || source.status === status) continue;
    moved[slug] = status;
  }

  const removed = (overlay.removed ?? []).filter((slug) => builtBySlug.has(slug));
  const added = (overlay.added ?? []).filter((task) => !builtBySlug.has(task.slug));

  const removedSet = new Set(removed);
  const tasks = [
    ...built
      .filter((task) => !removedSet.has(task.slug))
      .map((task) => (moved[task.slug] ? { ...task, status: moved[task.slug] } : task)),
    ...added,
  ];

  const next: Overlay = { moved, added, removed };
  const changed =
    Object.keys(moved).length !== Object.keys(overlay.moved ?? {}).length ||
    added.length !== (overlay.added ?? []).length ||
    removed.length !== (overlay.removed ?? []).length;

  return { tasks, overlay: next, changed };
}

/** Cards for one column, newest first, with dated items ahead of undated ones. */
export function column(tasks: Task[], board: Board, status: TaskStatus): Task[] {
  return tasks
    .filter((task) => task.board === board && task.status === status)
    .sort((a, b) => {
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return b.created.localeCompare(a.created);
    });
}

/** How many are still open on a board, which is the number worth surfacing. */
export function openCount(tasks: Task[], board: Board): number {
  return tasks.filter((task) => task.board === board && task.status !== 'done').length;
}

/** The column a card moves to, or null at either end. */
export function nextStatus(status: TaskStatus, direction: 1 | -1): TaskStatus | null {
  const index = STATUSES.indexOf(status) + direction;
  return STATUSES[index] ?? null;
}

/** Filename-safe slug. Collisions are resolved by the caller appending a suffix. */
export function slugify(title: string, date: Date): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'task'}-${date.toISOString().slice(0, 10)}`;
}

export function taskMarkdown(task: Omit<Task, 'slug'>): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(task.title)}`,
    `board: ${task.board}`,
    `status: ${task.status}`,
  ];
  if (task.due) lines.push(`due: ${task.due}`);
  lines.push(`created: ${task.created}`, '---', '');
  return lines.join('\n');
}
