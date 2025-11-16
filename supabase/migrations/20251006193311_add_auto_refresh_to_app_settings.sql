/*
  # Add Auto-Refresh Setting to App Settings

  1. Changes
    - Add `auto_refresh_enabled` column to `app_settings` table
      - Boolean field to control whether auto-refresh is enabled
      - Defaults to false for user control
  
  2. Notes
    - This setting allows users to enable/disable the 15-minute auto-refresh feature
    - When enabled, the app will automatically check for new orders every 15 minutes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'auto_refresh_enabled'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN auto_refresh_enabled boolean DEFAULT false;
  END IF;
END $$;
