# IITH Inbox (Google Classroom + Gmail) — Design Spec

**Date:** 2026-07-31
**Status:** Approved by Hari (design conversation, 2026-07-31)

## What this is

`/iith/inbox/`: a client-side "what needs my attention" page connecting Hari's IITH
Google account. Two live sections: **Classroom pending work** (assignments not yet
turned in across active courses) and **mail needing attention** (unread or
Gmail-important inbox mail, last 14 days). Data renders in the browser per visit and is
stored nowhere; the public repo never contains coursework or mail content.

## Decisions settled with Hari

1. New page `/iith/inbox/` (nav item under IITH), not merged into Assignments or Home.
2. Mail filter: `in:inbox` AND (unread OR important), `newer_than:14d`, newest first.
3. **One-click track**: each pending Classroom item can be written into the site's
   assignment tracker (`src/content/assignments/`) via the GitHub contents API using the
   already-stored `live.githubToken`. Course pre-guessed by name match, adjustable via a
   select; due date carried from Classroom.
4. Auth: plain OAuth 2.0 implicit redirect flow against accounts.google.com (NO Google
   script tag - preserves the site's zero-third-party-scripts guardrail). Access token
   lives in page memory only (plus sessionStorage for the same tab), never localStorage,
   never the repo. Read-only scopes.

## Auth flow

- "Connect Google" -> full-page redirect to `accounts.google.com/o/oauth2/v2/auth` with
  `response_type=token`, `client_id` (public, origin-locked), `redirect_uri` =
  `<origin>/iith/inbox/`, `scope`, `include_granted_scopes=true`, `prompt=select_account`
  on first connect.
- On return: parse `#access_token` from the fragment, strip the fragment via
  `history.replaceState`, keep the token in memory + sessionStorage (`inbox.token`,
  with expiry timestamp). Errors (`#error=...`, esp. `admin_policy_enforced` /
  `access_denied`) render plain-language messages, including the "IITH admin may need to
  allow this app" case.
- Token expiry (~1h): API 401 -> clear token, show Connect button again. A "reconnect"
  click uses `prompt=none`-less default (Google session usually makes it one click).
- Scopes: `classroom.courses.readonly`, `classroom.coursework.me.readonly`,
  `gmail.readonly` (the metadata scope forbids `q=` queries, so readonly is required).
- Client ID + allowed origins configured by Hari in a Google Cloud project (setup
  runbook is part of the deliverable). The client ID is NOT hard-coded: the page has a
  one-time settings field storing it as `inbox.clientId` in localStorage (public-safe
  value, origin-locked by Google; per-browser config avoids a rebuild after setup).
  The site origin and `http://localhost:4331` are authorized origins.

## Data fetching (all direct from browser with Bearer token)

Classroom:
- `GET courses?courseStates=ACTIVE`
- Per course: `GET courses/{id}/courseWork` and
  `GET courses/{id}/courseWork/-/studentSubmissions?userId=me`
- Pending = submission state in {NEW, CREATED, RECLAIMED_BY_STUDENT} (not TURNED_IN /
  RETURNED); overdue = dueDate past in IST. Sort by due date (undated last). Each item:
  title, course name, due, points, `alternateLink` out to Classroom.

Gmail:
- `GET users/me/messages?q=in:inbox newer_than:14d (is:unread OR is:important)&maxResults=25`
- Per id: `GET users/me/messages/{id}?format=metadata&metadataHeaders=From,Subject,Date`
  + snippet. Render sender (display name), subject, relative date, snippet; link
  `https://mail.google.com/mail/u/0/#inbox/{id}`. Unread bolded; important badged.

Concurrency: fetch Classroom and Gmail in parallel; per-course calls in parallel;
individual failures degrade per-section with an inline error, never blank the page.

## One-click track

- Button per pending Classroom item + course `<select>` (site courses, best guess
  preselected by matching course code/name inside the Classroom course name).
- Creates `src/content/assignments/<courseId>-<slugified-title>.md` with frontmatter
  `{title, course, due (from Classroom, else +7d), status: todo, link: alternateLink}`
  via GitHub contents API (reuses `live.githubToken`; PUT with 404-check like the
  recorder's saver; on name collision suffix `-2`).
- Already-tracked detection: page fetches the assignments list at build time (inlined)
  and marks items whose normalized title already exists; freshly tracked items flip to
  "tracked" in-place.
- No token -> button disabled with "add a GitHub token in Live notes settings".

## Page states

- Signed out: explainer card + Connect Google button + setup hint.
- Loading: skeleton rows per section.
- Error states: per-section inline alerts (auth expired, admin blocked, API disabled,
  network); auth errors offer reconnect.
- Empty states: "Nothing pending in Classroom." / "No mail needs attention."

## Out of scope (YAGNI)

- Classroom announcements/materials, mail actions (read/archive/reply), full auto-sync,
  storing any Google data, Home-page summary of inbox counts, push notifications.

## Success criteria

- One click (after first consent) shows both sections in under ~3s on hostel wifi.
- Pending list matches Classroom exactly (state-based, not date-guessed).
- Track button creates a valid assignment file that builds and appears on the site.
- Zero third-party scripts still (verified in built HTML); no Google data at rest
  anywhere except sessionStorage token in Hari's own tab.
- Admin-blocked case produces a clear actionable message, not a blank page.
