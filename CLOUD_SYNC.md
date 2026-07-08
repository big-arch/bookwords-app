# BookWords Cloud Sync Plan

The app already stores all user data as one snapshot:

- `state`: books and words;
- `dailyGoal`: daily lesson progress;
- `streak`: stars and study streak;
- `imageCache`: generated image URLs.

The current app keeps this snapshot locally and queues every change through `queueCloudSync()`.
When cloud sync is enabled, `cloudStorageAdapter.push()` can send the same snapshot to a backend.

## Recommended Backend

Supabase is the simplest next step because it gives:

- email/social login;
- PostgreSQL database;
- row-level security;
- free tier for early testing;
- easy future iOS/Android support.

## Minimal Table

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'
);
```

Each user stores one `data` JSON snapshot. Later this can be split into `books`, `words`, and `progress` tables.

## Next Implementation Steps

1. Add login screen.
2. Store the Supabase project URL and anon key in the app.
3. Replace `cloudStorageAdapter.push()` and `pull()` with Supabase reads/writes.
4. On app start: pull cloud data, compare `updatedAt`, keep the newest snapshot.
5. On every local change: save locally first, then push to cloud.

This keeps the app usable offline and syncs when the network returns.
