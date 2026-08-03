// Notes are not only coursework. The hub captures four kinds of thinking, and
// every note belongs to exactly one of them.

export const CATEGORIES = ['workspace', 'iith', 'content'] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  blurb: string;
  icon: string;
  /** Notes in this category hang off a course. */
  course: boolean;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  workspace: {
    id: 'workspace',
    label: 'Workspace',
    blurb: 'Work: meetings, calls, decisions, what shipped.',
    icon: 'lucide:briefcase',
    course: false,
  },
  iith: {
    id: 'iith',
    label: 'IIT manager',
    blurb: 'Lectures and coursework, tied to a course.',
    icon: 'lucide:graduation-cap',
    course: true,
  },
  content: {
    id: 'content',
    label: 'Content creation',
    blurb: 'Scripts, hooks, and notes toward things you publish.',
    icon: 'lucide:clapperboard',
    course: false,
  },
};

export const CATEGORY_LIST: CategoryMeta[] = CATEGORIES.map((c) => CATEGORY_META[c]);

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
