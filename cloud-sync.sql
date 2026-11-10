-- BookWords capability API. Existing codes and snapshots remain valid.
-- Run this setup, then cloud-sync-lockdown.sql after publishing the client.
create schema if not exists bookwords_private;
revoke all on schema bookwords_private from public, anon, authenticated;
grant usage on schema bookwords_private to anon, authenticated;
alter table public.bookwords_sync add column if not exists revision bigint not null default 0;
create or replace function bookwords_private.bump_revision() returns trigger
language plpgsql set search_path = '' as $$
begin new.revision := old.revision + 1; return new; end $$;
create or replace trigger bookwords_revision before update on public.bookwords_sync
for each row execute function bookwords_private.bump_revision();

create or replace function bookwords_private.sync(p_code text, p_revision bigint, p_data jsonb, p_create boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.bookwords_sync%rowtype;
begin
  if p_code is null or length(p_code) > 100 or p_code !~ '^[a-z0-9_-]+$' then
    raise exception 'Invalid code' using errcode='22023';
  end if;
  if p_data is not null and (jsonb_typeof(p_data->'state'->'collections') is distinct from 'array'
      or octet_length(p_data::text)>10000000) then
    raise exception 'Invalid dictionary' using errcode='22023';
  end if;
  if p_create then
    if p_code !~ '^bw-[a-f0-9]{40}$' or p_data is null or p_revision is not null then
      raise exception 'Invalid new profile' using errcode='22023';
    end if;
    perform pg_advisory_xact_lock(176924,1);
    if not exists(select 1 from public.bookwords_sync where sync_key=p_code) then
      if (select count(*) from public.bookwords_sync where updated_at>now()-interval '1 day')>=500 then
        raise exception 'Creation temporarily limited' using errcode='54000';
      end if;
      insert into public.bookwords_sync(sync_key,data) values(p_code,p_data);
    end if;
  end if;
  select * into saved from public.bookwords_sync where sync_key=p_code for update;
  if not found then raise exception 'Code not found' using errcode='P0002'; end if;
  if p_data is not null and not p_create then
    if p_revision is null or p_revision<>saved.revision then
      return jsonb_build_object('data',saved.data,'revision',saved.revision,'accepted',false);
    end if;
    update public.bookwords_sync set data=p_data,updated_at=now() where sync_key=p_code returning * into saved;
  end if;
  return jsonb_build_object('data',saved.data,'revision',saved.revision,'accepted',true);
end $$;
revoke all on function bookwords_private.sync(text,bigint,jsonb,boolean) from public,anon,authenticated;
grant execute on function bookwords_private.sync(text,bigint,jsonb,boolean) to anon,authenticated;
create or replace function public.bookwords_device_sync(p_code text,p_revision bigint default null,p_data jsonb default null,p_create boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
 select bookwords_private.sync(p_code,p_revision,p_data,coalesce(p_create,false))
$$;
revoke all on function public.bookwords_device_sync(text,bigint,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.bookwords_device_sync(text,bigint,jsonb,boolean) to anon,authenticated;
