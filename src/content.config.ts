import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
  schema: z.object({
    // Most IITH codes are 2 letters + 4 digits; NSS courses like CI101 use 3.
    code: z.string().regex(/^[A-Z]{2}\d{3,4}$/),
    name: z.string(),
    semester: z.number().int().min(1).max(4),
    credits: z.number().positive(),
    slot: z.string().optional(),
    room: z.string().optional(),
    instructor: z.string().optional(),
    /**
     * Real meeting times, when the instructor announces something other than
     * the published slot grid. Overrides the slot entirely. day: 0 = Monday.
     */
    meetings: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        }),
      )
      .optional(),
    /** Shown on the timetable when timings are unusual or in flux. */
    timingNote: z.string().optional(),
    status: z.enum(['ongoing', 'done', 'planned']),
  }),
});

const assignments = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/assignments' }),
  schema: z.object({
    title: z.string(),
    course: reference('courses'),
    due: z.coerce.date(),
    start: z.coerce.date().optional(),
    status: z.enum(['todo', 'doing', 'done']),
    link: z.string().url().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(200),
    stack: z.array(z.string()).min(1),
    status: z.enum(['live', 'building', 'parked', 'internal']),
    date: z.coerce.date(),
    repo: z.string().url().optional(),
    live: z.string().url().optional(),
    featured: z.boolean().default(false),
    icon: z.string().default('lucide:box'),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    /** Which part of the hub this note belongs to. */
    category: z.enum(['workspace', 'iith', 'content']).default('iith'),
    /** Only meaningful for iith notes; other categories have no course. */
    course: reference('courses').optional(),
    date: z.coerce.date(),
  }),
});

const ideas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ideas' }),
  schema: z.object({
    title: z.string(),
    /** application: coursework applied to a real project. content: something to make. */
    kind: z.enum(['application', 'content']),
    date: z.coerce.date(),
  }),
});

export const collections = { courses, assignments, projects, notes, ideas };
