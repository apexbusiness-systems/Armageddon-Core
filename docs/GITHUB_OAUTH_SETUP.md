# GitHub OAuth Setup Guide

**Docs version**: 2026.05.15<br>
**Last reviewed**: 2026-05-15<br>
**Scope**: Supabase GitHub provider setup for local and production site login

Use this runbook when the LOGIN control on `armageddon-site` does not complete GitHub OAuth. Do not commit GitHub OAuth client secrets or Supabase service-role keys.

## Step 1: Create a GitHub OAuth app

1. Open <https://github.com/settings/developers>.
2. Select **New OAuth App**.
3. Configure the app:
   - **Application name**: `Armageddon Test Suite`
   - **Homepage URL**: `https://www.armageddon.icu`
   - **Authorization callback URL**: Supabase Auth callback URL for the active project.
4. Register the application.
5. Copy the Client ID into the secure operator vault.
6. Generate one client secret and store it in the secure operator vault immediately.

## Step 2: Configure the Supabase GitHub provider

1. In the Supabase dashboard, open **Authentication** → **Providers**.
2. Expand **GitHub**.
3. Enable the provider.
4. Paste the GitHub Client ID and Client Secret from the secure operator vault.
5. Save the provider configuration.

## Step 3: Configure site URLs

Add every approved callback origin in Supabase Auth URL configuration:

- Local development: `http://localhost:3000`
- Production site: `https://www.armageddon.icu`

Verify the deployed site origin before adding it. Do not add wildcard redirect URLs.

## Step 4: Test locally

Run from the repository root:

```bash
npm run dev -w armageddon-site
```

Then open `http://localhost:3000`, select LOGIN, complete GitHub consent, and confirm the authenticated identity renders in the site UI.

## Step 5: Test production

1. Open the verified production URL.
2. Select LOGIN.
3. Confirm GitHub consent appears.
4. Complete consent.
5. Confirm the browser returns to the production site with an authenticated session.

## Troubleshooting

| Symptom | Verification | Fix |
| --- | --- | --- |
| Login button does not redirect | Browser console shows Supabase or auth initialization error | Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| GitHub reports callback mismatch | GitHub OAuth app callback differs from Supabase Auth callback URL | Update the GitHub OAuth app callback URL to the exact Supabase Auth callback URL. |
| Redirect loop after consent | Supabase Site URL or redirect allow-list is incomplete | Add the exact local or production origin; remove wildcard entries. |
| Production succeeds but local fails | Local origin is missing from Supabase Auth URL config | Add `http://localhost:3000` for local development. |
