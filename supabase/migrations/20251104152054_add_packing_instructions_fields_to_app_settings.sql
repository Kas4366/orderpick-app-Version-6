/*
  # Add Packing Instructions Fields to App Settings

  1. Changes
    - Add `packing_instructions_tab_name` column to store the tab name (default: "Packing Instructions")
    - Add `packing_instructions_last_sync` column to track last sync timestamp
    - Add `packing_instructions_sync_status` column to track sync status (success, error, never_synced)
    - Add `packing_instructions_error_message` column to store error messages if sync fails

  2. Notes
    - These fields enable Google Sheets integration for packing instructions
    - Default tab name is "Packing Instructions"
    - Sync status helps track connection health
*/

-- Add packing instructions fields to app_settings table
DO $$
BEGIN
  -- Add packing_instructions_tab_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'packing_instructions_tab_name'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN packing_instructions_tab_name text DEFAULT 'Packing Instructions';
  END IF;

  -- Add packing_instructions_last_sync column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'packing_instructions_last_sync'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN packing_instructions_last_sync timestamptz;
  END IF;

  -- Add packing_instructions_sync_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'packing_instructions_sync_status'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN packing_instructions_sync_status text DEFAULT 'never_synced';
  END IF;

  -- Add packing_instructions_error_message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'packing_instructions_error_message'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN packing_instructions_error_message text;
  END IF;
END $$;
