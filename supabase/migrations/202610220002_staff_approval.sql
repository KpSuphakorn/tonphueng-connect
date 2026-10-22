create table public.services (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.app_accounts (id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  phone text not null,
  category text not null check (category in ('community_product', 'accommodation', 'restaurant', 'tourism_trail', 'other')),
  other_category text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_other_category_check check (
    (category = 'other' and nullif(trim(other_category), '') is not null)
    or (category <> 'other' and other_category is null)
  )
);

alter table public.services enable row level security;
revoke all on table public.services from public, anon, authenticated;
grant select, insert, update, delete on table public.services to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-business-photos', 'staff-business-photos', false, 5242880, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.approve_staff_account(target_account_id uuid)
returns table (id uuid, role text, status text, line_subject text, auth_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.app_accounts as a
  set status = 'active'
  where a.id = target_account_id
    and a.role = 'staff'
    and a.status = 'pending'
    and exists (
      select 1 from public.services as s where s.account_id = a.id
    )
  returning a.id, a.role, a.status, a.line_subject, a.auth_user_id;
end;
$$;

revoke all on function public.approve_staff_account(uuid) from public, anon, authenticated;
grant execute on function public.approve_staff_account(uuid) to service_role;
