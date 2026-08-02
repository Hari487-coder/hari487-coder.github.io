# Memory Graph + Obsidian Vault — Design Spec

**Date:** 2026-07-31
**Status:** Approved by Hari (design conversation, 2026-07-31)

## What this is

Turn the life hub's content from separate files into a linked knowledge graph, usable
both on the site and inside the real Obsidian app.

## Decisions settled with Hari

1. **Both**: an Obsidian-style graph page on the site AND `src/content/` set up as a
   real Obsidian vault.
2. Wikilinks (`[[target]]`, `[[target|label]]`) work in every collection body.
3. Graph rendered with `d3-force` bundled via npm (not an external script tag, so the
   zero-third-party-scripts guardrail holds).
4. Also in scope: a **Test key** button in the live recorder settings that verifies the
   Anthropic key works before class.

## Wikilinks

- Syntax: `[[slug]]`, `[[Exact Title]]`, `[[target|custom label]]`.
- Resolution (identical rule in both the remark plugin and the site-side helper):
  normalize to lowercase alphanumeric-with-single-spaces, then match against (a) entry
  id/slug, (b) entry title. Courses additionally match their `code` (e.g. `[[EM5090]]`).
- Resolved -> `<a class="wikilink">`; unresolved -> `<span class="wikilink-missing">`
  (visible but muted, Obsidian behavior: the link exists, the note does not yet).
- Implemented as a remark plugin (`src/lib/wikilink.mjs`) wired in `astro.config.mjs`,
  so it applies to every markdown body site-wide.

## URL map (single source of truth)

| Collection | Page |
|---|---|
| courses | `/iith/courses/<id>/` |
| notes | `/iith/notes/<id>/` |
| projects | `/projects/<id>/` |
| assignments | `/iith/assignments/` (no per-assignment page; links land on the list) |

## Graph page (`/graph/`)

- Nodes: every course, note, assignment, project. Edges from (a) wikilinks between
  bodies, (b) structural relations already in frontmatter: assignment -> course,
  note -> course.
- Canvas force-directed layout (d3-force), Daybreak colors: courses iris, notes good
  green, assignments warning amber, projects ink. Node radius scales with degree.
- Interactions: hover highlights a node and its neighbors (dims the rest), click opens
  the page, drag repositions, type filters as chips, search input focuses matches.
- Reduced motion: simulation runs a fixed number of ticks then renders statically.
- Mobile: full-width canvas, touch drag, labels only on larger nodes.

## Backlinks

`src/lib/links.ts` builds the link index once per build and exposes `backlinksFor()`.
A `Backlinks.astro` component renders a "Linked from" list on note, course, and project
pages when non-empty.

## Obsidian vault

`src/content/.obsidian/` committed with `app.json` (wikilinks on, shortest link format)
and `graph.json` (color groups matching the site). Opening `src/content` as a vault in
Obsidian gives Hari the same notes, links, and graph locally; edits push and render on
the site. The live recorder and inbox write into this folder, so captured work appears
in the vault automatically.

## Test key button (live recorder)

Settings panel gains a "Test key" button: one minimal `claude-haiku-4-5` call
(`max_tokens: 1`); reports "key works", "key rejected" (401), or the transport error.
Key never leaves localStorage; nothing is committed.

## Out of scope (YAGNI)

Tag pages, graph clustering/communities, embeds (`![[...]]`), Obsidian plugin configs,
publishing the vault separately, editing notes from the graph.

## Success criteria

- `[[em5090]]` in any body renders as a working link; a bogus target renders muted.
- `/graph/` shows every entry, edges are correct, click navigates, filters work.
- Backlinks appear on pages that are linked to.
- Opening `src/content` in Obsidian shows the same graph and links.
- Test key button distinguishes a working key from a rejected one.
- Zero third-party script tags in the built HTML; no em/en dashes.
