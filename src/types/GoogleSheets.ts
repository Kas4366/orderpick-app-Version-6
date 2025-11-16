export interface GoogleAuthToken {
  id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  google_sheets_url: string | null;
  google_sheets_id: string | null;
  connection_status: 'connected' | 'disconnected';
  last_sync_time: string | null;
  last_employee_sync_time: string | null;
  selected_date: string | null;
  google_sheets_column_mapping: { [key: string]: string } | null;
  auto_refresh_enabled: boolean | null;
  apps_script_webhook_url: string | null;
  apps_script_secret_key: string | null;
  webhook_enabled: boolean | null;
  last_webhook_test_time: string | null;
  last_webhook_test_status: string | null;
  packing_instructions_tab_name: string | null;
  packing_instructions_last_sync: string | null;
  packing_instructions_sync_status: string | null;
  packing_instructions_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleSheetsConnectionInfo {
  sheetName: string;
  tabNames: string[];
  rowCount: number;
}

export interface GoogleSheetsRefreshResult {
  newOrdersCount: number;
  totalOrdersCount: number;
  newOrders: any[];
}
