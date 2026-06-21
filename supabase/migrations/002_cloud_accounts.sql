-- Cloud login by name + password (no email confirmation needed)
-- Run in Supabase SQL Editor after 001_initial.sql
-- Also disable "Confirm email" under Authentication → Providers → Email

create extension if not exists pgcrypto;

create table if not exists app_accounts (
  id uuid primary key default gen_random_uuid(),
  name_normalized text unique not null,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz default now()
);

alter table app_accounts enable row level security;

create or replace function register_account(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_normalized text;
  v_hash text;
begin
  v_normalized := lower(trim(p_name));
  if v_normalized = '' then
    raise exception 'Name is required';
  end if;
  if p_password is null or length(p_password) < 1 then
    raise exception 'Password is required';
  end if;
  v_hash := encode(digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');
  insert into app_accounts (name_normalized, display_name, password_hash)
  values (v_normalized, trim(p_name), v_hash)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Name already in use';
end;
$$;

create or replace function login_account(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
begin
  v_hash := encode(digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');
  select id into v_id
  from app_accounts
  where name_normalized = lower(trim(p_name))
    and password_hash = v_hash;
  if v_id is null then
    raise exception 'Invalid name or password';
  end if;
  return v_id;
end;
$$;

grant execute on function register_account(text, text) to anon, authenticated;
grant execute on function login_account(text, text) to anon, authenticated;

-- Allow cloud user_data without Supabase Auth (uses app_accounts id)
alter table user_data drop constraint if exists user_data_user_id_fkey;

drop policy if exists "Users can read own data" on user_data;
drop policy if exists "Users can upsert own data" on user_data;
drop policy if exists "Users can update own data" on user_data;

create policy "Anyone can read user_data"
  on user_data for select
  to anon, authenticated
  using (true);

create policy "Anyone can insert user_data"
  on user_data for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can update user_data"
  on user_data for update
  to anon, authenticated
  using (true);
