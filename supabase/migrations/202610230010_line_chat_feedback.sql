create table public.line_webhook_events (
  event_id text primary key,
  line_subject text,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed', 'uncertain')),
  error_kind text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.line_webhook_events enable row level security;
revoke all on table public.line_webhook_events from public, anon, authenticated;
grant select, insert, update on public.line_webhook_events to service_role;

create table public.line_webhook_locks (
  line_subject text primary key,
  event_id text not null,
  lease_until timestamptz not null
);
alter table public.line_webhook_locks enable row level security;
revoke all on table public.line_webhook_locks from public, anon, authenticated;
grant select, insert, update, delete on public.line_webhook_locks to service_role;

create table public.line_conversations (
  line_subject text primary key,
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.line_conversations enable row level security;
revoke all on table public.line_conversations from public, anon, authenticated;
grant select, insert, update on public.line_conversations to service_role;

create table public.line_chat_usage (
  usage_date date not null,
  line_subject text not null,
  user_count integer not null default 0 check (user_count >= 0),
  primary key (usage_date, line_subject)
);
alter table public.line_chat_usage enable row level security;
revoke all on table public.line_chat_usage from public, anon, authenticated;
grant select, insert, update on public.line_chat_usage to service_role;

create table public.line_chat_global_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.line_chat_global_usage enable row level security;
revoke all on table public.line_chat_global_usage from public, anon, authenticated;
grant select, insert, update on public.line_chat_global_usage to service_role;

create table public.line_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.package_bookings(id) on delete cascade,
  customer_account_id uuid not null references public.app_accounts(id) on delete cascade,
  line_subject text not null,
  reply_code text not null unique check (reply_code ~ '^[A-F0-9]{6}$'),
  recipient text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  retry_key uuid not null unique,
  status text not null default 'ready' check (status in ('ready', 'sending', 'accepted', 'failed', 'uncertain', 'received', 'blocked')),
  accepted_request_id text,
  feedback text check (feedback is null or char_length(feedback) between 1 and 2000),
  due_at timestamptz not null,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  updated_at timestamptz not null default now()
);
create index line_feedback_due_idx on public.line_feedback_requests (due_at, first_attempt_at) where status in ('ready', 'failed', 'uncertain');
alter table public.line_feedback_requests enable row level security;
revoke all on table public.line_feedback_requests from public, anon, authenticated;
grant select, insert, update on public.line_feedback_requests to service_role;

create or replace function public.enforce_line_feedback_payload_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.customer_account_id is distinct from old.customer_account_id
    or new.line_subject is distinct from old.line_subject
    or new.reply_code is distinct from old.reply_code
    or new.recipient is distinct from old.recipient
    or new.payload is distinct from old.payload
    or new.retry_key is distinct from old.retry_key
    or new.due_at is distinct from old.due_at then
    raise exception 'Feedback request payload is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger line_feedback_payload_immutable before update on public.line_feedback_requests
for each row execute function public.enforce_line_feedback_payload_immutable();
revoke all on function public.enforce_line_feedback_payload_immutable() from public, anon, authenticated, service_role;

create or replace function public.claim_line_webhook_event(target_event_id text, target_line_subject text, target_event_type text)
returns text language plpgsql security definer set search_path = '' as $$
declare inserted_id text;
declare current_status text;
declare current_error_kind text;
declare lock_active boolean;
declare event_subject text;
begin
  if target_event_id is null or char_length(target_event_id) not between 1 and 200 then return 'invalid'; end if;
  insert into public.line_webhook_events(event_id, line_subject, event_type)
  values (target_event_id, target_line_subject, target_event_type)
  on conflict do nothing returning event_id into inserted_id;
  if inserted_id is null then
    select status, error_kind, line_subject into current_status, current_error_kind, event_subject
      from public.line_webhook_events where event_id = target_event_id for update;
    if event_subject is distinct from target_line_subject then return 'duplicate'; end if;
    if current_status = 'processing' then
      select exists(select 1 from public.line_webhook_locks l where l.line_subject = event_subject and l.event_id = target_event_id and l.lease_until > now()) into lock_active;
      if lock_active then return 'busy'; end if;
      update public.line_webhook_events set status = 'failed', error_kind = 'pre_send', updated_at = now() where event_id = target_event_id;
      current_status := 'failed'; current_error_kind := 'pre_send';
    end if;
    if current_status <> 'failed' or coalesce(current_error_kind, '') not in ('busy', 'pre_send') then return 'duplicate'; end if;
  end if;
  if target_line_subject is not null then
    insert into public.line_webhook_locks(line_subject, event_id, lease_until)
    values (target_line_subject, target_event_id, now() + interval '60 seconds')
    on conflict (line_subject) do update set event_id = excluded.event_id, lease_until = excluded.lease_until
      where public.line_webhook_locks.lease_until < now();
    if not found then
      update public.line_webhook_events set status = 'failed', error_kind = 'busy', updated_at = now() where event_id = target_event_id;
      return 'busy';
    end if;
  end if;
  update public.line_webhook_events set status = 'processing', error_kind = null, updated_at = now() where event_id = target_event_id;
  return 'claimed';
end;
$$;

create or replace function public.finish_line_webhook_event(target_event_id text, target_status text, target_error_kind text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare event_subject text;
begin
  update public.line_webhook_events set status = target_status, error_kind = target_error_kind, updated_at = now()
    where event_id = target_event_id and status in ('processing', 'uncertain') returning line_subject into event_subject;
  if event_subject is not null then delete from public.line_webhook_locks where line_subject = event_subject and event_id = target_event_id; end if;
end;
$$;

create or replace function public.mark_line_webhook_reply_attempt(target_event_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.line_webhook_events set status = 'uncertain', updated_at = now()
    where event_id = target_event_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.claim_line_chat_quota(target_line_subject text, target_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare global_count integer;
declare user_count integer;
begin
  insert into public.line_chat_global_usage(usage_date, request_count) values (target_date, 0) on conflict do nothing;
  select request_count into global_count from public.line_chat_global_usage where usage_date = target_date for update;
  insert into public.line_chat_usage(usage_date, line_subject, user_count) values (target_date, target_line_subject, 0) on conflict do nothing;
  select line_chat_usage.user_count into user_count from public.line_chat_usage where usage_date = target_date and line_subject = target_line_subject for update;
  if global_count >= 100 or user_count >= 10 then return false; end if;
  update public.line_chat_global_usage set request_count = request_count + 1 where usage_date = target_date;
  update public.line_chat_usage set user_count = user_count + 1 where usage_date = target_date and line_subject = target_line_subject;
  return true;
end;
$$;

create or replace function public.claim_due_line_feedback(target_now timestamptz, target_limit integer default 20, target_exclude_ids uuid[] default '{}'::uuid[])
returns setof public.line_feedback_requests language plpgsql security definer set search_path = '' as $$
begin
  update public.line_feedback_requests set status = 'uncertain', lease_until = null, updated_at = target_now
    where status = 'sending' and (lease_until is null or lease_until <= target_now);
  with due as (
    select b.id as booking_id, b.customer_account_id, a.line_subject, b.end_date,
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)) as code
    from public.package_bookings b
    join public.app_accounts a on a.id = b.customer_account_id and a.role = 'customer' and a.status = 'active'
    where b.status = 'paid_simulated'
      and b.end_date + 3 <= (target_now at time zone 'Asia/Bangkok')::date
      and a.line_subject ~ '^U[0-9a-fA-F]{32}$'
      and not exists (select 1 from public.line_feedback_requests f where f.booking_id = b.id)
    order by b.end_date, b.id
    for update of b skip locked
    limit greatest(1, least(target_limit, 50))
  )
  insert into public.line_feedback_requests(booking_id, customer_account_id, line_subject, reply_code, recipient, payload, retry_key, due_at)
  select d.booking_id, d.customer_account_id, d.line_subject, d.code, d.line_subject,
    jsonb_build_object('to', d.line_subject, 'messages', jsonb_build_array(jsonb_build_object('type', 'text', 'text',
      'ทริปของคุณจบแล้ว อยากชวนแบ่งปันความคิดเห็นสั้น ๆ ตอบกลับว่า FB ' || d.code || ' ตามด้วยความคิดเห็นได้เลย'))),
    gen_random_uuid(), ((d.end_date + 3)::timestamp at time zone 'Asia/Bangkok')
  from due d
  on conflict (booking_id) do nothing;
  return query
  with due as (
    select f.id from public.line_feedback_requests f
    where f.due_at <= target_now and f.status in ('ready', 'failed', 'uncertain')
      and not (f.id = any(target_exclude_ids))
      and (f.first_attempt_at is null or target_now < f.first_attempt_at + interval '24 hours' - interval '1 minute')
    order by f.due_at, f.id
    for update of f skip locked
    limit greatest(1, least(target_limit, 50))
  )
  update public.line_feedback_requests f set status = 'sending',
    first_attempt_at = coalesce(f.first_attempt_at, target_now), lease_until = target_now + interval '30 seconds', updated_at = target_now
  from due where f.id = due.id
  returning f.id, f.booking_id, f.customer_account_id, f.line_subject, f.reply_code, f.recipient,
    f.payload, f.retry_key, f.status, f.accepted_request_id, f.feedback, f.due_at,
    f.first_attempt_at, f.lease_until, f.created_at, f.sent_at, f.received_at, f.updated_at;
end;
$$;

create or replace function public.save_line_feedback(target_line_subject text, target_code text, target_feedback text)
returns text language plpgsql security definer set search_path = '' as $$
declare target_row public.line_feedback_requests%rowtype;
begin
  if char_length(target_feedback) not between 1 and 2000 then return 'invalid'; end if;
  select * into target_row from public.line_feedback_requests
    where line_subject = target_line_subject and reply_code = upper(target_code) for update;
  if not found then return 'not_found'; end if;
  if target_row.status = 'received' then return 'duplicate'; end if;
  if target_row.status not in ('accepted', 'uncertain') then return 'not_sent'; end if;
  update public.line_feedback_requests set feedback = target_feedback, status = 'received', received_at = coalesce(received_at, now()), updated_at = now()
  where id = target_row.id;
  return 'saved';
end;
$$;

revoke all on function public.claim_line_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.finish_line_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.mark_line_webhook_reply_attempt(text) from public, anon, authenticated;
revoke all on function public.claim_line_chat_quota(text, date) from public, anon, authenticated;
revoke all on function public.claim_due_line_feedback(timestamptz, integer, uuid[]) from public, anon, authenticated;
revoke all on function public.save_line_feedback(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_line_webhook_event(text, text, text) to service_role;
grant execute on function public.finish_line_webhook_event(text, text, text) to service_role;
grant execute on function public.mark_line_webhook_reply_attempt(text) to service_role;
grant execute on function public.claim_line_chat_quota(text, date) to service_role;
grant execute on function public.claim_due_line_feedback(timestamptz, integer, uuid[]) to service_role;
grant execute on function public.save_line_feedback(text, text, text) to service_role;
