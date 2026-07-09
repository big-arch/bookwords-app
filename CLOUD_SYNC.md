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
- Supabase public key: either the old `anon public key` or the new `Publishable key`;
- email for login.

In Supabase, also open:

`Authentication` -> `URL Configuration`

Set:

- Site URL: `https://big-arch.github.io/bookwords-app/`
- Redirect URLs: `https://big-arch.github.io/bookwords-app/`

Then click:

1. `Получить код`
2. Enter the one-time code from the email inside BookWords.
3. Click `Подключить`.
4. Use `Синхронизировать` only for a manual refresh.

On iPhone, install BookWords from Safari with Share -> Add to Home Screen.
Mail apps can open Supabase links in their own browser, which has a separate
session from Safari/Home Screen apps. Use the one-time code flow inside the
installed BookWords app to avoid browser switching.

In Supabase, set the Auth email template to show the token, for example:

`Your BookWords code: {{ .Token }}`

Use the same Supabase settings and the same email on every computer and phone.

Do not use `service_role` or `secret` keys in BookWords.

## Implementation Notes

- `cloudStorageAdapter.push()` writes the snapshot to Supabase.
- `cloudStorageAdapter.pull()` reads the current user's snapshot.
- On app start: the app pulls cloud data and keeps the newest `updatedAt`.
- On every local change: the app saves locally first, queues sync, then pushes to cloud.

This keeps the app usable offline and syncs when the network returns.
