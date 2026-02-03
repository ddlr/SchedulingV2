/*
  # Set Up Automatic Cleanup for 30-Day Old Daily Schedules

  1. Functions
    - `cleanup_old_daily_schedules()` - Deletes records older than 30 days
  
  2. Notes
    - This function should be called manually or via a scheduled task
    - Deletes daily_schedules where schedule_date is older than 30 days
    - Returns the count of deleted records
*/

-- Create function to cleanup old daily schedules
CREATE OR REPLACE FUNCTION cleanup_old_daily_schedules()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete daily schedules older than 30 days
  DELETE FROM daily_schedules
  WHERE schedule_date < (CURRENT_DATE - INTERVAL '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to function
COMMENT ON FUNCTION cleanup_old_daily_schedules() IS 'Deletes daily_schedules records older than 30 days. Returns the count of deleted records.';
