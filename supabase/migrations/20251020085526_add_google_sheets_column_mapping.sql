/*
  # Add Google Sheets Column Mapping to app_settings

  1. Changes
    - Add `google_sheets_column_mapping` column to `app_settings` table
      - Type: JSONB (to store flexible column mapping configuration)
      - Nullable: true (optional configuration)
      - Purpose: Store mapping between Google Sheets columns and Order fields
  
  2. Notes
    - This allows users to configure once how their Google Sheets columns map to the app's Order fields
    - The mapping persists across sessions
    - Uses the same structure as CSV column mappings for consistency
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'google_sheets_column_mapping'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN google_sheets_column_mapping jsonb;
  END IF;
END $$;