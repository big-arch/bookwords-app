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

BookWords now uses a personal sync code instead of email login. The same code
on every device points to the same cloud snapshot.

```sql
create table if not exists bookwords_sync (
  sync_key text primary key,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'
);

alter table bookwords_sync enable row level security;

create policy "BookWords can read by sync key"
on bookwords_sync for select
using (true);

create policy "BookWords can insert by sync key"
on bookwords_sync for insert
with check (true);

create policy "BookWords can update by sync key"
on bookwords_sync for update
using (true)
with check (true);
```

Each sync code stores one `data` JSON snapshot. Use a long random code generated
inside BookWords and keep it private.

## App Settings

In the BookWords sidebar:

- click `Создать код` on the first device;
- use the same generated code on every other device;
- click `Подключить`.

In Supabase, also open:

`Authentication` -> `URL Configuration`

Set:

- Site URL: `https://big-arch.github.io/bookwords-app/`
- Redirect URLs: `https://big-arch.github.io/bookwords-app/`

On iPhone, install BookWords from Safari with Share -> Add to Home Screen.

Use the same Supabase settings and the same email on every computer and phone.

Do not use `service_role` or `secret` keys in BookWords.

## Implementation Notes

- `cloudStorageAdapter.push()` writes the snapshot to Supabase.
- `cloudStorageAdapter.pull()` reads the current user's snapshot.
- On app start: the app pulls cloud data and keeps the newest `updatedAt`.
- On every local change: the app saves locally first, queues sync, then pushes to cloud.

This keeps the app usable offline and syncs when the network returns.
