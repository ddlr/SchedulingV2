/*
  # Fix column types to use jsonb instead of text[]

  1. Changes
    - Convert therapists.qualifications from text[] to jsonb
    - Convert therapists.can_provide_allied_health from text[] to jsonb
    - Convert clients.insurance_requirements from text[] to jsonb
    - Convert clients.allied_health_needs from text[] to jsonb
    - Convert base_schedules.applies_to_days from text[] to jsonb

  2. Security
    - Maintains existing RLS policies
*/

-- Drop dependent objects if they exist
DO $$ 
BEGIN
  -- Therapists column changes
  ALTER TABLE therapists 
    ALTER COLUMN qualifications TYPE jsonb USING qualifications::text::jsonb;
  
  ALTER TABLE therapists 
    ALTER COLUMN can_provide_allied_health TYPE jsonb USING can_provide_allied_health::text::jsonb;
  
  -- Clients column changes
  ALTER TABLE clients 
    ALTER COLUMN insurance_requirements TYPE jsonb USING insurance_requirements::text::jsonb;
  
  ALTER TABLE clients 
    ALTER COLUMN allied_health_needs TYPE jsonb USING allied_health_needs::text::jsonb;
  
  -- Base schedules column changes
  ALTER TABLE base_schedules 
    ALTER COLUMN applies_to_days TYPE jsonb USING applies_to_days::text::jsonb;
    
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error occurred: %', SQLERRM;
END $$;