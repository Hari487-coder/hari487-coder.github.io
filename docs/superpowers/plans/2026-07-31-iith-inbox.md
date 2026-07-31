# IITH Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, single-threaded). Checkbox steps.

**Goal:** Ship `/iith/inbox/`: live Classroom pending work + attention-needing IITH mail via scriptless client-side Google OAuth, with one-click tracking of Classroom items into the site's assignment tracker.

**Architecture:** All client-side. `src/lib/inbox/{auth,classroom,gmail,tracker}.ts` modules + one Astro page; shared GitHub helper extracted to `src/lib/github.ts` (recorder's saver refactored onto it). Token in memory/sessionStorage; client ID in localStorage via settings field. Zero third-party scripts (plain OAuth redirect).

**Tech Stack:** Astro 7, fetch against classroom.googleapis.com / gmail.googleapis.com / api.github.com, OAuth 2.0 implicit redirect flow.

## Global Constraints

- Daybreak guardrails; no em/en dashes; lucide icons; zero third-party scripts (verify in dist).
- Google data at rest: ONLY `inbox.token` (+expiry) in sessionStorage and `inbox.clientId` in localStorage. Nothing in the repo, ever.
- Scopes exactly: `classroom.courses.readonly classroom.coursework.me.readonly gmail.readonly`.
- CSRF: random `state` in sessionStorage, verified on redirect return before accepting a token.
- Per-section failure isolation: one API failing renders an inline alert in that section only.
- Pending = submission state in {NEW, CREATED, RECLAIMED_BY_STUDENT}; mail query `in:inbox newer_than:14d (is:unread OR is:important)`, max 25.

## File Structure + Interfaces

```
src/lib/github.ts        gh(token, path, init?) + putNewFile({token, dir, slugBase, content, message}) -> {path, url}
                         (collision suffix -2..-9 inside putNewFile; saver.ts refactored to use it)
src/lib/inbox/auth.ts    beginAuth(clientId): void (redirects); handleRedirect(): {token}|{error}|null;
                         getToken(): string|null; clearToken(): void
src/lib/inbox/classroom.ts fetchPending(token) -> Promise<PendingItem[]>
                         PendingItem = {id, courseName, title, due: Date|null, points: number|null, link}
src/lib/inbox/gmail.ts   fetchAttention(token) -> Promise<MailItem[]>
                         MailItem = {id, from, subject, date: Date, snippet, unread, important, link}
src/lib/inbox/tracker.ts trackAssignment({ghToken, item: PendingItem, courseId}) -> Promise<{path}>
src/pages/iith/inbox.astro  page + wiring (site courses + normalized existing assignment titles inlined at build)
src/components/NavLinks.astro  add Inbox (lucide:inbox)
CLAUDE.md                document feature; docs/google-oauth-setup.md runbook
```

### Task 1: Shared GitHub helper + tracker + auth libs

- [ ] Extract `src/lib/github.ts` from saver.ts (gh headers incl. api-version; toBase64; putNewFile with 404-probe collision loop); refactor `saver.ts` to consume it; build stays green.
- [ ] `auth.ts`: beginAuth builds `accounts.google.com/o/oauth2/v2/auth` URL (response_type=token, redirect_uri=origin+/iith/inbox/, scopes, include_granted_scopes, state=crypto random stored `inbox.state`); handleRedirect parses `location.hash` (access_token/expires_in/state or error), verifies state, persists `inbox.token` {token, exp} to sessionStorage, strips hash via replaceState; getToken checks expiry.
- [ ] `classroom.ts`: courses?courseStates=ACTIVE -> parallel per course: courseWork + `courseWork/-/studentSubmissions?userId=me`; join by courseWorkId; filter pending states; map dueDate+dueTime (IST) -> Date|null; sort due-asc, undated last. 401 -> throw AuthError; 403 -> throw ApiDisabledError (distinct message).
- [ ] `gmail.ts`: messages.list with encoded q + maxResults=25 -> parallel `format=metadata&metadataHeaders=From,Subject,Date`; map labelIds UNREAD/IMPORTANT; parse From display name; link to mail.google.com/#inbox/{id}. Same error taxonomy.
- [ ] `tracker.ts`: frontmatter {title JSON-quoted, course, due iso (Classroom due else +7d), status: todo, link}; putNewFile into src/content/assignments; slug `<courseId>-<slug(title)>`.
- [ ] Commit `feat: inbox libs (auth, classroom, gmail, tracker, shared github)`.

### Task 2: Inbox page + wiring

- [ ] `inbox.astro`: page-head; signed-out card (explainer, client-ID presence check, Connect Google .btn, setup hint pointing at docs runbook); two section cards (Classroom pending / Mail) with skeleton rows while loading, empty states, inline error alerts with Reconnect button on auth errors; refresh btn-secondary; per-item: Classroom row (title link, course+due+points sub, due-hot styling, course select + Track button, "tracked" state) and Mail row (bold-if-unread subject link, from + relative time sub, Important badge, snippet meta).
- [ ] Settings `<details>`: client ID field (localStorage `inbox.clientId`), note that Google token lives only in this tab, GitHub token reused from Live notes settings.
- [ ] Wiring script: on load handleRedirect -> token? fetch both in parallel -> render; site courses + normalized tracked-title set inlined via build; track flow (guess course by code/name substring match, disabled w/o gh token, in-place "tracked" flip); debug hook `window.__inbox.render(mockPending, mockMail)` + `authUrl()` for verification.
- [ ] NavLinks: Inbox item. Build green. Commit `feat: iith inbox page`.

### Task 3: Verify + docs + ship

- [ ] Browser: signed-out render both widths; settings persist; `authUrl()` correct (endpoint, scopes, state stored); simulate `#error=access_denied` and `#error=admin_policy_enforced` -> plain messages; fake token in sessionStorage -> real APIs 401 -> reconnect state per section; mock render via debug hook -> rows, due-hot, track buttons (disabled w/o token), mail badges; dist grep: zero third-party script tags, zero dashes.
- [ ] `docs/google-oauth-setup.md`: click-by-click runbook (project, enable Classroom+Gmail APIs, consent screen external + test user = IITH email, web client ID, origins site+localhost:4331, paste into page settings); CLAUDE.md section (feature, storage keys, scopes, admin-block caveat).
- [ ] `npm test` + build; commit; push; watch Actions green; verify live page + signed-out state + mock render on deployed site; report + hand Hari the runbook.

## Self-Review
- Spec coverage: auth flow (T1/T2), both fetchers + states (T1/T2), track (T1/T2), setup runbook + risks (T3), page states (T2), success criteria mapped. Covered.
- Placeholders: none. Types/signatures fixed above.
- Consistency: storage keys match spec (`inbox.token` sessionStorage, `inbox.clientId` localStorage, `inbox.state` sessionStorage); scopes match; pending states match.
