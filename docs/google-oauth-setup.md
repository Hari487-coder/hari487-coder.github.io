# Google OAuth setup for the Inbox page (one time, ~10 minutes)

The Inbox page (`/iith/inbox/`) needs a Google OAuth client ID. You create it once in a
free Google Cloud project; the ID is not a secret (it only works from this site's
origins). You can use ANY Google account for the Cloud project (your personal Gmail is
fine); you sign in on the page itself with your IITH account.

## Steps

1. Go to https://console.cloud.google.com/ and sign in (personal account is fine).
2. Top bar > project picker > **New project**. Name: `life-hub-inbox`. Create, then
   make sure it is the selected project.
3. **Enable the two APIs** (menu > APIs and Services > Library):
   - Search "Google Classroom API" > Enable.
   - Search "Gmail API" > Enable.
4. **Consent screen** (APIs and Services > OAuth consent screen):
   - User type: **External** > Create.
   - App name: `Life Hub Inbox`; support email: your email; developer email: your
     email. Save through the steps (no logo, no extra scopes needed here).
   - Under **Test users**: add your IITH email address. Save.
   - Leave the app in **Testing** status (do NOT publish). Testing mode allows up to
     100 named test users and never needs Google verification.
5. **Create the client ID** (APIs and Services > Credentials > Create credentials >
   **OAuth client ID**):
   - Application type: **Web application**. Name: `life-hub-site`.
   - Authorized JavaScript origins: add BOTH
     - `https://hari487-coder.github.io`
     - `http://localhost:4331`
   - Authorized redirect URIs: add BOTH
     - `https://hari487-coder.github.io/iith/inbox/`
     - `http://localhost:4331/iith/inbox/`
   - Create. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). Ignore the
     client secret; the page never uses it.
6. Open https://hari487-coder.github.io/iith/inbox/ > **Setup** > paste the client ID >
   Save > **Connect Google** > choose your IITH account > allow the three read-only
   permissions.

## If sign-in fails

- **"admin_policy_enforced" / app blocked**: IITH's Workspace admin restricts
  third-party apps for institute accounts. Ask IITH IT to allow the app (give them the
  client ID). Nothing else fixes this.
- **"Error 400: redirect_uri_mismatch"**: the exact redirect URI this page sends is
  not listed on the OAuth client. Google shows this on its own page and never comes
  back to the site, so open **Setup** on `/iith/inbox/`: it prints the exact string,
  with a Copy button. Paste that verbatim (trailing slash included) into **Authorized
  redirect URIs**, and the origin above it into **Authorized JavaScript origins**.
  Note the port matters when testing locally: a preview on `:4340` needs its own entry.
- **"invalid_client"**: the pasted client ID is wrong or the origin is missing from
  step 5.
- **"access_denied"**: you declined consent, or your IITH email is not in Test users
  (step 4).

## What the page can and cannot do

Scopes are read-only: list Classroom courses and your own coursework/submission states,
and read Gmail. It cannot send mail, modify anything in Classroom or Gmail, or see
other students' work. The access token lives only in the browser tab and expires after
an hour.
