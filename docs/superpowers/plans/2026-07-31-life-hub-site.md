# Hari's Life Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, single-threaded per Hari's standing no-fanout rule). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy Hari's public life-hub site (IITH coursework tracker + project ledger) at https://hari487-coder.github.io/ with the "Eye-Ease Ledger" design system.

**Architecture:** Fully static Astro 5 site. All content is markdown in typed content collections (courses, assignments, projects); pages render at build time. One tiny inline script for theme, one for the mobile drawer; everything else is CSS. GitHub Actions builds on push + daily cron (so date math stays fresh) and deploys to GitHub Pages.

**Tech Stack:** Astro 5, Tailwind CSS v4 (`@tailwindcss/vite`), Fontsource (Archivo Variable, IBM Plex Sans, IBM Plex Mono), astro-icon + `@iconify-json/ph` (Phosphor), Vitest (date logic only), GitHub Pages via `withastro/action`.

## Global Constraints

- Repo: `Hari487-coder/hari487-coder.github.io`, public, deploys to root `https://hari487-coder.github.io/`.
- Everything committed is public: never commit grades, personal documents, client names (Anthony/Castiglia), or internal Assistable data. Project writeups describe tech + outcomes generically ("a US insurance client", "an AI startup's support org").
- Design system is FIXED (see Design Tokens below): the palette, fonts, and signature elements are immutable tokens. No new colors, no second accent, no serif anywhere.
- ZERO em-dash (`—`) or en-dash (`–`) characters in any user-visible string. Hyphens only.
- Copy voice: terse field-log register. Sentence-case plain-noun headings ("Due soon", "Currently taking", "Recently shipped"). Exactly ONE uppercase element per page: the mono log stamp. No marketing adjectives, no "passionate", no "seamless".
- Icons: Phosphor only (via astro-icon), never emoji, never hand-drawn SVG paths (single exception: the favicon mark defined in Task 8).
- Every motion sits behind `@media (prefers-reduced-motion: no-preference)`; reduced-motion users get static fully-drawn states.
- Both themes always: `light-dark()` tokens with `color-scheme`; manual toggle overrides system via `data-theme` + localStorage.
- All dates are IST (Asia/Kolkata, UTC+5:30). "Today" is computed in IST at build time.
- Due-soon window: due within next 7 IST days, plus anything overdue and not done. Fuse fallback window: 14 days before due when no `start` date.
- Base font 15px body / IBM Plex Sans; mono is fenced to data (dates, codes, statuses, nav labels, gutter metadata) and never used for prose.
- Node 22+ locally (Hari has v25), `npm` as package manager.

---

## Design Tokens (Eye-Ease Ledger, immutable)

Declared once in `src/styles/global.css` with `light-dark()`:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#F3F6EE` | `#141813` | page background |
| `--sheet` | `#FBFCF8` | `#1C211B` | raised surfaces: rows, cards, code blocks |
| `--board` | `#E9EEE2` | `#10140E` | sidebar / drawer background |
| `--ink` | `#222923` | `#E7EBE2` | primary text + icons |
| `--ink-2` | `#5C665E` | `#9AA396` | secondary text, metadata, done entries |
| `--line` | `#D9E0D3` | `#2A312A` | hairlines, borders, graph-paper grid |
| `--accent-fill` | `#BC4708` | `#FF8A4E` | margin rule, ticks, fuses, active-nav tick (3:1 duty) |
| `--accent-text` | `#BC4708` | `#FF8A4E` | links, due dates (4.5:1+ duty; same hex, separate token enforces discipline) |
| `--wash` | `color-mix(in srgb, var(--accent-fill) 8%, var(--sheet))` | 10% mix | hover/selected row tint (derived, not a token to invent) |

Fonts: **Archivo** (variable; 600 for page titles; Expanded width ONLY for the sidebar wordmark), **IBM Plex Sans** (400/500, 15px base, 1.6 prose leading, 1.45 in ledger rows), **IBM Plex Mono** (400/500, data only).

**Signature (build exactly this):** a continuous 2px `--accent-fill` vertical margin rule down every content column at `7rem` from the column's left edge. Metadata (mono) lives left of the rule in the gutter; titles/prose live right; only page `h1` crosses it. On Home, due-soon rows hang off the rule with a 12px horizontal perpendicular tick (`::before`), and each carries a 2px "burn fuse" track under the title filled to `var(--burn)` (percent of assignment window elapsed, computed at build). Overdue: date flips to `--accent-text` over a full fuse. Active sidebar nav item uses the same tick primitive.

