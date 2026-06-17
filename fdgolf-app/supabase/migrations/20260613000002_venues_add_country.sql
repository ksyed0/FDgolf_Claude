-- Fix: add country column to venues (referenced by grante_ridge_seed migration)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS country TEXT;
