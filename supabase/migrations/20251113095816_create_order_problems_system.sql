/*
  # Create Order Problems System

  ## Overview
  This migration creates the complete infrastructure for the Order Problems Resolution System,
  allowing packers to report order issues and design makers to resolve them with full tracking
  and escalation capabilities.

  ## 1. New Tables

  ### problem_reasons
  Stores customizable problem reasons that packers can select when reporting issues.
  - `id` (uuid, primary key) - Unique identifier
  - `reason` (text, unique) - The problem reason text
  - `is_active` (boolean) - Whether this reason is currently available
  - `display_order` (integer) - Sort order for display
  - `created_at` (timestamptz) - When the reason was created
  - `updated_at` (timestamptz) - When the reason was last updated

  ### order_problems
  Stores all reported order problems with complete tracking information.
  - `id` (uuid, primary key) - Unique identifier
  - `order_number` (text) - Order number from the original order
  - `sku` (text) - Product SKU with the problem
  - `customer_name` (text) - Customer name for reference
  - `problem_reason` (text) - Selected problem reason
  - `problem_description` (text) - Detailed description of the problem
  - `reported_by` (text) - Name of packer who reported the problem
  - `reported_at` (timestamptz) - When the problem was reported
  - `status` (text) - Current status: 'pending', 'in_progress', 'resolved', 'escalated'
  - `assigned_to` (text, nullable) - Design maker who picked up the problem
  - `picked_up_at` (timestamptz, nullable) - When a design maker started working on it
  - `resolution_description` (text, nullable) - How the problem was resolved
  - `resolved_by` (text, nullable) - Design maker who resolved it
  - `resolved_at` (timestamptz, nullable) - When the problem was resolved
  - `escalated_at` (timestamptz, nullable) - When the problem was escalated
  - `escalation_reason` (text, nullable) - Why it was escalated
  - `google_sheet_row_index` (integer, nullable) - Row index in Google Sheet for syncing
  - `google_sheet_synced_at` (timestamptz, nullable) - Last sync to Google Sheets
  - `created_at` (timestamptz) - Record creation time
  - `updated_at` (timestamptz) - Record update time

  ### order_problem_notifications
  Tracks notifications sent to design makers for real-time updates.
  - `id` (uuid, primary key) - Unique identifier
  - `problem_id` (uuid, foreign key) - References order_problems
  - `recipient_name` (text) - Design maker who should receive notification
  - `notification_type` (text) - Type: 'new_problem', 'escalated', 'resolved'
  - `is_read` (boolean) - Whether the notification has been read
  - `created_at` (timestamptz) - When notification was created

  ## 2. Settings Extension
  Add order problem settings to the existing app_settings table:
  - `problem_escalation_minutes` (integer) - Minutes before escalation (default: 30)
  - `problem_reasons_last_updated` (timestamptz) - Last update to problem reasons

  ## 3. Security
  - Enable RLS on all new tables
  - Allow all operations (trusted single-tenant environment)

  ## 4. Indexes
  Create indexes for common query patterns:
  - Problems by status and date
  - Notifications by recipient and read status
  - Problems by order number for Google Sheets sync

  ## 5. Notes
  - All timestamps use timestamptz for proper timezone handling
  - Status field uses text for flexibility (can add new statuses easily)
  - Google Sheet sync columns will be CC onwards (after CB)
  - Escalation is time-based and configurable
*/

-- Create problem_reasons table
CREATE TABLE IF NOT EXISTS problem_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_problems table
CREATE TABLE IF NOT EXISTS order_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  sku text NOT NULL,
  customer_name text NOT NULL,
  problem_reason text NOT NULL,
  problem_description text NOT NULL,
  reported_by text NOT NULL,
  reported_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
  assigned_to text,
  picked_up_at timestamptz,
  resolution_description text,
  resolved_by text,
  resolved_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  google_sheet_row_index integer,
  google_sheet_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_problem_notifications table
CREATE TABLE IF NOT EXISTS order_problem_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES order_problems(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('new_problem', 'escalated', 'resolved')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add columns to app_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'problem_escalation_minutes'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN problem_escalation_minutes integer DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'problem_reasons_last_updated'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN problem_reasons_last_updated timestamptz;
  END IF;
END $$;

-- Enable RLS on all new tables
ALTER TABLE problem_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_problem_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for trusted environment)
CREATE POLICY "Allow all operations on problem_reasons"
  ON problem_reasons
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on order_problems"
  ON order_problems
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on order_problem_notifications"
  ON order_problem_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_problems_status_reported_at 
  ON order_problems(status, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_problems_order_number 
  ON order_problems(order_number);

CREATE INDEX IF NOT EXISTS idx_order_problems_status_escalated 
  ON order_problems(status, escalated_at) 
  WHERE status IN ('pending', 'escalated');

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON order_problem_notifications(recipient_name, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_problem_id 
  ON order_problem_notifications(problem_id);

-- Add updated_at triggers
CREATE TRIGGER update_problem_reasons_updated_at
  BEFORE UPDATE ON problem_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_problems_updated_at
  BEFORE UPDATE ON order_problems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default problem reasons
INSERT INTO problem_reasons (reason, display_order) VALUES
  ('Missing design file', 1),
  ('Incorrect product specifications', 2),
  ('Design quality issue', 3),
  ('Customer customization unclear', 4),
  ('Product image mismatch', 5)
ON CONFLICT (reason) DO NOTHING;