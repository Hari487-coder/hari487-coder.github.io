# Hari's Life Hub (hari487-coder.github.io)

Hari's public life ledger: IITH coursework + every project he ships, managed entirely
through Claude Code + git. Push to `main` deploys to https://hari487-coder.github.io/
via GitHub Actions in about a minute. A daily 03:00 IST cron rebuild keeps date math
(due-soon, burn fuses) honest; manual runs via workflow_dispatch.

**Everything in this repo is public.** Never commit grades, personal documents, client
names, or internal company data. Project writeups describe clients generically.

## Content model (this is how you manage the site)

All content is markdown with typed frontmatter under `src/content/`. Invalid frontmatter
FAILS the build, so the live site cannot silently corrupt. Filename = URL slug.

### Add a course: `src/content/courses/<code-lowercase>.md`

```markdown
---
code: EM5090            # 2 uppercase letters + 4 digits, required
name: Course Name
semester: 1             # 1-4
credits: 3
slot: Q                 # optional
instructor: Dr. Name    # optional
status: ongoing         # ongoing | done | planned
---

Free-form notes (rendered on the course page).
```

### Add an assignment: `src/content/assignments/<slug>.md`

```markdown
---
title: EM5090 problem set 2
course: em5090          # must match a course filename
due: 2026-08-21         # YYYY-MM-DD, IST
start: 2026-08-10       # optional; fuse window start (default: due minus 14d)
status: todo            # todo | doing | done
link: https://...       # optional
---

Details (optional).
```

### Add a project: `src/content/projects/<slug>.md`

```markdown
---
title: Project Name
summary: One sentence, max 200 chars.
stack: [TypeScript, Astro]
status: live            # live | building | parked | internal
date: 2026-07-31        # ship/last-milestone date, drives ordering
repo: https://...       # optional, only if public
live: https://...       # optional
featured: false         # true = warm wash highlight
---

Writeup, 150-300 words, field-log voice: what it does, what it runs on, what shipped,
one honest lesson. No client names. No marketing adjectives.
```

### Lecture notes: `src/content/notes/<courseId>-<yyyy-mm-dd>.md`

Usually created by the Live notes recorder (below), but hand-editable like everything else.

```markdown
---
title: "EM5090 lecture, 31 Jul 2026: cash flow statements"
course: em5090          # must match a course filename
date: 2026-07-31
---

Markdown notes body.
```

## Live lecture recorder (`/iith/live/`)

Fully client-side page Hari opens in class (Chrome only): browser speech recognition
(en-IN, auto-restart, wake lock) streams a transcript; every ~90s Claude
(`claude-haiku-4-5`, official SDK in browser mode) turns the new transcript into
updated structured notes; Stop -> Save commits the note file above straight to this
repo via the GitHub contents API and the site rebuilds.

- Secrets live in localStorage ONLY: `live.anthropicKey` (Anthropic API key) and
  `live.githubToken` (fine-grained PAT: THIS repo only, contents read-write). Never
  commit keys; the page ships zero third-party scripts - keep it that way.
- Session state mirrors to `live.session` in localStorage; a crash or navigation can
  never lose a lecture (restore banner on next visit). Cursor semantics: transcript
  chars advance only on successful AI calls, so failures never drop text.
- Degrades honestly: no key = free transcriber; no token = download/copy; no
  SpeechRecognition = "use Chrome" notice.
- Code: `src/lib/live/{recognizer,session,notesEngine,saver}.ts` + `src/pages/iith/live.astro`.
  A debug hook (`window.__live.injectFinal/tick/state`) exercises the pipeline without a mic.
- Human rules (documented on the page): get the professor's permission to record;
  Chrome STT sends audio to Google; saved notes are public.

## Playbooks

- **"add assignment X due Friday"**: create the file, `git add`, commit, push. Done.
- **"mark X done"**: change `status:` to `done`, commit, push.
- **"new semester"**: add course files with the new `semester:` number; the courses page
  groups automatically; set finished courses to `status: done`.
- **Replace sample data**: the three seeded assignments are samples (marked with an HTML
  comment in each file); replace them with real ones as they arrive.
- **Custom domain later**: add a `CNAME` file containing the domain to `public/`,
  configure DNS (A records to GitHub Pages IPs or CNAME to hari487-coder.github.io),
  then set the domain in repo Settings > Pages. Nothing else changes.

## Design guardrails (Daybreak; do not drift)

The design system is "Daybreak", ported VERBATIM from the mortgage-platform web app
(`mortgage-platform/apps/web/app/globals.css` is the upstream source of truth). If the
platform's design evolves and Hari wants parity, re-port tokens from there.

