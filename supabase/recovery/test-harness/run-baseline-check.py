from pathlib import Path
import os
import re
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "supabase/recovery/baseline"
HARNESS = ROOT / "supabase/recovery/test-harness"

def blocks(path: Path, language: str):
    text = path.read_text(encoding="utf-8")
    pattern = rf"```{re.escape(language)}\s*\n(.*?)```"
    return re.findall(pattern, text, flags=re.IGNORECASE | re.DOTALL)

def run_file(label: str, content: str, directory: Path):
    path = directory / f"{label}.sql"
    path.write_text(content, encoding="utf-8")
    print(f"\n=== PostgreSQL DDL stage: {label} ===", flush=True)
    subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", str(path)], check=True)

# Validate the non-SQL Supabase bucket configuration syntax without applying it.
toml_blocks = blocks(BASE / "70-storage-cron-draft.md", "toml")
assert len(toml_blocks) == 1, f"Expected one TOML block, found {len(toml_blocks)}"
config = tomllib.loads(toml_blocks[0])
buckets = config["storage"]["buckets"]
assert set(buckets) == {"event-covers", "payment-receipts"}
assert buckets["event-covers"]["public"] is True
assert buckets["event-covers"]["file_size_limit"] == "10MiB"
assert buckets["payment-receipts"]["public"] is False
assert buckets["payment-receipts"]["file_size_limit"] == "5MiB"
print("Storage bucket TOML: valid; both bucket settings match expected IDs and limits.")

stages = [
    ("00-platform-stubs", (HARNESS / "preflight.sql").read_text(encoding="utf-8")),
    ("10-tables", blocks(BASE / "20-tables-draft.sql.md", "sql")[0]),
    ("20-routines", blocks(BASE / "10-routines-draft.sql.md", "sql")[0]),
    ("30-constraints-indexes", blocks(BASE / "30-constraints-indexes-draft.sql.md", "sql")[0]),
    ("40-rls-policies", blocks(BASE / "40-rls-policies-draft.sql.md", "sql")[0]),
    ("50-triggers", blocks(BASE / "50-triggers-draft.sql.md", "sql")[0]),
    ("60-privileges", "\n\n".join(blocks(BASE / "60-privileges-draft.sql.md", "sql"))),
]
storage_sql = blocks(BASE / "70-storage-cron-draft.md", "sql")
assert len(storage_sql) == 2, f"Expected two SQL blocks in Storage/Cron draft, found {len(storage_sql)}"
stages.extend([
    ("70-storage-policies", storage_sql[0]),
    ("80-cron-jobs", storage_sql[1]),
])

for label, content in stages:
    assert content.strip(), f"Empty stage: {label}"

with tempfile.TemporaryDirectory(prefix="haddir-baseline-") as tmp:
    temp = Path(tmp)
    for label, content in stages:
        run_file(label, content, temp)

    assertions = r"""
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  IF n <> 16 THEN RAISE EXCEPTION 'Expected 16 public tables, got %', n; END IF;

  SELECT count(*) INTO n FROM information_schema.columns WHERE table_schema = 'public';
  IF n <> 158 THEN RAISE EXCEPTION 'Expected 158 public columns, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace s ON s.oid = t.relnamespace
  WHERE s.nspname = 'public';
  IF n <> 81 THEN RAISE EXCEPTION 'Expected 81 constraints, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname = 'public';
  IF n <> 57 THEN RAISE EXCEPTION 'Expected 57 total indexes, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public';
  IF n <> 29 THEN RAISE EXCEPTION 'Expected 29 public policies, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_trigger tr
  JOIN pg_class t ON t.oid = tr.tgrelid
  JOIN pg_namespace s ON s.oid = t.relnamespace
  WHERE s.nspname = 'public' AND NOT tr.tgisinternal;
  IF n <> 12 THEN RAISE EXCEPTION 'Expected 12 public triggers, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_proc p
  JOIN pg_namespace s ON s.oid = p.pronamespace
  WHERE s.nspname IN ('public', 'private');
  IF n <> 32 THEN RAISE EXCEPTION 'Expected 32 app routines, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_proc p
  JOIN pg_namespace s ON s.oid = p.pronamespace
  WHERE s.nspname IN ('public', 'private')
    AND (p.proowner <> 'postgres'::regrole
      OR p.proconfig IS NULL
      OR NOT (p.proconfig @> ARRAY['search_path=""']));
  IF n <> 0 THEN RAISE EXCEPTION '% app routines have wrong owner or search_path', n; END IF;

  SELECT count(*) INTO n FROM pg_class t
  JOIN pg_namespace s ON s.oid = t.relnamespace
  WHERE s.nspname = 'public' AND t.relkind = 'r' AND t.relrowsecurity;
  IF n <> 16 THEN RAISE EXCEPTION 'Expected RLS enabled on all 16 tables, got %', n; END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'storage';
  IF n <> 6 THEN RAISE EXCEPTION 'Expected 6 Storage policies, got %', n; END IF;

  SELECT count(*) INTO n FROM cron.job WHERE active;
  IF n <> 2 THEN RAISE EXCEPTION 'Expected 2 active cron jobs, got %', n; END IF;

  IF has_function_privilege('authenticated', 'public.get_haddir_push_config()', 'EXECUTE')
    THEN RAISE EXCEPTION 'authenticated must not execute get_haddir_push_config'; END IF;
  IF NOT has_function_privilege('service_role', 'public.get_haddir_push_config()', 'EXECUTE')
    THEN RAISE EXCEPTION 'service_role must execute get_haddir_push_config'; END IF;
  IF NOT has_function_privilege('authenticated', 'private.gatekeeper_ticket_action_core(text,boolean)', 'EXECUTE')
    THEN RAISE EXCEPTION 'faithful draft no longer reflects the observed gatekeeper-core grant'; END IF;
END $$;

SELECT 'PASS: all baseline DDL stages created and catalog assertions matched.' AS result;
"""
    run_file("90-assertions", assertions, temp)

print("\nPASS: PostgreSQL 17 DDL smoke test completed using disposable platform stubs.")
print("This is not a Supabase platform integration test and does not execute application workflows.")
