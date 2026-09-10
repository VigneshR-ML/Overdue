-- 0007: expose Vault to PostgREST via SECURITY DEFINER wrappers.
--
-- Background: migration 0003 calls vault.create_secret() in server-side SQL,
-- but the app reaches Supabase over PostgREST, which only serves the `public`
-- schema. So supabase.rpc("create_secret") 404s (PGRST202) and every write
-- silently falls back to the plaintext payload column; reads from
-- vault.decrypted_secrets fail the same way. These wrappers close that gap.
-- They are callable by any DB role, but the app only invokes them with the
-- service_role key (server-only, RLS bypassed anyway) — never the anon key.
-- Safe to re-run: all statements are IF NOT EXISTS-guarded or CREATE OR REPLACE.

-- Vault ships pre-enabled on Supabase Cloud; keep this guard for fresh projects.
create extension if not exists "supabase_vault" with schema "vault";

-- Write path used by setCredentials().
create or replace function public.create_secret(secret text, name text)
returns uuid
language plpgsql
security definer
set search_path = vault, pg_temp
as $$
declare
  sid uuid;
begin
  select vault.create_secret(secret, name) into sid;
  return sid;
end;
$$;

-- Read path used by getCredentials(). Returns the decrypted secret text.
create or replace function public.read_secret(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = vault, pg_temp
as $$
declare
  val text;
begin
  select decrypted_secret into val
    from vault.decrypted_secrets
   where id = secret_id;
  return val;
end;
$$;
