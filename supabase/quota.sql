-- Photo-identification daily quota. Only the Edge Function (service role) touches these.
create table if not exists profile_quota (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table profile_quota enable row level security;
-- no anon/authenticated policies: the table is only reachable via the SECURITY DEFINER functions below

-- Atomically reserve one generation for today; returns true if under the limit, false if over.
create or replace function consume_quota(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
as $$
declare changed int;
begin
  insert into profile_quota(user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set count = profile_quota.count + 1
  where profile_quota.count < p_limit;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Give back a reserved slot when the generation failed or the image wasn't a plant.
create or replace function refund_quota(p_user uuid)
returns void
language plpgsql
security definer
as $$
begin
  update profile_quota
  set count = greatest(0, count - 1)
  where user_id = p_user and day = (now() at time zone 'utc')::date;
end;
$$;
