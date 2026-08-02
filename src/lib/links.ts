// The link index behind the graph page and the backlink lists.
//
// Nodes are every content entry; edges come from explicit [[wikilinks]] in
// bodies plus the structural relations already in frontmatter.

import { getCollection } from 'astro:content';

export type NodeKind = 'course' | 'note' | 'assignment' | 'project';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub: string;
  href: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'wikilink' | 'structural';
}

export interface Backlink {
  label: string;
  href: string;
  kind: NodeKind;
}

/**
 * Lowercase, alphanumeric, single-spaced.
 * MUST match normalizeKey in src/lib/wikilink.mjs, which resolves the same
 * wikilinks during markdown rendering.
 */
function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;

export function nodeId(kind: NodeKind, id: string): string {
  return `${kind}:${id}`;
}

interface Index {
  nodes: GraphNode[];
  edges: GraphEdge[];
  backlinks: Map<string, Backlink[]>;
}

let cached: Index | null = null;

export async function linkIndex(): Promise<Index> {
  if (cached) return cached;

  const [courses, notes, assignments, projects] = await Promise.all([
    getCollection('courses'),
    getCollection('notes'),
    getCollection('assignments'),
    getCollection('projects'),
  ]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  /** normalized alias -> node id */
  const aliases = new Map<string, string>();
  /** node id -> raw markdown body */
  const bodies = new Map<string, string>();

  const register = (node: GraphNode, keys: (string | undefined)[], body: string) => {
    nodes.push(node);
    bodies.set(node.id, body);
    for (const key of keys) {
      if (!key) continue;
      const normalized = normalizeKey(key);
      if (normalized && !aliases.has(normalized)) aliases.set(normalized, node.id);
    }
  };

  const courseById = new Map(courses.map((c) => [c.id, c]));

  for (const c of courses) {
    register(
      {
        id: nodeId('course', c.id),
        kind: 'course',
        label: c.data.code,
        sub: c.data.name,
        href: `/iith/courses/${c.id}/`,
      },
      [c.id, c.data.code, c.data.name],
      c.body ?? '',
    );
  }

  for (const n of notes) {
    const node: GraphNode = {
      id: nodeId('note', n.id),
      kind: 'note',
      label: n.data.title,
      sub: courseById.get(n.data.course.id)?.data.code ?? 'Notes',
      href: `/iith/notes/${n.id}/`,
    };
    register(node, [n.id, n.data.title], n.body ?? '');
    edges.push({
      source: node.id,
      target: nodeId('course', n.data.course.id),
      kind: 'structural',
    });
  }

  for (const a of assignments) {
    const node: GraphNode = {
      id: nodeId('assignment', a.id),
      kind: 'assignment',
      label: a.data.title,
      sub: courseById.get(a.data.course.id)?.data.code ?? 'Assignment',
      href: '/iith/assignments/',
    };
    register(node, [a.id, a.data.title], a.body ?? '');
    edges.push({
      source: node.id,
      target: nodeId('course', a.data.course.id),
      kind: 'structural',
    });
  }

  for (const p of projects) {
    register(
      {
        id: nodeId('project', p.id),
        kind: 'project',
        label: p.data.title,
        sub: p.data.status,
        href: `/projects/${p.id}/`,
      },
      [p.id, p.data.title],
      p.body ?? '',
    );
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const backlinks = new Map<string, Backlink[]>();

  for (const [sourceId, body] of bodies) {
    const seen = new Set<string>();
    for (const match of body.matchAll(WIKILINK)) {
      const targetId = aliases.get(normalizeKey(match[1]));
      if (!targetId || targetId === sourceId || seen.has(targetId)) continue;
      seen.add(targetId);
      edges.push({ source: sourceId, target: targetId, kind: 'wikilink' });

      const source = nodeById.get(sourceId);
      if (!source) continue;
      const list = backlinks.get(targetId) ?? [];
      list.push({ label: source.label, href: source.href, kind: source.kind });
      backlinks.set(targetId, list);
    }
  }

  cached = { nodes, edges, backlinks };
  return cached;
}

export async function backlinksFor(kind: NodeKind, id: string): Promise<Backlink[]> {
  const { backlinks } = await linkIndex();
  return backlinks.get(nodeId(kind, id)) ?? [];
}
