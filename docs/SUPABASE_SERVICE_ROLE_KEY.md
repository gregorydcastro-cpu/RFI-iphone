# Fix SUPABASE_SERVICE_ROLE_KEY (issue #53)

Production shows `storageKeyValid: false` when Vercel has the **wrong** Supabase key (usually the anon / publishable key).

## Steps

1. Open **Supabase** → project **gc-field-log** → **Settings** → **API Keys**.
2. Copy the **secret** key (`sb_secret_…`) **or** the legacy **service_role** key (long `eyJ…` JWT).  
   Do **not** copy anon or `sb_publishable_…`.
3. Open **Vercel** → project **gc-field-log** → **Settings** → **Environment Variables** → **Production**.
4. Set `SUPABASE_SERVICE_ROLE_KEY` to that value (paste carefully; no extra spaces).
5. Confirm `SUPABASE_URL` is `https://aejevzkqvlwbmjbqdxuu.supabase.co`.
6. **Redeploy** Production (Deployments → … → Redeploy).
7. Confirm:
   - Open `https://www.gcfieldlog.com/api/procore/status` — expect `storageKeyValid: true` and `storageKeyProblem: null`.
   - Or locally: `npm run check:supabase-keys` (reads your shell env; exits 0 on success).

Never put this key in `NEXT_PUBLIC_…`, git, chat, or the browser.
