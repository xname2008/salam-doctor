-- Comprehensive scan + fix for "salam-doctor.ir" across EVERY text/varchar
-- column in EVERY table of the public schema — not just the Clinic/Article
-- columns targeted earlier. Reports what it finds and fixes via RAISE NOTICE.

DO $$
DECLARE
  r RECORD;
  affected INT;
  total INT := 0;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying', 'text', 'character')
  LOOP
    EXECUTE format(
      'UPDATE %I SET %I = REPLACE(%I, %L, %L) WHERE %I ILIKE %L',
      r.table_name, r.column_name, r.column_name,
      'salam-doctor.ir', 'salam-doctor.com',
      r.column_name, '%salam-doctor.ir%'
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      RAISE NOTICE 'Fixed %.%: % row(s)', r.table_name, r.column_name, affected;
      total := total + affected;
    END IF;
  END LOOP;
  RAISE NOTICE 'Total rows updated: %', total;
END $$;

-- Verification pass: should report nothing left.
DO $$
DECLARE
  r RECORD;
  remaining INT;
  found_any BOOLEAN := false;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying', 'text', 'character')
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I ILIKE %L',
      r.table_name, r.column_name, '%salam-doctor.ir%'
    ) INTO remaining;
    IF remaining > 0 THEN
      RAISE NOTICE 'WARNING: %.% still has % reference(s)', r.table_name, r.column_name, remaining;
      found_any := true;
    END IF;
  END LOOP;
  IF NOT found_any THEN
    RAISE NOTICE 'Verification: no remaining references to the old domain anywhere in the database.';
  END IF;
END $$;
