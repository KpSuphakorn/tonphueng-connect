create table public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('customer', 'staff', 'admin')),
  status text not null check (status in ('active', 'pending', 'disabled')),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  line_subject text,
  created_at timestamptz not null default now(),
  constraint app_accounts_identity_matches_role check (
    (role = 'customer' and auth_user_id is null and line_subject is not null)
    or (role = 'staff' and auth_user_id is not null and line_subject is null)
    or (role = 'admin' and auth_user_id is not null and (
      (status = 'pending' and line_subject is null)
      or (status = 'active' and line_subject is not null)
      or status = 'disabled'
    ))
  )
);

-- A community member may use the same LINE account as both Admin and Customer.
-- Sessions remain limited to the role recorded on their own account row.
create unique index app_accounts_role_line_subject_key
  on public.app_accounts (role, line_subject)
  where line_subject is not null;

create table public.app_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  account_id uuid not null references public.app_accounts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index app_sessions_account_expiry_idx
  on public.app_sessions (account_id, expires_at);

alter table public.app_accounts enable row level security;
alter table public.app_sessions enable row level security;

grant usage on schema public to service_role;
revoke all on table public.app_accounts, public.app_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.app_accounts, public.app_sessions to service_role;
