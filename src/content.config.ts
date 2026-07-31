import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
  schema: z.object({
    code: z.string().regex(/^[A-Z]{2}\d{4}$/),
    name: z.string(),
    semester: z.number().int().min(1).max(4),
    credits: z.number().positive(),
    slot: z.string().optional(),
    instructor: z.string().optional(),
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
  }),
});

export const collections = { courses, assignments, projects };
