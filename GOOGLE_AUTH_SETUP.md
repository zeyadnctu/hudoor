# Google Sign-in Setup — Hudoor

Connect Supabase Auth → Google Cloud OAuth → Hudoor login.

## Prerequisites
- Supabase project (you already have one: `ativvtlvmkhnayhtokql`)
- Google Cloud Console account
- Vercel CLI / Supabase CLI **not installed locally** — do the steps below in the web dashboards instead

---

## Step 1: Create Google Cloud OAuth Client

1. Go to **Google Cloud Console** → [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Hudoor Web`
3. Under **Authorized JavaScript origins** add:
   - `http://localhost:3000` (local dev)
   - `https://<your-vercel-domain>.vercel.app` (production)
4. Under **Authorized redirect URIs** add **(exact, one per line)**:
   - `https://ativvtlvmkhnayhtokql.supabase.co/auth/v1/callback`
5. Click **Create** → copy:
   - **Client ID** → `...apps.googleusercontent.com`
   - **Client Secret** → `GOCSPX-...`

> ⚠️ The redirect URI must point to **Supabase** (`.../auth/v1/callback`), not to your app. Supabase handles the Google OAuth handshake and then redirects the user back to your app.

---

## Step 2: Enable Google in Supabase Auth

1. Go to **Supabase Dashboard** → `ativvtlvmkhnayhtokql` → **Authentication → Providers**
2. Find **Google** → toggle **Enable**
3. Paste:
   - **Client ID**: from Step 1
   - **Client Secret**: from Step 1
4. Click **Save**

### Step 2b: Allow the app callback in Supabase (required!)

**Authentication → URL Configuration** → **Redirect URLs** → add **one per line**:

```
http://localhost:3000/auth/callback
https://<your-vercel-domain>.vercel.app/auth/callback
```

If this is missing, Google returns you to Supabase and Supabase then refuses the
handshake with `redirect_url_mismatch` / a blank page. Supabase compares these
entries **exactly** (scheme + host + path, no trailing slash).

Supabase will now route `signInWithOAuth({ provider: "google" })` through Google.

> The app exchanges the returned `?code=` on `/auth/callback`, checks the
> university-domain rule, creates the `profiles` row (role `student`,
> status `pending`) and then routes by role. See `lib/auth-flow.ts`.

---

## Step 3: Add redirect URL to your app (Vercel / production)

In **Google Cloud Console**, add your production app URL as an authorized origin:
- `https://<your-vercel-domain>.vercel.app`

Also set this env var in Vercel (project → Settings → Environment Variables):
```
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>.vercel.app
```

The login page already uses `location.origin` for the redirect, so on localhost it will use `http://localhost:3000/login?next=...` and on Vercel it will use your production domain.

---

## Step 4: Local dev env

Copy and edit `.env.local`:

```bash
cp .env.example .env.local
```

Add (no need to change Supabase URL/key — those are already there):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (from Step 1)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

> `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is exposed to the browser; `GOOGLE_CLIENT_SECRET` is server-only. Supabase uses the secret server-side, so you mainly need the Client ID in the frontend env for reference.

---

## Step 5: Email-domain restriction (university email only)

Admins control all of this **from the console — no SQL needed**:

- **Admin → Settings → Auth & login**
  - `auth_restrict_domain` — Restrict to university email (applies to password **and** Google)
  - `auth_email_domains` — Allowed domains, comma separated
- **Admin → Settings → Feature flags** → `google_signin` — turn Google sign-in on/off

Migration `009_program_settings_auth.sql` seeds the defaults and turns
`google_signin` on:

| key | value | meaning |
|-----|-------|---------|
| `auth_restrict_domain` | `false` | set `true` to enable restriction |
| `auth_email_domains` | `["stu.nctu.edu.eg","nctu.edu.eg"]` | allowed domains |

The app reads these through the public `GET /api/auth/config` route (the
`app_settings` table itself is admin-only under RLS, so a signed-out browser
cannot read it directly). Any Google or password user whose email domain isn't
in the list is signed out immediately with: **"هذا البريد غير مسموح به. استخدم البريد الجامعي."**

---

## Step 6: Test

### Local
```bash
npm install
npm run dev
```
Open `http://localhost:3000/login` → click **"المتابعة بحساب جوجل"** → should redirect to Google chooser → back to `/student` (or `/onboarding` for first-time users).

### Production (Vercel)
1. `git add -A && git commit -m "feat: google sign-in"`
2. `git push origin main`
3. Vercel auto-deploys
4. Open your Vercel URL → `/login` → test Google sign-in on **Android + iPhone**

### Acceptance criteria (Task 1)
- [ ] Google OAuth client created in Google Cloud Console
- [ ] Google provider enabled in Supabase Auth with correct callback URL
- [ ] Supabase **Redirect URLs** contain `/auth/callback` for localhost + production (Step 2b)
- [ ] Migration `009_program_settings_auth.sql` applied (`google_signin` enabled, program scope allowed)
- [ ] First-time Google user → redirected to onboarding → profile role = `student` (never upgraded)
- [ ] Same email already registered with password → linked (no duplicate account)
- [ ] University email domain restriction toggleable by admin (Settings → Auth & login)
- [ ] Works on Android (Chrome) and iPhone (Safari)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `redirect_uri_mismatch` from Google | Add the exact **Supabase** callback URL (`https://<proj>.supabase.co/auth/v1/callback`) to Google Cloud authorized redirect URIs (no trailing slash) |
| `redirect_url_mismatch` / blank page from Supabase | Add `http://localhost:3000/auth/callback` and `https://<domain>/auth/callback` to **Supabase → Authentication → URL Configuration → Redirect URLs** (Step 2b) |
| `access_denied` / "This app is in testing mode" | Finish Google's OAuth **consent screen** verification, or add each tester under "Audience" |
| User signs in with Google but no profile | `/auth/callback` auto-creates a `profiles` row with role `student` and status `pending`; middleware then sends them to `/onboarding` |
| "This email is not allowed" | Admin hasn't enabled your domain in **Settings → Auth & login → Allowed email domains** |
| Google button says it's disabled | Admin turned off the `google_signin` flag in **Settings → Feature flags** |
| Google button does nothing on iPhone | Ensure site is served over HTTPS (required by Apple for OAuth popups/redirects), and never open the link inside WhatsApp/Facebook (in-app browser) |
| Professor lands back on the login page right after signing in | Fixed: post-login routing is role-aware (`lib/auth-flow.ts`) — professors go to `/professor`, admins to `/admin`, students to `/student` |
