// The AI loop: periodically feed Claude the current notes plus only the new
// transcript since the last successful call, get back the full updated notes.
// The cursor advances ONLY on success, so a failed call never loses transcript.

import Anthropic from '@anthropic-ai/sdk';
import { transcriptText, type LiveSession } from './session';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 4096;

/** Minimum new final-transcript chars before a tick is worth an API call. */
export const MIN_DELTA_CHARS = 200;

function systemPrompt(session: LiveSession): string {
  return [
    'You are a meticulous live note-taker sitting in a university lecture.',
    `Course: ${session.courseCode} ${session.courseName}.`,
    session.topic ? `Lecture topic: ${session.topic}.` : '',
    '',
    'You receive the notes so far and a new chunk of raw speech-to-text transcript.',
    'Return the COMPLETE updated notes in clean Markdown, nothing else. Rules:',
    '- Structure with ## headings by topic as the lecture develops; use bullet points, definitions, formulas, and worked examples.',
    '- Fix obvious speech-to-text errors from context (technical terms, names, numbers).',
    '- Preserve existing notes content and structure; extend and refine, never drop information.',
    '- If the professor signals importance (exam, assignment, deadline, "this will be tested"), record it under a "## Exam and action items" section at the end.',
    '- Ignore filler, small talk, and administrative chatter unless it is an action item.',
    '- Never use em dashes or en dashes; use hyphens or commas.',
    '- Keep the notes compact and information-dense. Do not pad.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function updateNotes(args: {
  apiKey: string;
  session: LiveSession;
}): Promise<{ notes: string; cursor: number }> {
  const { apiKey, session } = args;
  const full = transcriptText(session);
  const delta = full.slice(session.cursor);
  if (!delta.trim()) return { notes: session.notes, cursor: session.cursor };

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt(session),
    messages: [
      {
        role: 'user',
        content: [
          'NOTES SO FAR (Markdown, may be empty):',
          '<notes>',
          session.notes || '(none yet)',
          '</notes>',
          '',
          'NEW TRANSCRIPT CHUNK:',
          '<transcript>',
          delta.trim(),
          '</transcript>',
          '',
          'Return the complete updated notes in Markdown only.',
        ].join('\n'),
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  if (!text) throw new Error('empty notes response');

  return { notes: text, cursor: full.length };
}

/**
 * One-shot notes from uploaded material: slide photos, PDFs, or a transcript
 * produced locally from a recording.
 *
 * Uses Opus rather than the live loop's Haiku on purpose. This runs once per
 * lecture instead of every 90 seconds, so the quality is worth the few cents,
 * and reading dense slides is a harder task than extending existing notes.
 */
export async function notesFromSources(args: {
  apiKey: string;
  courseCode: string;
  courseName: string;
  topic: string;
  blocks: unknown[];
  sourceSummary: string;
}): Promise<string> {
  const { apiKey, courseCode, courseName, topic, blocks, sourceSummary } = args;
  if (!blocks.length) throw new Error('nothing to convert');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

  const system = [
    'You turn raw lecture material into a single set of clean, structured study notes.',
    `Course: ${courseCode} ${courseName}.`,
    topic ? `Topic: ${topic}.` : '',
    '',
    'The material may be photos of slides or a blackboard, PDF handouts, or a',
    'speech-to-text transcript of a recording. Treat everything provided as ONE',
    'lecture and produce ONE coherent set of notes, not a per-file summary.',
    '',
    'Rules:',
    '- Structure with ## headings by topic; use bullets, definitions, formulas and worked examples.',
    '- Transcribe formulas, diagrams and tables faithfully. Describe a diagram in words when it carries meaning.',
    '- Fix obvious speech-to-text and OCR errors from context, especially technical terms.',
    '- If the material flags something as important, examinable, or an action item, collect those under a final "## Exam and action items" section.',
    '- If something is genuinely unreadable, write "(unclear in source)" rather than guessing. Never invent content that is not there.',
    '- Never use em dashes or en dashes; use hyphens or commas.',
    '- Output Markdown only, no preamble.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system,
    messages: [
      {
        role: 'user',
        content: [
          ...(blocks as any[]),
          {
            type: 'text',
            text: `The material above is ${sourceSummary}. Produce the complete lecture notes in Markdown.`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  if (!text) throw new Error('empty notes response');
  return text;
}
