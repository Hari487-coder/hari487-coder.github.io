// Obsidian-style [[wikilinks]] in every markdown body.
//
// Runs as a remark plugin, so it executes inside Vite without access to
// astro:content. The target map is therefore built by reading the content dir
// from disk. The normalization rule here MUST stay identical to the one in
// src/lib/links.ts, which powers the graph and backlinks.

import fs from 'node:fs';
import path from 'node:path';
import { SKIP, visit } from 'unist-util-visit';

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content');

const COLLECTIONS = [
  { dir: 'courses', href: (id) => `/iith/courses/${id}/`, kind: 'course' },
  { dir: 'notes', href: (id) => `/notes/${id}/`, kind: 'note' },
  { dir: 'projects', href: (id) => `/projects/${id}/`, kind: 'project' },
  { dir: 'assignments', href: () => '/iith/assignments/', kind: 'assignment' },
];

/** Lowercase, alphanumeric, single-spaced. The shared matching key. */
export function normalizeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function frontmatterField(raw, field) {
  const match = raw.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

let cache = { at: 0, map: new Map() };

function targetMap() {
  // Short TTL keeps `astro dev` correct when a file is added mid-session
  // without re-reading the tree for every markdown node.
  if (Date.now() - cache.at < 1000) return cache.map;

  const map = new Map();
  for (const collection of COLLECTIONS) {
    const dir = path.join(CONTENT_DIR, collection.dir);
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }
    for (const file of files) {
      const id = file.replace(/\.md$/, '');
      const href = collection.href(id);
      let raw = '';
      try {
        raw = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 800);
      } catch {
        continue;
      }
      const keys = [id, frontmatterField(raw, 'title'), frontmatterField(raw, 'code')];
      for (const key of keys) {
        if (!key) continue;
        const normalized = normalizeKey(key);
        if (normalized && !map.has(normalized)) map.set(normalized, href);
      }
    }
  }
  cache = { at: Date.now(), map };
  return map;
}

const PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function remarkWikilinks() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;
      if (!node.value.includes('[[')) return;

      const map = targetMap();
      const nodes = [];
      let cursor = 0;
      PATTERN.lastIndex = 0;

      for (const match of node.value.matchAll(PATTERN)) {
        const [full, rawTarget, rawLabel] = match;
        const start = match.index ?? 0;
        if (start > cursor) {
          nodes.push({ type: 'text', value: node.value.slice(cursor, start) });
        }

        const label = escapeHtml((rawLabel ?? rawTarget).trim());
        const href = map.get(normalizeKey(rawTarget));
        nodes.push({
          type: 'html',
          value: href
            ? `<a class="wikilink" href="${href}">${label}</a>`
            : `<span class="wikilink-missing" title="No page named ${escapeHtml(rawTarget.trim())} yet">${label}</span>`,
        });

        cursor = start + full.length;
      }

      if (!nodes.length) return;
      if (cursor < node.value.length) {
        nodes.push({ type: 'text', value: node.value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...nodes);
      return [SKIP, index + nodes.length];
    });
  };
}
