-- STEP 1 / RUN B  (after run A). Safe: aborts with an error instead of guessing.
BEGIN;

-- 1. Make sure the PHARMACY role row exists
INSERT INTO roles (id, name, description, "createdAt")
SELECT gen_random_uuid(), 'PHARMACY', 'PHARMACY role', now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'PHARMACY');

-- 2. PHARMACIST users are different real people. Do NOT auto-convert them. Abort if any exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users u JOIN roles r ON r.id = u."roleId" WHERE r.name = 'PHARMACIST') THEN
    RAISE EXCEPTION 'PHARMACIST users exist. Stop and decide mapping manually.';
  END IF;
  IF EXISTS (SELECT 1 FROM pharmacy_staff WHERE "staffRole" = 'PHARMACIST') THEN
    RAISE EXCEPTION 'pharmacy_staff rows with PHARMACIST exist. Stop and decide mapping manually.';
  END IF;
  IF (SELECT count(*) FROM inventory) > 0 OR (SELECT count(*) FROM stock_movements) > 0 THEN
    RAISE EXCEPTION 'inventory/stock_movements contain data. Stop; approval needed before dropping.';
  END IF;
END $$;

-- 3. PHARMACY_ADMIN accounts -> PHARMACY (same user ids, nothing merged)
UPDATE users SET "roleId" = (SELECT id FROM roles WHERE name = 'PHARMACY')
WHERE "roleId" = (SELECT id FROM roles WHERE name = 'PHARMACY_ADMIN');

-- 4. pharmacy_staff ADMIN -> OWNER
UPDATE pharmacy_staff SET "staffRole" = 'OWNER' WHERE "staffRole" = 'ADMIN';

-- 5. Remove the now-unused old role rows (fails safely if any user still references them)
DELETE FROM roles WHERE name IN ('PHARMACY_ADMIN', 'PHARMACIST');

COMMIT;
