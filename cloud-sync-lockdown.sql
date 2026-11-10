-- Old clients must refresh; dictionaries and existing codes are preserved.
alter table public.bookwords_sync enable row level security;
revoke all on public.bookwords_sync from public,anon,authenticated;
