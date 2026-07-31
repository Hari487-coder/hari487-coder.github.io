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
