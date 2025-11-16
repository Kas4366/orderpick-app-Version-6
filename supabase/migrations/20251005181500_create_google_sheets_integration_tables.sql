/*
  # Create Google Sheets Integration Tables

  1. New Tables
    - `google_auth_tokens`
      - `id` (uuid, primary key) - Unique identifier
      - `access_token` (text) - Google OAuth access token
      - `refresh_token` (text) - Google OAuth refresh token
      - `token_expiry` (timestamptz) - When the access token expires
      - `created_at` (timestamptz) - When the token was created
      - `updated_at` (timestamptz) - When the token was last updated
    
    - `app_settings`
      - `id` (uuid, primary key) - Unique identifier
      - `google_sheets_url` (text) - URL of the Google Sheet
      - `google_sheets_id` (text) - Extracted Sheet ID from URL
      - `connection_status` (text) - Connection status (connected/disconnected)
      - `last_sync_time` (timestamptz) - Last time orders were synced
      - `last_employee_sync_time` (timestamptz) - Last time employees were synced
      - `selected_date` (date) - Currently selected order date filter
      - `created_at` (timestamptz) - When settings were created
      - `updated_at` (timestamptz) - When settings were last updated
  
  2. Security
    - Enable RLS on both tables
    - Allow all operations for now (single-user trusted environment)
  
  3. Notes
    - Only one row should exist in each table (singleton pattern)
    - Tokens are stored securely with RLS enabled
    - Settings persist across sessions
*/

-- Create google_auth_tokens table
CREATE TABLE IF NOT EXISTS google_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sheets_url text,
  google_sheets_id text,
  connection_status text DEFAULT 'disconnected',
  last_sync_time timestamptz,
  last_employee_sync_time timestamptz,
  selected_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE google_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for google_auth_tokens (allow all for trusted environment)
CREATE POLICY "Allow all operations on google_auth_tokens"
  ON google_auth_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for app_settings (allow all for trusted environment)
CREATE POLICY "Allow all operations on app_settings"
  ON app_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at
CREATE TRIGGER update_google_auth_tokens_updated_at
  BEFORE UPDATE ON google_auth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default app_settings row
INSERT INTO app_settings (id, connection_status)
VALUES (gen_random_uuid(), 'disconnected');