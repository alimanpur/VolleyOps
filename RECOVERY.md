# VolleyOps — Production Data Recovery

## What Happened

The `backend/src/seed/seedRunner.js` script performs a destructive `deleteMany({})` on all tournament collections before recreating data. If this script was executed against the production database (e.g. during a deployment or manual run), it **wipes all existing data** including:

- Teams
- Players
- Matches (including completed league matches)
- Rally events / scoring history
- Courts, users, awards, notifications, audit entries

The current production database reflects a **freshly seeded state**:
- 5 teams with auto-generated names
- 35 players with auto-generated names
- 5 league matches, all in `SCHEDULED` state
- 0 rally events
- No semifinals or finals

## Current Production State

```
Teams:      5 (ONE HIT WONDERS, LOCAL SPRINTERS, NET DESTROYERS, HIGH IMPACT, BLOCK PARTY)
Players:    35 (auto-generated names like "Vihaan Sprinters1")
Matches:    5 (all LEAGUE, all SCHEDULED)
Rallies:    0
Semifinals: 0
Finals:     0
```

## Recovery Options

### Option A: Restore from Database Backup (PREFERRED)

If your MongoDB provider (Render / Atlas) has a backup from **before** the seed was run:

1. **Take a pre-recovery snapshot** of the current database state.
2. Restore the backup to a temporary database first.
3. Verify the original data (teams, players, matches, rally events).
4. Once verified, restore the backup to the production database.

**For Render MongoDB:**
- Go to the Render dashboard
- Select your MongoDB instance
- Look for "Backups" or "Restore"
- Restore the most recent backup from before the incident

**For MongoDB Atlas:**
- Go to Atlas Dashboard → Clusters → Backup
- Use "Restore from" to restore to a new cluster or in-place

### Option B: Restore Team Names Only

If you do NOT have a database backup, the original match results **cannot be recovered**. You can only restore the team and player names.

Run the provided script:

```bash
cd backend
node scripts/restore-teams.mjs
```

This script will:
- Update team names to the original values from git history
- Regenerate players based on the restored team shortNames
- NOT modify any matches or rally events

**Limitation:** Original match results, scores, and rally events are permanently lost without a backup.

## After Recovery — Fix Semifinals

Once the original tournament state is restored (either from backup or via team name restoration), run:

```bash
cd backend
node scripts/fix-semifinals.mjs
```

This script will:
- Calculate final league standings from actual match results
- Update existing semifinal matches to:
  - **SF1 = #1 vs #2**
  - **SF2 = #3 vs #4**
- Create semifinals if they don't exist
- Preserve all match IDs and metadata

## Vercel Deep-Link Routing

The root `vercel.json` now includes:

```json
{
  "rootDirectory": "frontend",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Important:** For API calls to work, you MUST set the `VITE_API_BASE` environment variable in your Vercel deployment to point to your Render backend URL (e.g. `https://your-service.onrender.com/api/v1`).

Without this, the Vercel SPA rewrite will intercept `/api/v1/*` requests and return HTML instead of JSON.

## Verification Checklist

After recovery and semifinal fix:

- [ ] Team names restored to original values
- [ ] Player names restored to original values
- [ ] League matches show correct completion count
- [ ] Semifinals show #1 vs #2 and #3 vs #4
- [ ] Public Vercel page displays correct data
- [ ] Scorer page displays correct data
- [ ] Admin page displays correct data

## Files Changed

| File | Purpose |
|------|---------|
| `backend/scripts/recover-from-backup.mjs` | Restore from MongoDB dump |
| `backend/scripts/restore-teams.mjs` | Restore team/player names from git history |
| `backend/scripts/fix-semifinals.mjs` | Fix semifinal pairings |
| `vercel.json` | Vercel SPA routing with `rootDirectory` |
| `frontend/vercel.json` | REMOVED (was conflicting) |

## Database Records Changed

| Collection | Change |
|-----------|--------|
| `teams` | Name/shortName updated (if running `restore-teams.mjs`) |
| `players` | Deleted and regenerated for updated teams |
| `matches` | Semifinal participants updated (if running `fix-semifinals.mjs`) |
| All other collections | NOT touched |

## DO NOT

- Run `npm run seed` against production
- Run any script that calls `deleteMany({})` on production collections
- Reset the database
- Create new teams or players manually without preserving original IDs