- Tokens in `src/styles/global.css` are IMMUTABLE: lavender-white surfaces (#f6f6fb page,
  white cards), one iris accent (#5857d6 family), ink-pill buttons, dawn aurora backdrop.
  Never hand-write a hex in a page; add or reuse a token.
- Light only, by design (matches the platform). No dark mode, no theme toggle.
- Fonts: Geist (UI/body), Bricolage Grotesque (display: h1, card h2, big numbers),
  JetBrains Mono (data: dates, codes, stacks). Never a serif.
- Icons: lucide via astro-icon (`lucide:*`); never emoji-as-icon. Project cards take an
  `icon` frontmatter field (lucide name).
- Components: .card / .card-interactive, .badge (good/warning/critical/accent + dot),
  .stat-tile, .market-grid + .market-card (projects), .row-list rows, .page-head with
  .eyebrow + h1 + .subtitle, .empty-state. Reuse these; do not invent parallel ones.
- ZERO em/en dashes in visible text. Hyphens only. (Check: search dist for the chars.)
- All motion behind prefers-reduced-motion (global 0.001ms override matches platform).
- Known inherited contrast margins (platform-shipped, kept for fidelity): warning/critical
  badge tints and dim sidebar section labels sit slightly under 4.5:1. Do not "fix" them
  without also changing the platform; parity wins here.

## Memory graph, wikilinks, and the Obsidian vault

`src/content/` IS an Obsidian vault (`.obsidian/` config committed, `README.md` explains
it). Open that folder in Obsidian and you get the same notes, links, and graph locally;
edit, commit, push, and the site matches.

- **Wikilinks** work in every markdown body: `[[em5090]]`, `[[EM5090]]`, the exact title,
  or `[[em5090|custom label]]`. Resolved at build time by `src/lib/wikilink.mjs` (a
  remark plugin wired in astro.config.mjs); unresolved targets render as muted
  `.wikilink-missing` spans rather than disappearing.
- **The matching rule is duplicated on purpose** in `wikilink.mjs` (runs in Vite, reads
  content from disk) and `src/lib/links.ts` (runs in Astro, uses getCollection). If you
  change normalization in one, change it in the other or links and graph edges drift.
- **`/graph/`** renders every entry as a node (courses iris, notes green, assignments
  amber, projects ink) with wikilink + structural edges, using bundled `d3-force` on a
  canvas. Gotcha baked in: the simulation is rAF-driven and browsers pause rAF in hidden
  tabs, so the page pre-ticks 60 steps and paints once synchronously; a ResizeObserver
  (not a window resize listener) re-sizes it, so a canvas that starts at zero size can
  never stay blank.
- **Backlinks** ("Linked from") appear on note, course, and project pages via
  `src/components/Backlinks.astro`.
- Astro 7 note: remark plugins require `@astrojs/markdown-remark` to be installed
  explicitly, since Astro 7's default markdown processor is no longer unified-based.

## Timetable (`/iith/timetable/`)

Weekly grid built from `src/lib/slots.ts` (the IITH slot grid, ported from the
iith-course-planner project with its provenance noted) crossed with each course's
`slot`. Also exports the whole semester as an .ics with weekly recurrence to the term
end. Courses without a slot are listed separately rather than silently dropped. To roll
to a new term, re-derive the slot grid and `TERM` from the published timetables.

## Import to notes (`/iith/import/`)

Photos, PDFs, and recordings become one set of notes for a lecture, then save through
the same path as the live recorder.

- Photos and PDFs go straight to Claude with the key in localStorage. Photos are
  downscaled to a 1600px long edge and re-encoded as JPEG first (a phone photo is
  ~4000px and gains the model nothing, and the request has a 32MB ceiling).
- Audio cannot go to Claude at all: it has no audio input. Whisper
  (`onnx-community/whisper-base.en`) runs locally via `@huggingface/transformers`, and
  only the transcript is sent on.
- **Model choice is deliberate**: one-shot imports use `claude-opus-5` (quality, runs
  once per lecture), while the live recorder's 90-second loop uses Haiku.
- **The ONNX runtime WASM is served from this origin**, copied out of node_modules at
  build time by `scripts/copy-ort.mjs` into the gitignored `public/ort/`. Never point
  `wasmPaths` at a CDN: any code on this origin can read the localStorage holding the
  Anthropic and GitHub tokens. All `ort-wasm-*` variants are copied because the runtime
  picks one from browser capabilities (Chrome with WebGPU fetches `asyncify`); shipping
  a subset means some browsers fail with "no available backend found".
- **Gotcha: audio import does not work under `npm run dev`.** Vite tries to transform
  the runtime's `.mjs` glue and returns 500 for `/ort/...mjs?import`. Photos and PDFs
  are fine in dev; to exercise audio locally use `npm run build && npm run preview`.
- File classification falls back to the extension, since phone recordings often arrive
  with an empty MIME type.

## Brainstorm (`/iith/brainstorm/`) and Studio (`/studio/`)

Both read Hari's own content, run Opus 5, and save their output as a page in the `ideas`
collection (`kind: application | content`), so results join the graph and compound.

- **Brainstorm** reads selected lecture notes and course outlines against the project
  writeups and returns applications, exposed gaps, and next actions.
- **Studio** has two modes: "find my angle" (reads the whole hub and recommends content
  directions, for when the direction is undecided) and "generate ideas" (concrete pieces
  plus a beat-by-beat build-out for the strongest one).
- The prompts instruct the model to reference sources as `[[wikilinks]]`, which is what
  makes saved ideas link back to their notes and projects. The in-page preview renders
  those as literal `[[...]]` because it uses marked directly; the saved file goes through
  the remark plugin and links properly.
- Saving reuses the shared GitHub helper and requires the token from the live recorder
  settings.

## Course timings

`meetings` in a course's frontmatter overrides the slot grid entirely, for when an
instructor announces different times (SE5723 runs Mon 08:00 to 10:00, where slot A says
09:00). Set `timingNote` alongside it and the timetable shows the note and flags the
course with an asterisk. The timetable derives its rows from the times actually in use,
so a two-hour 8am block renders fine.

## IITH Inbox (`/iith/inbox/`)

Client-side page connecting Hari's IITH Google account: pending Classroom work (state
based, not date-guessed) + inbox mail that is unread or Gmail-important (14 days), all
fetched live in the browser. One-click "Track on site" turns a Classroom item into a
`src/content/assignments/` file via the shared GitHub helper.

