# Live Lecture Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, single-threaded per Hari's standing no-fanout rule). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `/iith/live/`: a client-side lecture recorder that transcribes live (Chrome speech recognition), grows structured notes via Claude Haiku (BYO key), and commits finished notes to the repo with one click, rendered on course pages.

**Architecture:** Everything client-side on the static site. Logic lives in `src/lib/live/*.ts` modules (recognizer, notes engine, saver, session state); the Astro page provides Daybreak-styled DOM and wires the modules in a `<script>`. New `notes` content collection renders on course detail pages and note pages. No backend; secrets in localStorage only.

**Tech Stack:** Astro 7, `@anthropic-ai/sdk` (browser mode, `claude-haiku-4-5`), `marked` + `dompurify` for live markdown rendering, GitHub contents API via fetch, Web Speech API, Screen Wake Lock API.

## Global Constraints

- All Daybreak guardrails from CLAUDE.md apply (tokens immutable, lucide icons, no em/en dashes in visible text, cards/badges/page-head components).
- Secrets (`live.anthropicKey`, `live.githubToken`) live in localStorage ONLY; never in the repo, never sent anywhere except api.anthropic.com / api.github.com.
- Model: `claude-haiku-4-5` (approved in design), `max_tokens: 4096`, no thinking config, official SDK with the browser opt-in flag.
- Speech: `lang: 'en-IN'`, continuous + interim results, auto-restart on every `onend` while the session is active.
- AI tick: every 90s when >= 200 new final-transcript chars; transcript cursor advances ONLY on API success (failures never lose text). Final pass on Stop regardless of delta size.
- Notes markdown is rendered via marked with DOMPurify sanitization (transcript text is untrusted input to the renderer).
- Session state mirrors to localStorage (`live.session`) so a crash/navigation cannot lose a lecture; cleared on successful save or explicit discard; `beforeunload` guard while recording.
- Note files: `src/content/notes/<courseId>-<yyyy-mm-dd>.md` (suffix `-2`, `-3` on collision), frontmatter `{title, course, date}`.
- The recorder page must degrade honestly: no SpeechRecognition -> plain "use Chrome" notice; no key -> transcript-only mode with a quiet hint; failed save -> error + download/copy, state retained.

## File Structure

```
src/content.config.ts              add `notes` collection (title, course ref, date)
src/lib/live/recognizer.ts         SpeechRecognition wrapper (start/stop/auto-restart, callbacks)
src/lib/live/session.ts            session state + localStorage mirror + timer/wordcount
src/lib/live/notesEngine.ts        Anthropic loop (tick, delta cursor, final pass)
src/lib/live/saver.ts              GitHub contents API save + filename collision + download/copy
src/pages/iith/live.astro          the recorder page (DOM + wiring script + scoped styles)
src/pages/iith/notes/[slug].astro  note detail page
src/pages/iith/courses/[slug].astro  add "Lecture notes" section
src/components/NavLinks.astro      add "Live notes" item (lucide:mic) under IITH
CLAUDE.md                          document the feature + notes collection
```

**Interfaces locked project-wide:**
- `recognizer.ts`: `createRecognizer(opts: {onFinal(text: string): void; onInterim(text: string): void; onState(s: 'listening'|'restarting'|'stopped'|'unsupported'|'denied'): void}) -> {start(): void; stop(): void}`.
- `session.ts`: `type LiveSession = {courseId: string; courseCode: string; courseName: string; topic: string; startedAt: number; finals: string[]; notes: string; cursor: number}` with `load/save/clear/wordCount/elapsed` helpers. `cursor` = index into the concatenated finals text already sent to the AI.
- `notesEngine.ts`: `updateNotes(args: {apiKey: string; session: LiveSession}) -> Promise<{notes: string; cursor: number}>` (throws on API failure; caller keeps old cursor).
- `saver.ts`: `saveToRepo(args: {token: string; session: LiveSession; date: Date}) -> Promise<{path: string; url: string}>`; `downloadMd(session, date): void`; `buildMarkdown(session, date): {slugBase: string; content: string; title: string}`.

### Task 1: Notes collection + rendering

- [ ] Add `notes` collection to `src/content.config.ts` (glob loader over `src/content/notes`, schema `{title: z.string(), course: reference('courses'), date: z.coerce.date()}`); create `src/content/notes/.gitkeep` so the dir exists; verify `npm run build` stays green with an empty collection.
- [ ] `src/pages/iith/notes/[slug].astro`: getStaticPaths over notes; page-head (eyebrow `{courseCode} · {fmt date}`, h1 title, subtitle course name), prose card with rendered Content, btn-secondary back to the course.
- [ ] Course detail page: "Lecture notes" section listing that course's notes date-desc as row-list (title link + fmt date), only when notes exist.
- [ ] Build green; commit `feat: notes content collection + rendering`.

