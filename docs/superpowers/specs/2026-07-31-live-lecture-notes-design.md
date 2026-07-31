# Live Lecture Notes — Design Spec

**Date:** 2026-07-31
**Status:** Approved by Hari (design conversation, 2026-07-31)

## What this is

A page on the life-hub site (`/iith/live/`) that Hari opens in class. As the professor
speaks, the browser transcribes live (Chrome speech recognition, free) and Claude
periodically turns the transcript into structured lecture notes in real time. When class
ends, one click commits the notes to the repo, and they appear on that course's page
after the site rebuilds.

Fully client-side: no backend, no server, no secrets in the repo. Works on his Windows
laptop and Android phone, both running Chrome.

## Decisions settled with Hari

1. **Capture:** Chrome Web Speech API (`SpeechRecognition`), continuous mode with
   automatic restart on every unexpected stop while a session is active (Chrome kills
   continuous recognition after silence/timeouts; the wrapper restarts immediately).
2. **AI mode:** live structuring with Hari's own Anthropic API key (BYO key), pasted
   once into a settings panel, stored in `localStorage` only. Model: Haiku tier (fast,
   cheap). Without a key the page degrades gracefully to a free live transcriber.
3. **Save path:** one-click commit to the repo from the browser via the GitHub contents
   API using a fine-grained PAT scoped to ONLY this repo with contents read/write, also
   stored in `localStorage`. Download-.md and copy-to-clipboard always available as
   fallbacks; a failed save must never lose a lecture.
4. **Placement:** a page inside this Astro site, Daybreak-styled, zero third-party
   scripts (which is what makes browser-held keys acceptable).

## The recorder page (`/iith/live/`)

- Course dropdown, populated at build time from the `courses` collection (ongoing
  courses first). Optional free-text lecture topic.
- Start / Stop button; session timer; live word count; a status dot for recognition
  state (listening / restarting / stopped).
- Two panes (stack on mobile): **Transcript** (raw, streaming, interim results shown
  dimmed) and **Notes** (rendered markdown, updated by the AI loop).
- Screen Wake Lock (`navigator.wakeLock`) held during a session so the screen cannot
  sleep mid-lecture; re-acquired on visibilitychange.
- Settings panel (gear): Anthropic API key field, GitHub token field, both masked,
  saved to `localStorage`, with a "keys live only in this browser" note.
- If `SpeechRecognition` is unavailable (non-Chrome browser), the page says so plainly
  and points at Chrome.

## The AI loop

- Every ~90 seconds while recording (and once at Stop), if a key is present and new
  transcript exists: call Anthropic messages API directly from the browser (requires
  the `anthropic-dangerous-direct-browser-access: true` header; exact model id and
  header contract to be verified against the claude-api skill at implementation time).
- Request = system prompt (course name/code, topic, note-taking instructions) +
  current notes markdown + only the transcript delta since the last call. Response =
  the full updated notes markdown (bounded size, so cost stays bounded).
- Notes instructions: structured headings, definitions, formulas, worked examples,
  and a flagged "exam / action items" section when the professor signals importance.
  No em/en dashes (site-wide copy rule).
- Failures (network, rate limit, bad key) surface as a quiet inline warning and the
  loop retries next tick; transcription never stops because the AI call failed.
- At Stop: one final structuring pass over any remaining delta, plus a title
  suggestion ("EM5110 lecture, 04 Aug 2026: <topic>").

## Saving + content model

- New content collection `notes`: `src/content/notes/<course>-<yyyy-mm-dd>.md`,
  frontmatter `{ title, course (reference), date }`, body = the notes markdown. If the
  file already exists (second lecture same day), suffix `-2`.
- Save = GitHub contents API PUT with base64 body using the stored PAT; success shows
  the eventual URL; failure keeps everything in the page and offers download/copy.
- Rendering: course detail pages get a "Lecture notes" section listing that course's
  notes (date-sorted, Daybreak rows); each note gets its own page
  (`/iith/notes/<slug>/`) with the standard page-head + prose card.
- The raw transcript is NOT saved to the repo by default (it is long and low-value);
  it is downloadable from the page before leaving.

## Keys and privacy

- Both secrets live in `localStorage` on Hari's devices only, sent exclusively to
  api.anthropic.com / api.github.com over HTTPS. Never committed, never proxied.
- The page (like the whole site) ships zero third-party scripts; keeping it that way
  is a standing guardrail (documented in CLAUDE.md).
- The GitHub PAT must be fine-grained: this repo only, contents read/write only.
- Plainly documented on the page: Chrome's speech recognition sends audio to Google;
  recording a lecture needs the professor's/institute's permission (Hari's
  responsibility); saved notes are public on the site.

## Error handling summary

- Recognition stops unexpectedly -> auto-restart, status dot shows "restarting".
- Tab backgrounded / screen locked -> wake lock + visibilitychange re-acquire; if
  recognition died while hidden, restart on return.
- AI call fails -> inline warning, retry next tick, transcription unaffected.
- Save fails -> error banner with retry + download/copy; nothing is lost on navigation
  because the session state also mirrors to `localStorage` (cleared on successful save
  or explicit discard).
- Accidental navigation during an active session -> `beforeunload` confirm.

## Out of scope (YAGNI)

- Speaker diarization, audio recording/storage, offline STT (Whisper), multi-language,
  editing notes in the browser (edits happen later via Claude Code), auto-detecting
  which course from the timetable.

## Success criteria

- A 90-minute lecture produces usable structured notes with zero interaction beyond
  Start, Stop, Save.
- Total Anthropic cost per lecture is pennies (Haiku, bounded prompts).
- Keys never appear in the repo, the built site, or any request to any host other than
  Anthropic/GitHub.
- Recognition survives Chrome's silent stops and a phone screen-lock attempt.
- A failed save can never lose the notes.
