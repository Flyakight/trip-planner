# Deploying to `trips.thereandback.club`

One-time setup that puts this repo behind a subdomain on your existing
`thereandback.club` (Bluehost-hosted marketing site stays untouched).

**Architecture:**
- Marketing site `thereandback.club` → Bluehost (unchanged)
- Itinerary app `trips.thereandback.club` → Cloudflare Pages
- Clients get links like `trips.thereandback.club/?id=<slug>`

---

## 1 · Push to a private GitHub repo

```bash
cd "/Users/katekight/Desktop/Travel App"

# If you haven't set up a global git identity yet:
# git config --global user.name  "Kate Kight"
# git config --global user.email "kate@thereandback.club"

# Create the repo on GitHub first (private):
# https://github.com/new   →   name: "thereandback-itinerary"  →  Private

git remote add origin git@github.com:<your-gh-username>/thereandback-itinerary.git
git push -u origin main
```

If you don't have SSH set up, use the HTTPS URL GitHub shows you
(`https://github.com/<you>/thereandback-itinerary.git`) — it'll prompt
for a password / personal access token on first push.

---

## 2 · Connect Cloudflare Pages to the repo

1. Log in to Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare's GitHub app on the private repo.
3. Select `thereandback-itinerary`.
4. Project name: **`thereandback-itinerary`** (this becomes a temporary
   `thereandback-itinerary.pages.dev` URL until the custom domain is attached).
5. Build settings: **leave everything blank**. This is a static site:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: *(empty — defaults to repo root)*
6. **Save and Deploy.** First build takes ~30 seconds.

After it deploys, visit the `*.pages.dev` URL to confirm. Test three paths:
- `/` → landing screen
- `/?id=kim-steph-italy-2026-k7n4` → Kim & Steph's itinerary
- `/?admin=1` → import panel

---

## 3 · Point `trips.thereandback.club` at Cloudflare Pages

### 3a. In Cloudflare Pages
1. Open your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `trips.thereandback.club`. Click **Continue**.
3. Cloudflare will show you a **CNAME target** — something like
   `thereandback-itinerary.pages.dev`. Copy that value.
4. Cloudflare will say *"Waiting for DNS"* — that's expected; we'll add
   the record in Bluehost next.

### 3b. In Bluehost DNS
1. Bluehost control panel → **Domains** → select `thereandback.club` → **DNS**.
2. Add a new record:
   - **Type:** CNAME
   - **Host / Name:** `trips`
   - **Points to / Value:** `thereandback-itinerary.pages.dev` (the target Cloudflare gave you)
   - **TTL:** default (or 1 hour)
3. Save.

DNS usually propagates in 5–15 minutes. Cloudflare will auto-issue a
TLS cert once it sees the CNAME. The Pages custom-domain status flips
from *"Verifying"* → *"Active"* when it's live.

---

## 4 · Send a client their link

Once `trips.thereandback.club` is active:

```
https://trips.thereandback.club/?id=kim-steph-italy-2026-k7n4
```

---

## 5 · Onboard the next client

1. Create `trips/<new-slug>-<entropy>.csv` (see README for schema).
2. Commit + push:
   ```bash
   git add trips/<new-slug>-<entropy>.csv
   git commit -m "Add <client name> <year> itinerary"
   git push
   ```
3. Cloudflare auto-rebuilds in ~30s.
4. Send: `https://trips.thereandback.club/?id=<new-slug>-<entropy>`.

---

## 6 · One-time: bind the `LOCKS` KV namespace (cross-device sync)

The app stores each client's day-assignment picks ("locks") on
Cloudflare KV so they sync across phones. Without this binding, the
app silently falls back to per-browser localStorage — still works, but
each device sees its own picks.

1. Cloudflare dashboard → **Storage & Databases → KV** → **Create a
   namespace**. Name it `thereandback-locks`. Save.
2. Cloudflare dashboard → **Workers & Pages** → your `thereandback-itinerary`
   project → **Settings** → **Functions** → **KV namespace bindings**
   → **Add binding**:
   - **Variable name:** `LOCKS` (must be exactly this — the Function reads `env.LOCKS`)
   - **KV namespace:** select `thereandback-locks`
3. Save. Cloudflare redeploys the Functions in ~10s.

That's it. Test by:
1. Open `trips.thereandback.club/?id=<slug>` on phone A → tap an idea → "Add to Day 3".
2. Open the same URL on phone B → the Day 3 lock should already be there.

**Free tier:** 100k reads + 1k writes per day, 1 GB storage. You'd hit
the write limit at ~50–100 active clients tapping all day. Plenty of
headroom.

**Security:** the trip slug is the password, same as the CSV. The
endpoint validates `^[a-z0-9-]{4,80}$` and rejects payloads >50 KB to
guard against abuse. There's no auth beyond the URL — same threat
model as the CSV that lives in `/trips/`.

---

## Tips

- **Unguessable URLs.** The entropy suffix (e.g. `-k7n4`) is the only
  privacy layer. Don't post the full URL anywhere public.
- **Private repo.** The CSVs sit in git, so keep the repo private.
- **Edit a trip.** Push a CSV change; Cloudflare redeploys in seconds.
  The browser re-fetches with `cache: 'no-cache'`, so clients see updates
  on reload.
- **Admin on a live trip.** Append `&admin=1` to a client URL for yourself
  to see the import panel overlay (doesn't affect the client's view —
  they don't have that URL).
- **Rollback.** `git revert <commit>` and push. Cloudflare redeploys.
- **Locks ≠ CSVs.** Editing `trips/<slug>.csv` does NOT clear a client's
  locks. Locks are keyed by `_ideaId = slugify(City + '-' + Title)`, so
  as long as you don't rename an existing idea, their day-assignments
  survive every redeploy. (Renaming an idea silently orphans the lock.)
- **Inspect locks for a trip.** Cloudflare dashboard → KV → `thereandback-locks`
  → search by trip slug. You can read or delete entries directly there.

## 7 · Optional: bind the `ITINERARIES` KV namespace (admin publish)

The admin form/editor can publish edited CSV content directly so the
client URL sees changes without replacing `trips/<slug>.csv` in git.
The static CSV remains the fallback if no published override exists.

1. Cloudflare dashboard → **Storage & Databases → KV** → **Create a
   namespace**. Name it `thereandback-itineraries`. Save.
2. Cloudflare dashboard → **Workers & Pages** → your Pages project →
   **Settings** → **Bindings** → **Add binding**:
   - **Variable name:** `ITINERARIES`
   - **KV namespace:** select `thereandback-itineraries`
3. Save and redeploy.

Test with:

```
https://itinerary.thereandback.club/api/trips/<slug>
```

Before anything has been published from admin, that endpoint returns a
404 JSON message and the app falls back to `trips/<slug>.csv`. After an
admin save publishes, it returns the CSV from KV.
