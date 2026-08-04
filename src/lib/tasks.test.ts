import { describe, expect, it } from 'vitest';
import {
  column,
  EMPTY_OVERLAY,
  mergeTasks,
  nextStatus,
  openCount,
  slugify,
  taskMarkdown,
  type Task,
} from './tasks';

const task = (over: Partial<Task> = {}): Task => ({
  slug: 'a',
  title: 'A',
  board: 'workspace',
  status: 'todo',
  due: '',
  created: '2026-08-01',
  ...over,
});

describe('mergeTasks', () => {
  it('returns built tasks untouched when there is nothing pending', () => {
    const built = [task({ slug: 'a' }), task({ slug: 'b' })];
    const result = mergeTasks(built, EMPTY_OVERLAY);
    expect(result.tasks).toEqual(built);
    expect(result.changed).toBe(false);
  });

  it('applies a pending move over the built status', () => {
    const built = [task({ slug: 'a', status: 'todo' })];
    const { tasks } = mergeTasks(built, { moved: { a: 'doing' }, added: [], removed: [] });
    expect(tasks[0].status).toBe('doing');
  });

  it('drops a move once the rebuild agrees, so the overlay drains', () => {
    const built = [task({ slug: 'a', status: 'doing' })];
    const result = mergeTasks(built, { moved: { a: 'doing' }, added: [], removed: [] });
    expect(result.overlay.moved).toEqual({});
    expect(result.changed).toBe(true);
    expect(result.tasks[0].status).toBe('doing');
  });

  it('shows a locally added task the build has not seen yet', () => {
    const fresh = task({ slug: 'new', title: 'New thing' });
    const { tasks } = mergeTasks([], { moved: {}, added: [fresh], removed: [] });
    expect(tasks).toEqual([fresh]);
  });

  it('stops duplicating an added task once the build contains it', () => {
    const built = [task({ slug: 'new', title: 'New thing' })];
    const result = mergeTasks(built, { moved: {}, added: [task({ slug: 'new' })], removed: [] });
    expect(result.tasks).toHaveLength(1);
    expect(result.overlay.added).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('hides a locally removed task until the build catches up', () => {
    const built = [task({ slug: 'a' }), task({ slug: 'b' })];
    const result = mergeTasks(built, { moved: {}, added: [], removed: ['a'] });
    expect(result.tasks.map((t) => t.slug)).toEqual(['b']);
    expect(result.overlay.removed).toEqual(['a']);
  });

  it('forgets a removal once the task is actually gone from the build', () => {
    const result = mergeTasks([task({ slug: 'b' })], { moved: {}, added: [], removed: ['a'] });
    expect(result.overlay.removed).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('drops a move for a task that no longer exists', () => {
    const result = mergeTasks([], { moved: { gone: 'done' }, added: [], removed: [] });
    expect(result.overlay.moved).toEqual({});
  });

  it('tolerates a malformed overlay rather than throwing', () => {
    const result = mergeTasks([task()], {} as never);
    expect(result.tasks).toHaveLength(1);
  });
});

describe('column', () => {
  it('selects only the matching board and status', () => {
    const tasks = [
      task({ slug: 'a', board: 'workspace', status: 'todo' }),
      task({ slug: 'b', board: 'iith', status: 'todo' }),
      task({ slug: 'c', board: 'workspace', status: 'done' }),
    ];
    expect(column(tasks, 'workspace', 'todo').map((t) => t.slug)).toEqual(['a']);
  });

  it('puts the soonest due date first and undated work last', () => {
    const tasks = [
      task({ slug: 'none', due: '', created: '2026-08-05' }),
      task({ slug: 'late', due: '2026-09-01' }),
      task({ slug: 'soon', due: '2026-08-10' }),
    ];
    expect(column(tasks, 'workspace', 'todo').map((t) => t.slug)).toEqual(['soon', 'late', 'none']);
  });

  it('falls back to newest first when nothing is dated', () => {
    const tasks = [
      task({ slug: 'old', created: '2026-08-01' }),
      task({ slug: 'new', created: '2026-08-09' }),
    ];
    expect(column(tasks, 'workspace', 'todo').map((t) => t.slug)).toEqual(['new', 'old']);
  });
});

describe('openCount', () => {
  it('counts everything that is not done', () => {
    const tasks = [
      task({ slug: 'a', status: 'todo' }),
      task({ slug: 'b', status: 'doing' }),
      task({ slug: 'c', status: 'done' }),
      task({ slug: 'd', board: 'iith', status: 'todo' }),
    ];
    expect(openCount(tasks, 'workspace')).toBe(2);
  });
});

describe('nextStatus', () => {
  it('walks the columns and stops at both ends', () => {
    expect(nextStatus('todo', 1)).toBe('doing');
    expect(nextStatus('doing', 1)).toBe('done');
    expect(nextStatus('done', 1)).toBeNull();
    expect(nextStatus('todo', -1)).toBeNull();
  });
});

describe('slugify', () => {
  it('produces a filename-safe slug carrying the date', () => {
    expect(slugify('Send Anthony the county pricing', new Date('2026-08-04T00:00:00Z')))
      .toBe('send-anthony-the-county-pricing-2026-08-04');
  });

  it('survives a title with no usable characters', () => {
    expect(slugify('!!!', new Date('2026-08-04T00:00:00Z'))).toBe('task-2026-08-04');
  });
});

describe('taskMarkdown', () => {
  it('writes frontmatter the collection schema accepts', () => {
    const md = taskMarkdown({
      title: 'Write journal',
      board: 'iith',
      status: 'todo',
      due: '2026-08-05',
      created: '2026-08-04',
    });
    expect(md).toContain('title: "Write journal"');
    expect(md).toContain('board: iith');
    expect(md).toContain('due: 2026-08-05');
  });

  it('omits due entirely when there is none, since the schema wants it absent', () => {
    const md = taskMarkdown({
      title: 'No date',
      board: 'workspace',
      status: 'todo',
      due: '',
      created: '2026-08-04',
    });
    expect(md).not.toContain('due:');
  });

  it('escapes a title containing quotes', () => {
    const md = taskMarkdown({
      title: 'Fix the "live" recorder',
      board: 'workspace',
      status: 'doing',
      due: '',
      created: '2026-08-04',
    });
    expect(md).toContain('title: "Fix the \\"live\\" recorder"');
  });
});
