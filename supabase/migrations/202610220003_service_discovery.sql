alter table public.services
  add column description text not null default '' check (char_length(description) <= 4000);

create table public.my_trip_saved_services (
  customer_account_id uuid not null references public.app_accounts (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_account_id, service_id)
);

alter table public.my_trip_saved_services enable row level security;
revoke all on table public.my_trip_saved_services from public, anon, authenticated;
grant select, insert, delete on table public.my_trip_saved_services to service_role;
