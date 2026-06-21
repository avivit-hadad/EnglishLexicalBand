-- Fix: function digest(text, unknown) does not exist
-- Run this in Supabase → SQL Editor (one time)

create extension if not exists pgcrypto with schema extensions;

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
