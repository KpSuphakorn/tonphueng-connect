-- Ticket 08: one Supabase Auth user (email/password) may hold a Staff and an Admin account row.
-- Each role still has at most one account row per Auth user, and the role/identity check
-- constraint from migration 001 is unchanged (Customer stays LINE-only without an Auth user).
alter table public.app_accounts drop constraint app_accounts_auth_user_id_key;

create unique index app_accounts_role_auth_user_id_key
  on public.app_accounts (role, auth_user_id)
  where auth_user_id is not null;
