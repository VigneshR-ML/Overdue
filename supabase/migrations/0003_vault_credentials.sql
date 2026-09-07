-- Harden the server-only credential store by migrating payloads into Supabase
-- Vault (encrypted at rest) and keeping only a pointer + metadata in
-- integration_credentials. Run AFTER 0002_credentials.sql.

create extension if not exists "pgcrypto";

-- Backfill: move any plaintext payloads already stored into Vault.
do $$
declare
  rec record;
  sid uuid;
begin
  for rec in
    select id, user_id, provider, payload, updated_at
    from public.integration_credentials
  loop
    if rec.payload is not null and jsonb_typeof(rec.payload) = 'object' then
      select vault.create_secret(rec.payload::text, 'cred:' || rec.user_id || ':' || rec.provider)
        into sid;
      if sid is not null then
        update public.integration_credentials
           set vault_secret_id = sid
         where id = rec.id;
      end if;
    end if;
  end loop;
end $$;

-- New secret values (post-migration writes) go through Vault; this column holds
-- the vault.secrets id returned by vault.create_secret.
alter table public.integration_credentials add column if not exists vault_secret_id uuid;
