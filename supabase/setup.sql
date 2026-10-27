-- Run once in Supabase SQL Editor. Do not expose a service_role key to the browser.
create extension if not exists pgcrypto;
create table if not exists public.dinner_rooms (
 id uuid primary key default gen_random_uuid(),
 host_id uuid not null references auth.users(id),
 location text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.dinner_guests (
 room_id uuid not null references public.dinner_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 guest_name text not null check (char_length(guest_name) between 1 and 40),
 cuisines text[] not null default '{}',
 joined_at timestamptz not null default now(),
 primary key(room_id,user_id),
 constraint max_cuisines check (cardinality(cuisines) <= 25)
);
create index if not exists dinner_guests_user on public.dinner_guests(user_id);
alter table public.dinner_rooms enable row level security;
alter table public.dinner_guests enable row level security;
create or replace function public.is_dinner_member(p_room uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.dinner_guests g where g.room_id=p_room and g.user_id=auth.uid());
$$;
revoke all on function public.is_dinner_member(uuid) from public, anon;
grant execute on function public.is_dinner_member(uuid) to authenticated;
drop policy if exists "host creates room" on public.dinner_rooms;
create policy "host creates room" on public.dinner_rooms for insert to authenticated with check (host_id=auth.uid());
drop policy if exists "members see room" on public.dinner_rooms;
create policy "members see room" on public.dinner_rooms for select to authenticated using (public.is_dinner_member(id));
drop policy if exists "host edits room" on public.dinner_rooms;
create policy "host edits room" on public.dinner_rooms for update to authenticated using (host_id=auth.uid()) with check(host_id=auth.uid());
drop policy if exists "members see guests" on public.dinner_guests;
create policy "members see guests" on public.dinner_guests for select to authenticated using (public.is_dinner_member(room_id));
drop policy if exists "own vote updates" on public.dinner_guests;
create policy "own vote updates" on public.dinner_guests for update to authenticated using (user_id=auth.uid() and public.is_dinner_member(room_id)) with check(user_id=auth.uid() and public.is_dinner_member(room_id));
-- The RPC allows a signed-in anonymous guest with the unguessable room URL to join.
create or replace function public.join_dinner_room(p_room uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if not exists (select 1 from public.dinner_rooms where id=p_room) then raise exception 'Dinner room not found'; end if;
 if char_length(trim(p_name)) not between 1 and 40 then raise exception 'Enter your name (1-40 characters)'; end if;
 if (select count(*) from public.dinner_guests where room_id=p_room) >= 50
   and not exists(select 1 from public.dinner_guests where room_id=p_room and user_id=auth.uid())
 then raise exception 'Dinner room is full'; end if;
 insert into public.dinner_guests(room_id,user_id,guest_name)
 values(p_room,auth.uid(),trim(p_name))
 on conflict(room_id,user_id) do nothing;
end $$;
revoke all on function public.join_dinner_room(uuid,text) from public, anon;
grant execute on function public.join_dinner_room(uuid,text) to authenticated;
grant usage on schema public to authenticated;
grant select,insert,update on public.dinner_rooms to authenticated;
grant select,update on public.dinner_guests to authenticated;
