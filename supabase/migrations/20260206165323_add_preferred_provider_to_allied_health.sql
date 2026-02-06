/*
  # Add Preferred Provider to Allied Health Needs

  1. Changes
    - Allied health needs in the clients table now support a `preferredProviderId` field
    - This allows clients to specify their preferred OT or SLP provider for each allied health need
    - The field is optional and references the therapists table
  
  2. Technical Details
    - Updates the JSON structure validation for allied_health_needs column
    - No data migration needed as this is a new optional field
    - Existing allied health needs will work without the field
*/

-- No schema changes needed since allied_health_needs is stored as JSONB
-- The preferredProviderId field will be added to the JSON objects as needed
-- This migration serves as documentation of the schema change

-- Add a comment to document the field
COMMENT ON COLUMN clients.allied_health_needs IS 'Array of allied health needs. Each need has: type (OT|SLP), specificDays (array), startTime (HH:MM), endTime (HH:MM), and optional preferredProviderId (references therapists.id)';