### Task 2: Recorder page shell

- [ ] `src/pages/iith/live.astro`: page-head (eyebrow "Live", h1 "Live lecture notes", subtitle); controls card (course `<select>` from ongoing-first courses inlined at build, topic input, Start/Stop ink-pill button, status badge, mono timer + word count); two-column grid of cards: Transcript (scrolling, interim dimmed) and Notes (rendered markdown); actions row (Save to site .btn, Download .btn-secondary, Copy .btn-secondary, Discard); settings `<details>` card with two masked inputs (Anthropic key, GitHub token) + save button + plain-language notes on privacy/consent/publicness; unsupported-browser notice. Scoped styles reuse Daybreak tokens only.
- [ ] Add "Live notes" nav item; build green; visual check both widths; commit `feat: live recorder page shell`.

### Task 3: Recognizer + session + wiring

- [ ] `recognizer.ts` per interface: feature-detect (`SpeechRecognition || webkitSpeechRecognition`), `continuous = true`, `interimResults = true`, `lang = 'en-IN'`; `onresult` routes finals/interims; `onend` restarts within ~300ms while active (state 'restarting'); `onerror`: `not-allowed` -> 'denied', others logged + restart path.
- [ ] `session.ts` per interface; mirror writes throttled (~2s); wake lock acquire on start + reacquire on `visibilitychange`; restore banner if an unsaved session exists on page load ("resume or discard").
- [ ] Wire in live.astro script: Start (requires course) -> session create, recognizer start, timer loop; Stop -> recognizer stop, final AI pass; beforeunload guard while recording; debug hook `window.__live.injectFinal(text)` for micless testing.
- [ ] Verify in browser via debug hook (transcript grows, timer runs, restore works); commit `feat: live capture engine`.

### Task 4: AI notes loop

- [ ] `npm install @anthropic-ai/sdk marked dompurify`.
- [ ] `notesEngine.ts`: Anthropic client with the browser opt-in flag, `claude-haiku-4-5`, `max_tokens: 4096`; system prompt = note-taking instructions (structured headings, definitions, formulas, examples, "Exam / action items" section when signaled, hyphens never dashes) + course/topic; user message = current notes + transcript delta; returns updated full notes + new cursor.
- [ ] 90s tick in page script (only when recording, key present, delta >= 200 chars); on success render notes (marked -> DOMPurify -> innerHTML); on failure show quiet inline warning, keep cursor; Stop triggers final pass (any delta > 0).
- [ ] No-key state: Notes card shows "Add your Anthropic API key in settings for live AI notes; transcription runs free without it."
- [ ] Verify with debug hook + real key if available in env (else structural verify + error-path check with bad key); commit `feat: live AI notes loop`.

### Task 5: Save, download, copy

- [ ] `saver.ts`: `buildMarkdown` (YAML frontmatter with quoted/escaped title, `course: <id>`, `date: yyyy-mm-dd`; body = notes or transcript fallback); `saveToRepo`: GET contents URL to detect collision (try base, `-2`, `-3`...), then PUT `{message, content: base64}` with `Authorization: Bearer <token>`; return html_url. `downloadMd` via Blob; copy via clipboard API.
- [ ] Wire buttons: Save disabled until stopped + token present; success panel with links (repo file + eventual site URL) + clears session; failure keeps everything + shows error + points at download.
- [ ] Verify: buildMarkdown unit-check via node (frontmatter parses in the astro schema), simulated save error path in browser; commit `feat: one-click save to repo`.

### Task 6: Docs + polish + ship

- [ ] CLAUDE.md: document `/iith/live/`, the notes collection frontmatter, the two localStorage keys, GitHub token scoping (this repo, contents RW), consent/public reminders.
- [ ] Dash scan on dist; contrast unaffected (Daybreak tokens only); keyboard pass on new controls; mobile layout check.
- [ ] `npm test` + `npm run build` green; commit; push; watch Actions run to success; verify live page renders and a full simulated session (debug hook) works on the deployed site; report with proof.

## Self-Review
- Spec coverage: recorder UX (T2/T3), AI loop + degrade (T4), save + fallbacks (T5), notes model + rendering (T1), keys/privacy copy (T2/T6), error handling (T3-T5), success criteria all mapped. Covered.
- Placeholders: none; all interfaces have exact signatures.
- Consistency: cursor semantics identical in session.ts and notesEngine.ts; slug scheme matches saver + collection docs.