**Motion:** on page load the rule draws in (scaleY 0 to 1, transform-origin top, 300ms ease-out); rows fade + rise 6px with 40ms nth-child stagger capped at 8; fuses grow 0 to `var(--burn)` over 500ms ease-out. Astro/browser view transitions hold the sidebar still (`view-transition-name: sidebar`). Hovers: row tints to `--wash`, nav tick extends 4px, gutter dates ink from `--ink-2` to `--ink`.

---

## File Structure

```
package.json, astro.config.mjs, tsconfig.json, .gitignore
.github/workflows/deploy.yml        build+deploy on push / daily cron / manual
public/favicon.svg                  ledger mark (paper square + orange rule)
src/styles/global.css               tokens, grid paper, ledger anatomy, motion
src/content.config.ts               courses / assignments / projects schemas
src/content/courses/*.md            one per course (em5090, em5110, em5270 seed)
src/content/assignments/*.md        one per assignment (3 sample seeds)
src/content/projects/*.md           one per project (7 real seeds)
src/lib/dates.ts                    IST today, burn %, due-soon, formatting (PURE, tested)
src/lib/dates.test.ts               vitest
src/layouts/Base.astro              head/meta/fonts/theme script, sidebar+main grid
src/components/Sidebar.astro        cover board, title block, nav, drawer button
src/components/ThemeToggle.astro    3-state toggle (auto/light/dark)
src/components/LedgerRow.astro      assignment row: gutter meta, tick, fuse
src/components/ProjectEntry.astro   dated project ledger entry
src/pages/index.astro               Home dashboard (today's page)
src/pages/iith/index.astro          courses grouped by semester
src/pages/iith/courses/[slug].astro course detail + its assignments
src/pages/iith/assignments.astro    all assignments grouped by status
src/pages/projects/index.astro      project ledger
src/pages/projects/[slug].astro     project writeup
src/pages/about.astro               bio + contact
src/pages/404.astro                 logbook-voice 404
CLAUDE.md                           content conventions for future sessions
README.md                           what this repo is, how to run
```

**Interfaces locked project-wide:**
- `src/lib/dates.ts` exports: `todayIST(now?: Date): Date` (UTC midnight of current IST calendar day), `burnPercent(due: Date, start: Date | undefined, today: Date): number` (0-100 int, fallback start = due minus 14d, clamped), `isOverdue(due: Date, today: Date): boolean`, `isDueSoon(due: Date, today: Date, windowDays?: number): boolean` (default 7; true also when overdue), `daysLeft(due: Date, today: Date): number`, `fmt(d: Date): string` (`"04 Aug 2026"`), `stamp(d: Date): string` (`"31 JUL 2026"`).
- Content collection entry shapes are exactly the zod schemas in Task 3.
- `LedgerRow.astro` props: `{ title: string, href?: string, meta: string[], due?: Date, burn?: number, state: 'todo' | 'doing' | 'done' | 'overdue' }`.
- `ProjectEntry.astro` props: `{ project: CollectionEntry<'projects'> }`.

---

### Task 1: Scaffold + toolchain + deploy pipeline

**Files:** Create `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/pages/index.astro` (placeholder), `src/styles/global.css` (empty import target), `.github/workflows/deploy.yml`.

- [ ] **Step 1: package.json**

