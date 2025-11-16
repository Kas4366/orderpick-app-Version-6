export type ProblemStatus = 'pending' | 'in_progress' | 'resolved' | 'escalated';
export type NotificationType = 'new_problem' | 'escalated' | 'resolved';

export interface ProblemReason {
  id: string;
  reason: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderProblem {
  id: string;
  order_number: string;
  sku: string;
  customer_name: string;
  problem_reason: string;
  problem_description: string;
  reported_by: string;
  reported_at: string;
  status: ProblemStatus;
  assigned_to?: string;
  picked_up_at?: string;
  resolution_description?: string;
  resolved_by?: string;
  resolved_at?: string;
  escalated_at?: string;
  escalation_reason?: string;
  google_sheet_row_index?: number;
  google_sheet_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderProblemNotification {
  id: string;
  problem_id: string;
  recipient_name: string;
  notification_type: NotificationType;
  is_read: boolean;
  created_at: string;
  problem?: OrderProblem;
}

export interface ReportProblemFormData {
  problem_reason: string;
  problem_description: string;
}

export interface ResolveProblemFormData {
  resolution_description: string;
}
