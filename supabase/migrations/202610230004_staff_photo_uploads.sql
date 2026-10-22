insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photo-staging', 'staff-photo-staging', false, 5242880, null)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = null;

-- Keep manifests independent of account deletion until every 2-hour Storage token expires.
create table public.staff_photo_upload_sessions (
  id uuid primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  flow text not null check (flow in ('registration', 'profile')),
  account_id uuid,
  state text not null default 'issued' check (state in ('issued', 'claimed', 'completed', 'failed')),
  staging_paths text[] not null check (cardinality(staging_paths) between 1 and 19),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  token_expires_at timestamptz not null default (now() + interval '2 hours 5 minutes'),
  cleanup_error text,
  constraint staff_photo_upload_account_flow_check check (
    (flow = 'registration' and account_id is null) or (flow = 'profile' and account_id is not null)
  ),
  constraint staff_photo_upload_path_count_check check (array_length(staging_paths, 1) = cardinality(staging_paths))
);

create index staff_photo_upload_cleanup_idx on public.staff_photo_upload_sessions (token_expires_at);
create index staff_photo_upload_rate_idx on public.staff_photo_upload_sessions (flow, account_id, created_at);
alter table public.staff_photo_upload_sessions enable row level security;
revoke all on table public.staff_photo_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_photo_upload_sessions to service_role;

create or replace function public.create_staff_photo_upload_session(
  target_id uuid,
  target_token_hash text,
  target_flow text,
  target_account_id uuid,
  target_staging_paths text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(target_staging_paths) not between 1 and 19 then
    raise exception 'invalid photo count' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(target_staging_paths) as paths(path) where path not like target_id::text || '/%')
    or cardinality(target_staging_paths) <> (select count(distinct path) from unnest(target_staging_paths) as paths(path)) then
    raise exception 'invalid staging paths' using errcode = '22023';
  end if;
  if target_flow = 'registration' then
    perform pg_advisory_xact_lock(hashtextextended('staff-photo-registration-quota', 0));
    if (select count(*) from public.staff_photo_upload_sessions where flow = 'registration' and created_at > now() - interval '2 hours') >= 25 then
      raise exception 'registration photo upload quota reached' using errcode = '54000';
    end if;
  elsif target_flow = 'profile' and target_account_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(target_account_id::text, 0));
    if (select count(*) from public.staff_photo_upload_sessions where flow = 'profile' and account_id = target_account_id and created_at > now() - interval '2 hours') >= 5 then
      raise exception 'profile photo upload quota reached' using errcode = '54000';
    end if;
  else
    raise exception 'invalid upload flow' using errcode = '22023';
  end if;
  insert into public.staff_photo_upload_sessions (id, token_hash, flow, account_id, staging_paths)
  values (target_id, target_token_hash, target_flow, target_account_id, target_staging_paths);
end;
$$;

create or replace function public.claim_staff_photo_upload_session(
  target_token_hash text,
  target_flow text,
  target_account_id uuid
)
returns table (id uuid, staging_paths text[], expires_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  update public.staff_photo_upload_sessions as session
  set state = 'claimed'
  where session.token_hash = target_token_hash
    and session.flow = target_flow
    and session.account_id is not distinct from target_account_id
    and session.state = 'issued'
    and session.expires_at > now()
  returning session.id, session.staging_paths, session.expires_at;
$$;

revoke all on function public.create_staff_photo_upload_session(uuid, text, text, uuid, text[]) from public, anon, authenticated;
revoke all on function public.claim_staff_photo_upload_session(text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_staff_photo_upload_session(uuid, text, text, uuid, text[]) to service_role;
grant execute on function public.claim_staff_photo_upload_session(text, text, uuid) to service_role;
