-- LinguoFlow - esquema base para Supabase
-- Ejecuta este script en SQL Editor de Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null default 'Estudiante',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_timestamp();

drop trigger if exists trg_user_progress_updated_at on public.user_progress;
create trigger trg_user_progress_updated_at
before update on public.user_progress
for each row
execute function public.set_timestamp();

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;

drop policy if exists "Profiles select own" on public.profiles;
create policy "Profiles select own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Progress select own" on public.user_progress;
create policy "Progress select own"
on public.user_progress
for select
using (auth.uid() = user_id);

drop policy if exists "Progress insert own" on public.user_progress;
create policy "Progress insert own"
on public.user_progress
for insert
with check (auth.uid() = user_id);

drop policy if exists "Progress update own" on public.user_progress;
create policy "Progress update own"
on public.user_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
