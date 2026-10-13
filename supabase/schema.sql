-- Rolva Finance Technologies: database setup.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('owner','editor','contributor','viewer')),
  name    text not null default ''
);

create table if not exists public.docs (
  collection text not null check (collection in ('loans','apps','audit','lock')),
  id         text not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_collection_idx on public.docs (collection);

create or replace function public.rf_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.rf_touch();

-- The signed-in person's staff role, or null if they are not staff.
create or replace function public.rf_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid()
$$;

alter table public.admins enable row level security;
alter table public.docs   enable row level security;

revoke all on public.admins, public.docs from anon;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.docs to authenticated;

-- Staff list: any staff member can read it (used to show names in the audit trail).
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated
  using (public.rf_role() is not null);

-- Read: all staff, except the audit trail (contributor and above).
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (
  case collection
    when 'audit' then public.rf_role() in ('owner','editor','contributor')
    else public.rf_role() is not null
  end);

-- Create: contributor and above. Only the owner can change the month-end lock.
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  case collection
    when 'lock' then public.rf_role() = 'owner'
    else public.rf_role() in ('owner','editor','contributor')
  end);

-- Change: contributor and above. Lock and audit entries: owner only (the audit trail is append-only for everyone else).
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  case collection
    when 'lock'  then public.rf_role() = 'owner'
    when 'audit' then public.rf_role() = 'owner'
    else public.rf_role() in ('owner','editor','contributor')
  end) with check (
  case collection
    when 'lock'  then public.rf_role() = 'owner'
    when 'audit' then public.rf_role() = 'owner'
    else public.rf_role() in ('owner','editor','contributor')
  end);

-- Delete: loans and audit entries owner only, applications editor and above.
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  case collection
    when 'apps' then public.rf_role() in ('owner','editor')
    else public.rf_role() = 'owner'
  end);

-- Public application form. Visitors can only call this function; they cannot read or change anything else.
create or replace function public.submit_application(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  n int; v_id text; v_amt numeric; v_inc numeric; v_days int; v_name text; v_phone text;
begin
  if coalesce(p->>'hp','') <> '' then return 'AP-0000'; end if;   -- hidden field filled in by bots
  v_name  := left(btrim(coalesce(p->>'name','')), 100);
  v_phone := left(btrim(coalesce(p->>'phone','')), 20);
  if length(v_name) < 2 or length(v_phone) < 7 then raise exception 'invalid_details'; end if;
  if coalesce(p->>'consent','') <> 'true' then raise exception 'consent_required'; end if;
  begin v_amt := (p->>'amt')::numeric; exception when others then raise exception 'invalid_amount'; end;
  if v_amt is null or v_amt <= 0 or v_amt > 10000000 then raise exception 'invalid_amount'; end if;
  begin v_inc  := coalesce(nullif(p->>'inc','')::numeric, 0); exception when others then v_inc := 0; end;
  begin v_days := coalesce(nullif(p->>'days','')::int, 30);   exception when others then v_days := 30; end;
  v_days := least(greatest(v_days, 1), 3650);

  perform pg_advisory_xact_lock(727001);
  if (select count(*) from public.docs
        where collection = 'apps' and data->>'src' = 'web'
          and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'busy';
  end if;
  select coalesce(max(substr(id, 4)::int), 0) + 1 into n
    from public.docs where collection = 'apps' and id ~ '^AP-[0-9]+$';
  v_id := 'AP-' || lpad(n::text, 4, '0');

  insert into public.docs (collection, id, data) values ('apps', v_id, jsonb_build_object(
    'id', v_id, 'name', v_name, 'phone', v_phone,
    'idno', left(btrim(coalesce(p->>'idno','')), 20),
    'addr', left(btrim(coalesce(p->>'addr','')), 200),
    'emp',  left(btrim(coalesce(p->>'emp','')), 100),
    'inc', v_inc,
    'nok',  left(btrim(coalesce(p->>'nok','')), 100),
    'amt', v_amt, 'days', v_days,
    'purpose', left(btrim(coalesce(p->>'purpose','')), 100),
    'st', 'Pending',
    't', to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM-DD'),
    'src', 'web', 'consent', now()));
  return v_id;
end $$;
revoke all on function public.submit_application(jsonb) from public;
grant execute on function public.submit_application(jsonb) to anon, authenticated;

-- Live updates in the loan manager.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when others then null;
end $$;
