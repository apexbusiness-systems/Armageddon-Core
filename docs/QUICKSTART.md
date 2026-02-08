# Run a Live Test RIGHT NOW — Quick Start

## Current Status

✅ **Frontend**: LIVE at [www.armageddon.icu](https://www.armageddon.icu)  
✅ **Database**: Supabase configured  
✅ **API Endpoint**: `/api/run` exists  
❌ **Temporal Worker**: Not running (you need to start it)

---

## What You Need to Run a Test

### Option A: Local Worker (Fastest - 2 minutes)

```bash
# 1. Start Temporal server (if using docker-compose)
docker-compose up -d

# 2. Start the worker
cd armageddon-core
npm install
npm run start:worker

# 3. Visit the site and click RUN TEST
# Site: https://www.armageddon.icu
```

### Option B: Check What's Missing

The `/api/run` endpoint tries to connect to:

- **Temporal**: `process.env.TEMPORAL_ADDRESS || 'localhost:7233'`
- **Supabase**: Already configured ✅

**If Temporal is not running**, the API will fail when you click "RUN TEST".

---

## To Actually Run a Test

1. **Start Temporal worker** (see above)
2. Go to **www.armageddon.icu**
3. **Sign up** (if there's auth) or just click around
4. Click **"RUN TEST"** or **"INITIATE SEQUENCE"** button
5. Watch the console for real-time updates

---

## What Happens When You Click RUN TEST

```
Frontend → POST /api/run
         → Creates armageddon_runs record in Supabase
         → Triggers Temporal workflow
         → 13 batteries execute
         → Events stream back via WebSocket
         → Results displayed on page
```

---

## Current Blocker

**The Temporal worker is not running.**

Once you start it (via docker-compose or `npm run start:worker`), the full flow should work.

---

## Next: What to Test

- Does the site have a working "RUN TEST" button?
- Is there GitHub OAuth integration?
- Does clicking the button show any error messages?
- Check browser console and network tab when clicking

**Let me know what you see when you visit the site!**
