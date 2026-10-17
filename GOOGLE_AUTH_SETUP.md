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

Supabase will now route `signInWithOAuth({ provider: "google" })` through Google.

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

## Step 5: Enable email-domain restriction (university email only)

If the admin wants to restrict sign-in to university emails only (任意 student with `@stu.nctu.edu.eg` or `@nctu.edu.eg`):

Migration `007_auth_google.sql` already adds these defaults to `app_settings`:

| key | value | meaning |
|-----|-------|---------|
| `auth_restrict_domain` | `false` | set `true` to enable restriction |
| `auth_email_domains` | `["stu.nctu.edu.eg","nctu.edu.eg"]` | allowed domains |

To enable from SQL:
```sql
update app_settings set value = 'true' where key = 'auth_restrict_domain' and scope_type = 'global';
```

To change allowed domains:
```sql
update app_settings
set value = '["stu.nctu.edu.eg","nctu.edu.eg","edu.eg"]'
where key = 'auth_email_domains' and scope_type = 'global';
```

The login page reads these settings and rejects (signs out) any Google/password user whose email domain isn't in the list, showing: **"هذا البريد غير مسموح به. استخدم البريد الجامعي."**

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
- [ ] First-time Google user → redirected to onboarding → profile role = `student` (never upgraded)
- [ ] Same email already registered with password → linked (no duplicate account)
- [ ] University email domain restriction toggleable by admin
- [ ] Works on Android (Chrome) and iPhone (Safari)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `redirect_uri_mismatch` from Google | Add the exact Supabase callback URL to Google Cloud authorized redirect URIs (no trailing slash) |
| User signs in with Google but no profile | Login page auto-creates a `profiles` row with role `student` and status `pending` on first login |
| "This email is not allowed" | Admin hasn't enabled your domain in `auth_email_domains`; ask admin to add it |
| Google button does nothing on iPhone | Ensure site is served over HTTPS (required by Apple for OAuth popups/redirects) |
