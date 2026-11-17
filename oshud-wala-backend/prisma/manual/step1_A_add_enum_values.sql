-- STEP 1 / RUN A  (run this alone, in Supabase SQL Editor, BEFORE run B)
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'PHARMACY';
ALTER TYPE "PharmacyStaffRole" ADD VALUE IF NOT EXISTS 'OWNER';
