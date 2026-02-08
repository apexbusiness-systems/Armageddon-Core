# GitHub OAuth Setup Guide

## Fix LOGIN Button on armageddon.icu

### Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Armageddon Test Suite`
   - **Homepage URL**: `https://www.armageddon.icu`
   - **Authorization callback URL**: `https://qhjqselqpkfqjfpuxykb.supabase.co/auth/v1/callback`
4. Click **"Register application"**
5. **Copy the Client ID** (you'll need this)
6. Click **"Generate a new client secret"**
7. **Copy the Client Secret** immediately (you can't see it again)

---

### Step 2: Configure Supabase GitHub Provider

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **GitHub** in the provider list
3. Click to expand GitHub settings
4. Enable the toggle
5. Paste:
   - **Client ID** from GitHub
   - **Client Secret** from GitHub
6. Click **Save**

---

### Step 3: Update Site URLs (Already Done ✅)

You already have:

- ✅ Site URL: `http://localhost:3000` (for local dev)

**Add Production URL**:

- In **Auth URL Configuration**, add: `https://www.armageddon.icu`

---

### Step 4: Test

**Local Testing**:

```bash
cd armageddon-site
npm run dev
# Visit localhost:3000, click LOGIN
```

**Production Testing**:

- Visit https://www.armageddon.icu
- Click **LOGIN**
- Should redirect to GitHub OAuth consent screen
- After approval, redirects back to site logged in

---

## Troubleshooting

**Button still doesn't work?**

- Check browser console (F12) for errors
- Verify callback URL exactly matches: `https://qhjqselqpkfqjfpuxykb.supabase.co/auth/v1/callback`
- Ensure GitHub OAuth app is not suspended

**Redirect loops?**

- Make sure Site URL is set correctly in Supabase
- Check that redirect URL in `AuthControl.tsx` matches site URL
