-- Minimal platform stubs for a disposable PostgreSQL syntax/DDL test.
-- These are not Supabase replacements and must never be applied to a real project.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA vault;
CREATE SCHEMA net;
CREATE SCHEMA cron;
CREATE SCHEMA private;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  owner_id text
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/')
$$;

CREATE TABLE vault.decrypted_secrets (
  name text PRIMARY KEY,
  decrypted_secret text NOT NULL
);

CREATE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 2000
)
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT 1::bigint
$$;

CREATE TABLE cron.job (
  jobid bigserial PRIMARY KEY,
  jobname text UNIQUE NOT NULL,
  schedule text NOT NULL,
  command text NOT NULL,
  username text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_jobid bigint;
BEGIN
  INSERT INTO cron.job(jobname, schedule, command, username)
  VALUES ($1, $2, $3, current_user)
  ON CONFLICT (jobname) DO UPDATE
    SET schedule = EXCLUDED.schedule,
        command = EXCLUDED.command,
        username = EXCLUDED.username,
        active = true
  RETURNING jobid INTO v_jobid;
  RETURN v_jobid;
END;
$$;
