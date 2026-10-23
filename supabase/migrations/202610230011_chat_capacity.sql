create or replace function public.claim_line_chat_quota(target_line_subject text, target_date date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare global_count integer;
declare user_count integer;
begin
  insert into public.line_chat_global_usage(usage_date, request_count) values (target_date, 0) on conflict do nothing;
  select request_count into global_count from public.line_chat_global_usage where usage_date = target_date for update;
  insert into public.line_chat_usage(usage_date, line_subject, user_count) values (target_date, target_line_subject, 0) on conflict do nothing;
  select line_chat_usage.user_count into user_count from public.line_chat_usage where usage_date = target_date and line_subject = target_line_subject for update;
  if global_count >= 1000 or user_count >= 50 then return false; end if;
  update public.line_chat_global_usage set request_count = request_count + 1 where usage_date = target_date;
  update public.line_chat_usage as usage set user_count = usage.user_count + 1 where usage_date = target_date and line_subject = target_line_subject;
  return true;
end;
$$;

revoke all on function public.claim_line_chat_quota(text, date) from public, anon, authenticated;
grant execute on function public.claim_line_chat_quota(text, date) to service_role;
