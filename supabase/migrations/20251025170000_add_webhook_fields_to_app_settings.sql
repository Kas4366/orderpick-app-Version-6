/*
  # Add Webhook Fields to App Settings

  1. Changes to app_settings Table
    - Add `apps_script_webhook_url` (text, nullable) - URL endpoint for Google Apps Script webhook
    - Add `apps_script_secret_key` (text, nullable) - Optional secret key for webhook security
    - Add `webhook_enabled` (boolean, default false) - Flag to enable/disable webhook updates
    - Add `last_webhook_test_time` (timestamptz, nullable) - Last time webhook was tested
    - Add `last_webhook_test_status` (text, nullable) - Result of last webhook test (success/error)

  2. Purpose
    - Enable real-time packer info updates to Google Sheets via Apps Script webhook
    - Provide secure communication channel without OAuth complexity
    - Track webhook health and connectivity status

  3. Notes
    - Webhook URL is the deployed Google Apps Script web app endpoint
    - Secret key is optional but recommended for production use
    - These fields work alongside existing Google Sheets read-only integration
*/

-- Add webhook configuration fields to app_settings table
DO $$
BEGIN
  -- Add apps_script_webhook_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'apps_script_webhook_url'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN apps_script_webhook_url text;
  END IF;

  -- Add apps_script_secret_key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'apps_script_secret_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN apps_script_secret_key text;
  END IF;

  -- Add webhook_enabled column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'webhook_enabled'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN webhook_enabled boolean DEFAULT false;
  END IF;

  -- Add last_webhook_test_time column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'last_webhook_test_time'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN last_webhook_test_time timestamptz;
  END IF;

  -- Add last_webhook_test_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'last_webhook_test_status'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN last_webhook_test_status text;
  END IF;
END $$;
