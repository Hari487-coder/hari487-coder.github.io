// The thinking sections: coursework applied to real projects, and content ideas.
// Both produce a saved page, so ideas compound instead of evaporating.

import Anthropic from '@anthropic-ai/sdk';
import { putNewFile } from './github';

const MODEL = 'claude-opus-5';

export interface Source {
  /** Wikilink target, so the saved page joins the graph. */
  slug: string;
  label: string;
  body: string;
}

function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function sourceBlock(sources: Source[]): string {
  return sources
    .map((s) => `<source slug="${s.slug}" label="${s.label}">\n${s.body.trim()}\n</source>`)
    .join('\n\n');
}

const SHARED_RULES = [
  'Reference anything you draw on with a wikilink using its slug, like [[em5090]] or [[mortgage-platform]], so the saved page links back to its sources.',
  'Never use em dashes or en dashes; use hyphens or commas.',
  'Be concrete and specific. No filler, no restating the source material back.',
  'Output Markdown only, starting with a "# " title line.',
].join('\n');

/** Coursework read against the things Hari actually builds. */
export async function brainstormApplications(args: {
  apiKey: string;
  notes: Source[];
  projects: Source[];
  focus: string;
}): Promise<string> {
  const { apiKey, notes, projects, focus } = args;

  const system = [
    'You are a sharp technical co-founder helping Hari turn what he is studying into',
    'moves on the products he actually runs.',
    '',
    'You get lecture notes from his M.Tech in Techno-Entrepreneurship at IIT Hyderabad,',
    'plus writeups of the software he has built and operates.',
    '',
    'Produce, in this order:',
    '1. "## What this course material actually says" - the load-bearing ideas only, in a few lines.',
    '2. "## Applied to what you are building" - the substance. For each relevant project, a specific',
    '   move: what the concept implies, what it would change, and why it matters for that product.',
    '   Prefer three sharp applications over eight shallow ones. Name the project with a wikilink.',
    '3. "## What this exposes" - gaps, risks, or wrong assumptions in the current products that this',
    '   material reveals. Say it plainly.',
    '4. "## Next actions" - a short checklist of things worth doing, each one concrete enough to start.',
    '',
    'Be honest when a connection is weak. A forced application is worse than saying the material',
    'does not bear on the products yet.',
    SHARED_RULES,
  ].join('\n');

  const user = [
    focus ? `Focus for this session: ${focus}\n` : '',
    'LECTURE NOTES:',
    sourceBlock(notes),
    '',
    'PROJECTS HE RUNS:',
    sourceBlock(projects),
  ].join('\n');

  const response = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return textOf(response);
}

/** Mode 1 of the studio: work out what he is positioned to make content about. */
export async function findContentAngles(args: {
  apiKey: string;
  sources: Source[];
}): Promise<string> {
  const system = [
    'You help Hari work out what content he is genuinely positioned to make, based on what he',
    'has actually done rather than on generic advice.',
    '',
    'He is an M.Tech Techno-Entrepreneurship student at IIT Hyderabad who also does customer',
    'success engineering at an AI voice startup, and ships real software constantly. He has not',
    'decided on a content direction yet. That is what this is for.',
    '',
    'Produce:',
    '1. "## What you actually have" - the raw material and unfair advantages visible in the sources.',
    '2. "## Directions worth taking" - four to six distinct directions. For each: who it is for, why',
    '   he specifically can own it, what the first five pieces would be, and the honest catch.',
    '3. "## What I would pick and why" - commit to a recommendation, with the reasoning.',
    '4. "## What to avoid" - directions that look attractive but he is not positioned for, or that',
    '   would leak client specifics.',
    '',
    'Be opinionated. Vague encouragement is useless here.',
    SHARED_RULES,
  ].join('\n');

  const response = await client(args.apiKey).messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [
      { role: 'user', content: `EVERYTHING IN HIS HUB:\n\n${sourceBlock(args.sources)}` },
    ],
  });

  return textOf(response);
}

/** Mode 2 of the studio: concrete pieces, video-first. */
export async function generateContentIdeas(args: {
  apiKey: string;
  sources: Source[];
  direction: string;
  format: string;
}): Promise<string> {
  const { apiKey, sources, direction, format } = args;

  const system = [
    'You turn Hari real work into specific content pieces he could make this week.',
    '',
    `Format to optimise for: ${format}.`,
    '',
    'Produce:',
    '1. "## Pieces" - five to eight concrete pieces. For each: a working title, the hook (the first',
    '   line or first three seconds), the angle, and what makes it worth watching or reading.',
    '2. "## Build one out" - take the single strongest piece and expand it. For video, give a',
    '   beat-by-beat shot list with rough timings and what is on screen for each beat, plus the',
    '   spoken line. For writing, give the full outline with the opening paragraph written out.',
    '3. "## Reusable" - what from his existing work can be shown directly: screen recordings, real',
    '   dashboards, actual code, before and after.',
    '',
    'Ground every piece in something real from the sources. Do not invent achievements.',
    'Keep client specifics out: describe employers and customers generically.',
    SHARED_RULES,
  ].join('\n');

  const user = [
    `Direction: ${direction || 'his strongest material, your call'}`,
    '',
    'SOURCE MATERIAL:',
    sourceBlock(sources),
  ].join('\n');

  const response = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return textOf(response);
}

function textOf(response: Anthropic.Message): string {
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('empty response');
  return text;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 52) || 'idea'
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** First "# " line becomes the page title; the rest is the body. */
export function splitTitle(markdown: string): { title: string; body: string } {
  const match = markdown.match(/^#\s+(.+)$/m);
  const title = match ? match[1].trim() : 'Untitled idea';
  const body = match ? markdown.replace(match[0], '').trim() : markdown;
  return { title, body };
}

export async function saveIdea(args: {
  token: string;
  markdown: string;
  kind: 'application' | 'content';
  date: Date;
}): Promise<{ path: string; url: string; siteUrl: string }> {
  const { token, markdown, kind, date } = args;
  const { title, body } = splitTitle(markdown);
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const content = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `kind: ${kind}`,
    `date: ${iso}`,
    '---',
    '',
    body,
    '',
  ].join('\n');

  const result = await putNewFile({
    token,
    dir: 'src/content/ideas',
    slugBase: `${iso}-${slugify(title)}`,
    content,
    message: `idea: ${title}`,
  });

  return {
    path: result.path,
    url: result.url,
    siteUrl: `https://hari487-coder.github.io/ideas/${result.slug}/`,
  };
}
