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

## Supabase Setup

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'
);

alter table profiles enable row level security;

create policy "Users can read own profile"
on profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);
```

Each user stores one `data` JSON snapshot. Later this can be split into `books`, `words`, and `progress` tables.

## App Settings

In the BookWords sidebar, paste:

- Supabase project URL;
- Supabase anon key;
- email for login.

In Supabase, also open:

`Authentication` -> `URL Configuration`

Set:

- Site URL: `https://big-arch.github.io/bookwords-app/`
- Redirect URLs: `https://big-arch.github.io/bookwords-app/`

Then click:

1. `Сохранить`
2. `Войти`
3. Open the email login link on the same device.
4. Click `Синхронизировать`.

Use the same Supabase settings and the same email on every computer and phone.

## Implementation Notes

- `cloudStorageAdapter.push()` writes the snapshot to Supabase.
- `cloudStorageAdapter.pull()` reads the current user's snapshot.
- On app start: the app pulls cloud data and keeps the newest `updatedAt`.
- On every local change: the app saves locally first, queues sync, then pushes to cloud.

This keeps the app usable offline and syncs when the network returns.
