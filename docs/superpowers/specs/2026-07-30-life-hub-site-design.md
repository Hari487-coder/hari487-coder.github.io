# Hari's Life Hub — Design Spec

**Date:** 2026-07-30
**Status:** Approved by Hari (design conversation, 2026-07-30)

## What this is

A public personal site that is Hari's single place to manage and showcase his life's work:
his IITH coursework (courses, assignments, deadlines) and every project he builds.
Hari is the primary audience — it is his command center that happens to be public.
Visitors (recruiters, peers) are secondary beneficiaries.

## Core decisions (settled with Hari)

1. **Public portfolio / life record** — not a private dashboard, no auth, no backend.
2. **Managed via Claude Code + git** — all content is files in the repo; Hari (or any
   Claude Code session) edits/adds markdown, commits, pushes; the site auto-deploys.
3. **Stack: Astro + content collections.** Typed frontmatter (zod schemas) validated at
   build time; zero client JS by default.
4. **Hosting: GitHub Pages** via the user-site repo `Hari487-coder.github.io`, serving at
   the root `https://hari487-coder.github.io/`. Repo must be public (free Pages).
5. **Custom domain later.** Hari will buy a domain; attaching it is CNAME file + DNS,
   zero rework. Until then the site lives on the free subdomain.

## Layout

Persistent left sidebar (Linear/Notion-style workspace), collapsing to a drawer on mobile:

- Identity block: name + one-liner.
- Nav: **Home**, **IITH** (Courses, Assignments), **Projects**, **About**.

Pages:

- **Home** — dashboard: assignments due soon (due within the next 7 days, plus anything
  overdue, flagged), current courses, latest projects. "Open this and know where my
  life stands."
- **IITH → Courses** — index of courses grouped by semester; each course page shows
  code, name, semester, credits, status, notes (body), and its assignments.
- **IITH → Assignments** — single list grouped by status (todo / doing / done),
  sorted by due date, overdue flagged.
- **Projects** — card grid of all builds; each project page: writeup (body), stack,
  repo/live links, status (live / building / parked), date.
- **About** — who Hari is, what he does (Assistable AI, IITH), contact links.

## Content model

Astro content collections under `src/content/`, one markdown file per item,
frontmatter validated by zod schemas:

- `courses/<code>.md` — `code`, `name`, `semester`, `credits`, `status: ongoing|done|planned`.
  Body = free-form notes.
- `assignments/<slug>.md` — `title`, `course` (reference to a course entry), `due` (date),
  `status: todo|doing|done`, optional `link`. Body = details.
- `projects/<slug>.md` — `title`, `summary`, `stack: string[]`, optional `repo`, optional
  `live`, `status: live|building|parked`, `date`, optional `cover`. Body = full writeup.

A repo `CLAUDE.md` documents these conventions so any future Claude Code session can
execute "add assignment: OS quiz 2, due Friday" or "mark X done" correctly: write file →
commit → push → live in ~1 minute. Git history doubles as a permanent activity log.

## Deploy pipeline

GitHub Actions on push to `main`: install → `astro build` (schema validation runs here) →
deploy to GitHub Pages. A bad date or missing field fails the build; broken content never
ships. No servers, no cost, nothing to keep alive.

## Look and feel

Clean, fast, personal-workspace aesthetic with dark mode. Designed intentionally at
implementation time using the standing design skills (frontend-design, ui-ux-pro-max,
taste-skill); explicitly not a cookie-cutter template.

## Constraints & guardrails

- **Everything in the repo is public.** Never commit grades, personal documents, or
  anything sensitive. Course names, deadlines, project writeups are fine.
- **No backend, no auth, no database** — if browser editing is ever wanted, the plain
  markdown content ports anywhere; nothing is locked in.
- **YAGNI:** no blog, no semester entity (derived from courses), no search, no CMS.
  Add only when actually needed.

## Error handling & testing

- Content schema validation at build time is the primary correctness gate.
- CI: build must pass before deploy (single workflow, build+deploy stages).
- Manual smoke: dashboard renders due-soon logic correctly around date boundaries
  (computed at build; site rebuilds on every content push, so staleness is bounded by
  push frequency — acceptable for this use).

## Success criteria

- Hari can add/update a course, assignment, or project with one sentence to Claude Code
  and see it live within ~2 minutes.
- Home dashboard accurately reflects due-soon/overdue state after each push.
- Site loads fast (static, near-zero JS), works on mobile, has dark mode.
- Custom domain attaches later with DNS + CNAME only.