```json
{
  "name": "hari-life-hub",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: install deps (exact command)**

```bash
npm install astro @astrojs/check typescript tailwindcss @tailwindcss/vite astro-icon @iconify-json/ph @fontsource-variable/archivo @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono && npm install -D vitest
```

- [ ] **Step 3: astro.config.mjs**

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://hari487-coder.github.io',
  integrations: [icon()],
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 4: tsconfig.json** (`astro/tsconfigs/strict` extends), `.gitignore` (node_modules, dist, .astro), placeholder `index.astro` rendering `<h1>ledger</h1>`, empty `global.css` with `@import "tailwindcss";`.

- [ ] **Step 5: deploy.yml**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  schedule:
    - cron: '30 21 * * *'   # 03:00 IST daily, keeps fuses honest
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: verify** `npm run build` exits 0. **Step 7: commit** `feat: scaffold Astro + Tailwind v4 + Pages deploy pipeline`.

### Task 2: Date logic (TDD)

**Files:** Create `src/lib/dates.ts`, `src/lib/dates.test.ts`.

- [ ] **Step 1: failing tests first** covering: `todayIST` rolls the date at 18:30 UTC (00:00 IST); `burnPercent` = 50 at midpoint of explicit start-due window; fallback window is 14d; clamps 0/100; `isDueSoon` true at exactly 7 days out, false at 8, true when overdue; `daysLeft` negative when overdue; `fmt`/`stamp` exact strings (`fmt(2026-08-04) === "04 Aug 2026"`, `stamp === "04 AUG 2026"`).
- [ ] **Step 2:** `npx vitest run` fails (module missing). **Step 3:** implement `dates.ts` (pure UTC math + 330min offset; no Date.now() default args evaluated at import). **Step 4:** tests green. **Step 5: commit** `feat: IST date + burn-fuse logic (tested)`.

### Task 3: Content collections + seed content

**Files:** Create `src/content.config.ts`, seed markdown.

- [ ] **Step 1: schemas**

```ts
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
```

- [ ] **Step 2: seed courses** (real Sem 1 core, Jul-Nov 2026): `em5090.md` (EM5090, Accounting and Finance for Entrepreneurs, 3cr, slot Q, Dr. Ranapratap Maradana), `em5110.md` (EM5110, Foundations of Techno-Entrepreneurship, 3cr, slot G, Dr. Jayshree Patnaik), `em5270.md` (EM5270, Entrepreneurial Marketing, 3cr, slot R, Dr. Rajesh Ittamalla). All `semester: 1`, `status: ongoing`. Body: one-line note ("Core. All three compulsory.").
- [ ] **Step 3: seed assignments** - 3 SAMPLE entries (plausible titles like "EM5110 reading response 1", due dates spread over next 2 weeks, one `status: doing`), each body starting with `<!-- sample entry: replace with real assignment -->`.
- [ ] **Step 4: seed projects** - 7 real entries, public-safe writeups, newest first by `date`: `assistable-media-bridge.md` (live, featured, repo + live links, MCP/voice-media tooling), `mortgage-platform.md` (live, featured, no links: "records-to-direct-mail platform for a US insurance client"), `attribution-bridge.md` (live, no links: call-attribution + compliance-safe lead copier), `client-intelligence-portal.md` (internal, featured: support analytics warehouse for an AI startup), `pdf-compressor.md` (live, featured, repo + live links), `iith-course-planner.md` (building: single-file registration planner), `support-copilot.md` (parked: BM25 agent-assist chat). Stack arrays honest (TypeScript, Astro, DuckDB, Express, Docker...).
- [ ] **Step 5: verify** `npm run build` green (schemas validate); deliberately break one date, confirm build FAILS, restore. **Step 6: commit** `feat: content collections + real seed content`.

### Task 4: Design system CSS + Base layout + Sidebar

**Files:** Create `src/styles/global.css` (full), `src/layouts/Base.astro`, `src/components/Sidebar.astro`, `src/components/ThemeToggle.astro`.

- [ ] **Step 1: global.css** - tokens exactly as the Design Tokens table via `light-dark()` under `:root { color-scheme: light dark; }` with `[data-theme]` overrides; font-face via Fontsource imports in Base; body = `--paper` + Plex Sans 15px; graph-paper background on the content area only (two `linear-gradient`s in `--line` at 5-8% opacity, `32px` cell); `.sheet` ledger anatomy (relative container, `::before` rule at `left: 7rem`, `width: 2px`, `background: var(--accent-fill)`, rule-draw animation); `.ledger-row` grid `7rem 1fr` (gutter mono right-aligned `--ink-2`, entry padded `1.25rem`); `.tick` (12px x 2px `::before` on the rule at row center); `.fuse` (2px track in `--line`, fill `--accent-fill` scaled to `var(--burn)`, grow animation); stagger (`.rise` nth-child delays x8); `--wash` hover; `:focus-visible` 2px `--accent-fill` outline offset 2; `@media (prefers-reduced-motion: reduce)` kills all animation and shows final states; mobile `< 768px`: gutter collapses to a meta line above content, rule moves to `left: 0.75rem`, rows `grid-template-columns: 1fr`.
- [ ] **Step 2: Base.astro** - props `{ title, description }`; imports the three Fontsource packages + global.css; `<head>`: charset, viewport, title (`{title} · Hari Prathap`), description, canonical, OG basics, favicon; blocking inline theme script (reads localStorage `theme`, sets `data-theme` if `light`/`dark`); `@view-transition { navigation: auto; }` style + `view-transition-name: sidebar` on the aside; body grid `[sidebar 15rem][main 1fr]`, `<a class="skip-link">` first; `<slot />` inside `<main class="sheet">`.
- [ ] **Step 3: Sidebar.astro** - `--board` background; title block: `HARI PRATHAP` (Archivo 600, expanded, the wordmark), `IITH / Assistable AI` in `--ink-2`, mono build-date stamp; nav (Phosphor icons + mono labels): Home `ph:notebook`, Courses `ph:graduation-cap`, Assignments `ph:list-checks`, Projects `ph:wrench`, About `ph:user`; active item = orange tick from left edge (`aria-current="page"` styled, computed from `Astro.url.pathname`); ThemeToggle at bottom. Mobile: sidebar hidden, top bar with wordmark + menu button (`aria-expanded`), 15-line inline script toggles `data-drawer` on `<html>`; drawer overlays with `--board`, Escape + backdrop click close.
- [ ] **Step 4: ThemeToggle.astro** - three-state button cycle auto -> light -> dark (Phosphor `ph:circle-half`, `ph:sun`, `ph:moon`), persists to localStorage, `aria-label` announces state.
- [ ] **Step 5: verify in browser** (preview_start): rule draws once per navigation, sidebar holds still, both themes pass contrast spot-checks (gutter text `--ink-2` on `--paper` must be >= 4.5:1 in both modes), drawer works at 375px, focus visible, reduced-motion (emulate) shows static page. **Step 6: commit** `feat: Eye-Ease Ledger design system + workspace shell`.

### Task 5: Home dashboard

**Files:** Create `src/pages/index.astro`, `src/components/LedgerRow.astro`.

- [ ] **Step 1: LedgerRow.astro** per locked props; gutter renders `meta` lines in mono; `due` renders via `fmt()`, in `--accent-text` when state is overdue (fuse full) or due <= 2 days; `state: done` -> whole row `--ink-2`, no fuse; `burn` emitted as `style="--burn: N%"`.
- [ ] **Step 2: index.astro** - queries: assignments where status != done and `isDueSoon(due, today)` sorted by due (ticks on these rows); courses `status: ongoing`; projects sorted by date desc, top 4. Compose: log stamp line (mono, THE one uppercase element: `{stamp(today)} · SEM 1 · {n} DUE`), then `h2` "Due soon" (rows with tick + fuse; empty state: `nothing due this week. logged.`), `h2` "Currently taking" (compact 2-col course list: code+slot gutter, name, credits), `h2` "Recently shipped" (4 ProjectEntry rows - build ProjectEntry.astro here per locked props: gutter = `fmt(date)` + status stamp in mono, entry = title link + summary + stack line).
- [ ] **Step 3: verify** in browser: fuses show believable burn for the sample due dates, overdue sample flips accent, stagger caps at 8. **Step 4: commit** `feat: Home dashboard (today's page)`.

### Task 6: IITH pages

**Files:** Create `src/pages/iith/index.astro`, `src/pages/iith/courses/[slug].astro`, `src/pages/iith/assignments.astro`.

- [ ] **Step 1: iith/index.astro** - courses grouped by `semester` (h2 "Semester 1" etc.), each a LedgerRow: gutter = code + slot mono, title links to course page, meta shows credits + instructor; footer line: total credits per semester (mono).
- [ ] **Step 2: courses/[slug].astro** - `getStaticPaths` over courses; h1 crosses the rule; gutter facts: code, slot, credits, instructor, status; body = rendered markdown notes at 72ch; then "Assignments" section: this course's assignments as LedgerRows with fuses.
- [ ] **Step 3: assignments.astro** - all assignments in three groups h2 "In progress" (doing), "To do" (todo, due-sorted, fuses), "Done" (done, `--ink-2`, newest first); each row's gutter = course code + due date.
- [ ] **Step 4: verify** build + browser check both themes. **Step 5: commit** `feat: IITH courses + assignments pages`.

### Task 7: Projects pages

**Files:** Create `src/pages/projects/index.astro`, `src/pages/projects/[slug].astro`.

- [ ] **Step 1: index.astro** - all projects date-desc as ProjectEntry ledger entries (NOT marketing cards): featured ones get the `--wash` tint + slightly larger title; status stamps in gutter mono (`live`, `building`, `parked`, `internal`).
- [ ] **Step 2: [slug].astro** - h1 on the rule; gutter facts: date, status, stack (one line each, mono), repo/live as `--accent-text` links when present; writeup at 72ch. Writeups: 150-300 words each, field-log voice, concrete (what it does, what it runs on, what shipped), zero client names.
- [ ] **Step 3: verify** all 7 build; links resolve (media bridge repo/landing, pdf-compressor live). **Step 4: commit** `feat: project ledger + writeups`.

### Task 8: About, 404, favicon, SEO meta

**Files:** Create `src/pages/about.astro`, `src/pages/404.astro`, `public/favicon.svg`; modify `src/layouts/Base.astro` (OG polish).

- [ ] **Step 1: about.astro** - short first-person field-log bio (M.Tech Techno-Entrepreneurship at IIT Hyderabad; customer success engineering at an AI voice startup; ships with Claude Code), gutter facts (location, GitHub link `github.com/Hari487-coder`), one line on what this site is ("this is the ledger I actually keep"). No email yet (Hari adds later if wanted).
- [ ] **Step 2: 404.astro** - logbook voice: `page not found. not logged.` + link home.
- [ ] **Step 3: favicon.svg** - allowed simple geometric mark: `--paper` rounded square, one vertical `--accent-fill` rule at 30%, two `--line` horizontal rules. Works in both OS themes (test dark tab bar).
- [ ] **Step 4:** Base.astro og:title/description/url + `theme-color` both schemes. **Step 5: verify + commit** `feat: about, 404, favicon, meta`.

### Task 9: Pre-flight polish pass (taste-skill checklist)

**Files:** Modify any.

- [ ] **Step 1: mechanical sweeps** - grep built `dist/` for `—` and `–` (must be zero hits in visible text); count uppercase micro-labels (only the log stamp per page); confirm one accent everywhere; corner-radius audit (one scale); no `h-screen` (use `100dvh` if anywhere).
- [ ] **Step 2: contrast verification** - compute ratios for every token pair in use (script or manual): `--ink`/`--paper`, `--ink-2`/`--paper`, `--ink-2`/`--board`, `--accent-text`/`--paper`, `--accent-text`/`--sheet`, both modes; fix any < 4.5:1 (adjust the failing token's L only, stay in family).
- [ ] **Step 3: responsive sweep** - 375 / 768 / 1024 / 1440 in browser; no horizontal scroll; drawer + ledger collapse correct at 375.
- [ ] **Step 4: keyboard + reduced motion + screen-reader labels** (nav landmarks, aria-current, toggle labels). **Step 5: commit** `polish: pre-flight pass`.

### Task 10: CLAUDE.md + README

**Files:** Create `CLAUDE.md`, `README.md`.

- [ ] **Step 1: CLAUDE.md** documenting: what this repo is; content conventions (all three schemas with copy-paste frontmatter templates); playbooks for "add assignment X due Friday" / "mark X done" / "add project Y" / "new semester" (file -> commit -> push -> live ~1min); design guardrails (tokens immutable, no em-dashes, copy voice, one uppercase stamp per page, mono fenced to data); sample-assignment note (replace with real ones); deploy facts (push + 03:00 IST cron + manual dispatch); custom-domain steps for later (CNAME file + DNS A/AAAA + repo setting).
- [ ] **Step 2: README.md** - short: what, run (`npm install && npm run dev`), deploy (push to main). **Step 3: commit** `docs: content conventions + readme`.

### Task 11: Ship it

- [ ] **Step 1:** `gh repo create Hari487-coder/hari487-coder.github.io --public --source . --push` (repo MUST be public for free Pages).
- [ ] **Step 2:** Enable Pages with GitHub Actions source: `gh api -X POST repos/Hari487-coder/hari487-coder.github.io/pages -f build_type=workflow` (or PUT if exists).
- [ ] **Step 3:** watch first run: `gh run watch` until green; zero fail AND zero pending.
- [ ] **Step 4: live verification** - open `https://hari487-coder.github.io/` in browser: dashboard renders, fuses show, both themes, mobile width; screenshot as proof.
- [ ] **Step 5:** confirm the cron trigger exists in the deployed workflow (Actions tab shows scheduled workflow). **Step 6: commit** any fixups; report live URL + proof to Hari.

---

## Self-Review (done at write time)

- **Spec coverage:** sidebar workspace (T4), Home dashboard + due-soon window (T5), courses/assignments (T6), projects (T7), about (T8), Claude-Code-manageable content (T3+T10), auto-deploy + schema-validation gate (T1+T3), dark mode + a11y (T4+T9), custom-domain-later (T10 doc), public-only content (Global Constraints). Covered.
- **Placeholder scan:** no TBDs; sample assignments are explicitly flagged sample data by design (Hari's real assignments are unknowable here) and carry an in-file replace marker.
- **Type consistency:** `LedgerRow`/`ProjectEntry` props and `dates.ts` signatures declared once in Interfaces and referenced by tasks; collection names (`courses`, `assignments`, `projects`) consistent throughout.