- Auth: plain OAuth implicit redirect (NO Google script tag; preserves the
  zero-third-party-scripts guardrail). Scopes: classroom.courses.readonly,
  classroom.coursework.me.readonly, gmail.readonly. CSRF state verified.
- Storage: `inbox.clientId` (localStorage, public-safe), `inbox.token` + `inbox.state`
  (sessionStorage, this tab only). NO Google data ever at rest or in the repo.
- Setup runbook: `docs/google-oauth-setup.md`. Known risk: IITH Workspace admin may
  block the app (`admin_policy_enforced`); page surfaces it plainly.
- Code: `src/lib/inbox/{auth,classroom,gmail,tracker}.ts`, shared `src/lib/github.ts`
  (also used by the live recorder's saver), page `src/pages/iith/inbox.astro`.
- Debug hook: `window.__inbox.render(mockPending, mockMail)` + `.authUrl()`.

## Notes and their four sections

Every note carries a `category`: `projects`, `workspace`, `iith`, or `content` (defined
once in `src/lib/categories.ts`). `/notes/` lists all four sections; notes live at
`/notes/<slug>/` regardless of category. Only `iith` notes carry a `course` reference,
so anything reading `note.data.course` must treat it as optional.

**Notes only exist once saved.** The recorder and import pages hold work in browser
storage until "Save to site", which needs the GitHub token. The recorder now warns about
a missing token BEFORE recording rather than after, because the silent version cost a
set of real lecture notes. An unsaved session survives in `live.session` and can be
recovered from the restore banner.

## Gotchas

**Deleting a content file leaves a stale entry in `node_modules/.astro/data-store.json`,
not `.astro/`.** Symptom: a note you deleted still builds and still appears on the site.
Clearing `.astro` and `dist` alone does nothing. Fix:
`rm -rf node_modules/.astro .astro dist && npm run build`. CI is unaffected because
`npm ci` wipes node_modules.


- Deleting a content file can leave a stale entry in Astro's content store
  (`node_modules/.astro/data-store.json`), so the deleted page keeps building locally.
  Fix: `rm -rf node_modules/.astro` and rebuild. CI always builds fresh, so production
  is never affected.

## Commands

- `npm run dev` (local, port 4321; the workspace launch.json config "life-hub" uses 4331)
- `npm test` (date logic: IST today, burn %, due-soon window)
- `npm run build` (astro check + build; this is the correctness gate)

## Architecture notes

- Astro 7 static output, content collections with zod schemas (`src/content.config.ts`).
- All date math is IST, computed at build time in `src/lib/dates.ts` (tested).
- Theme: `light-dark()` CSS tokens + `data-theme` override persisted in localStorage.
- The ledger anatomy (margin rule, ticks, fuses, gutter) is pure CSS in `global.css`;
  the only JS on the site is the theme toggle and the mobile drawer.
