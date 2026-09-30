create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  email_confirmed_at timestamptz,
  display_name text,
  provider text not null default 'email',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email_confirmed_at timestamptz;

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, email_confirmed_at, display_name, provider, last_sign_in_at)
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    new.last_sign_in_at
  )
  on conflict (id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      display_name = excluded.display_name,
      provider = excluded.provider,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = pg_catalog.now();

  return new;
end;
$$;

revoke execute on function public.sync_auth_user_profile() from public, anon, authenticated;

drop trigger if exists sync_auth_user_profile on auth.users;
create trigger sync_auth_user_profile
  after insert or update of email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, last_sign_in_at
  on auth.users
  for each row execute function public.sync_auth_user_profile();

insert into public.profiles (id, email, email_confirmed_at, display_name, provider, last_sign_in_at)
select
  id,
  email,
  email_confirmed_at,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  coalesce(raw_app_meta_data ->> 'provider', 'email'),
  last_sign_in_at
from auth.users
where email is not null
on conflict (id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    display_name = excluded.display_name,
    provider = excluded.provider,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  resume jsonb not null default '{}'::jsonb,
  template text not null default 'classic'
    check (template in ('classic', 'atelier', 'citrus', 'editorial')),
  visible_sections jsonb not null default '{"experience": true, "education": true, "skills": true}'::jsonb,
  photo_mode text not null default 'without'
    check (photo_mode in ('without', 'with')),
  photo_path text,
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

drop policy if exists "Users can read their own resume" on public.resumes;
create policy "Users can read their own resume"
  on public.resumes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own resume" on public.resumes;
create policy "Users can insert their own resume"
  on public.resumes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own resume" on public.resumes;
create policy "Users can update their own resume"
  on public.resumes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own resume" on public.resumes;
create policy "Users can delete their own resume"
  on public.resumes for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own profile photos" on storage.objects;
create policy "Users can read their own profile photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their own profile photos" on storage.objects;
create policy "Users can upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own profile photos" on storage.objects;
create policy "Users can update their own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own profile photos" on storage.objects;
create policy "Users can delete their own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
