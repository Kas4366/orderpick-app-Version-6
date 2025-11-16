import { supabase } from '../lib/supabase';
import {
  OrderProblem,
  ProblemReason,
  OrderProblemNotification,
  ReportProblemFormData,
  ResolveProblemFormData,
  ProblemStatus
} from '../types/OrderProblem';
import { googleSheetsService } from './googleSheetsService';

export const orderProblemsService = {
  async getProblemReasons(): Promise<ProblemReason[]> {
    const { data, error } = await supabase
      .from('problem_reasons')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching problem reasons:', error);
      throw new Error('Failed to fetch problem reasons');
    }

    return data || [];
  },

  async createProblemReason(reason: string): Promise<ProblemReason> {
    const { data: existingReasons } = await supabase
      .from('problem_reasons')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existingReasons && existingReasons.length > 0
      ? existingReasons[0].display_order + 1
      : 1;

    const { data, error } = await supabase
      .from('problem_reasons')
      .insert({
        reason,
        is_active: true,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating problem reason:', error);
      throw new Error('Failed to create problem reason');
    }

    await googleSheetsService.saveSettings({
      problem_reasons_last_updated: new Date().toISOString(),
    });

    return data;
  },

  async updateProblemReason(id: string, updates: Partial<ProblemReason>): Promise<void> {
    const { error } = await supabase
      .from('problem_reasons')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating problem reason:', error);
      throw new Error('Failed to update problem reason');
    }

    await googleSheetsService.saveSettings({
      problem_reasons_last_updated: new Date().toISOString(),
    });
  },

  async deleteProblemReason(id: string): Promise<void> {
    const { error } = await supabase
      .from('problem_reasons')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting problem reason:', error);
      throw new Error('Failed to delete problem reason');
    }

    await googleSheetsService.saveSettings({
      problem_reasons_last_updated: new Date().toISOString(),
    });
  },

  async reportProblem(
    orderNumber: string,
    sku: string,
    customerName: string,
    reportedBy: string,
    formData: ReportProblemFormData,
    googleSheetRowIndex?: number
  ): Promise<OrderProblem> {
    const { data: problem, error: problemError } = await supabase
      .from('order_problems')
      .insert({
        order_number: orderNumber,
        sku,
        customer_name: customerName,
        problem_reason: formData.problem_reason,
        problem_description: formData.problem_description,
        reported_by: reportedBy,
        status: 'pending',
        google_sheet_row_index: googleSheetRowIndex,
      })
      .select()
      .single();

    if (problemError) {
      console.error('Error reporting problem:', problemError);
      throw new Error('Failed to report problem');
    }

    await this.notifyAllEmployees(problem.id, 'new_problem', reportedBy);

    await this.syncProblemToGoogleSheet(problem.id);

    return problem;
  },

  async getAllProblems(): Promise<OrderProblem[]> {
    const { data, error } = await supabase
      .from('order_problems')
      .select('*')
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('Error fetching problems:', error);
      throw new Error('Failed to fetch problems');
    }

    return data || [];
  },

  async getProblemsForOrders(orderNumbers: string[], skus: string[]): Promise<Map<string, OrderProblem>> {
    if (orderNumbers.length === 0 || skus.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('order_problems')
      .select('*')
      .in('order_number', orderNumbers)
      .in('sku', skus)
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('Error fetching problems for orders:', error);
      throw new Error('Failed to fetch problems for orders');
    }

    const problemsMap = new Map<string, OrderProblem>();

    if (data) {
      data.forEach(problem => {
        const key = `${problem.order_number}-${problem.sku}`;
        if (!problemsMap.has(key)) {
          problemsMap.set(key, problem);
        }
      });
    }

    return problemsMap;
  },

  async getProblemsByStatus(status: ProblemStatus): Promise<OrderProblem[]> {
    const { data, error } = await supabase
      .from('order_problems')
      .select('*')
      .eq('status', status)
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('Error fetching problems by status:', error);
      throw new Error('Failed to fetch problems');
    }

    return data || [];
  },

  async pickUpProblem(problemId: string, designMakerName: string): Promise<void> {
    const { error } = await supabase
      .from('order_problems')
      .update({
        status: 'in_progress',
        assigned_to: designMakerName,
        picked_up_at: new Date().toISOString(),
      })
      .eq('id', problemId);

    if (error) {
      console.error('Error picking up problem:', error);
      throw new Error('Failed to pick up problem');
    }

    await this.syncProblemToGoogleSheet(problemId);
  },

  async resolveProblem(
    problemId: string,
    resolvedBy: string,
    formData: ResolveProblemFormData
  ): Promise<void> {
    const { error } = await supabase
      .from('order_problems')
      .update({
        status: 'resolved',
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_description: formData.resolution_description,
      })
      .eq('id', problemId);

    if (error) {
      console.error('Error resolving problem:', error);
      throw new Error('Failed to resolve problem');
    }

    const { data: problem } = await supabase
      .from('order_problems')
      .select('reported_by')
      .eq('id', problemId)
      .single();

    if (problem?.reported_by) {
      await this.createNotification(problemId, problem.reported_by, 'resolved');
    }

    await this.syncProblemToGoogleSheet(problemId);
  },

  async escalateProblem(problemId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('order_problems')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        escalation_reason: reason,
      })
      .eq('id', problemId);

    if (error) {
      console.error('Error escalating problem:', error);
      throw new Error('Failed to escalate problem');
    }

    await this.notifyAllEmployees(problemId, 'escalated');

    await this.syncProblemToGoogleSheet(problemId);
  },

  async checkAndEscalateOverdueProblems(): Promise<void> {
    const settings = await googleSheetsService.getSettings();
    const escalationMinutes = settings?.problem_escalation_minutes || 30;

    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - escalationMinutes);

    const { data: overdueProblems, error } = await supabase
      .from('order_problems')
      .select('id')
      .in('status', ['pending', 'in_progress'])
      .lt('reported_at', cutoffTime.toISOString())
      .is('escalated_at', null);

    if (error) {
      console.error('Error checking overdue problems:', error);
      return;
    }

    if (overdueProblems && overdueProblems.length > 0) {
      for (const problem of overdueProblems) {
        await this.escalateProblem(
          problem.id,
          `Auto-escalated after ${escalationMinutes} minutes`
        );
      }
    }
  },

  async notifyAllEmployees(problemId: string, notificationType: 'new_problem' | 'escalated', excludeEmployeeName?: string): Promise<void> {
    const settings = await googleSheetsService.getSettings();
    if (!settings?.google_sheets_id) {
      console.warn('Cannot notify employees: Google Sheets not connected');
      return;
    }

    const employees = await googleSheetsService.fetchEmployees(settings.google_sheets_id);

    const recipientEmployees = excludeEmployeeName
      ? employees.filter(emp => emp.name !== excludeEmployeeName)
      : employees;

    if (recipientEmployees.length === 0) {
      console.warn('No employees found to notify');
      return;
    }

    const notifications = recipientEmployees.map(emp => ({
      problem_id: problemId,
      recipient_name: emp.name,
      notification_type: notificationType,
      is_read: false,
    }));

    const { error } = await supabase
      .from('order_problem_notifications')
      .insert(notifications);

    if (error) {
      console.error('Error creating notifications:', error);
    }
  },

  async createNotification(
    problemId: string,
    recipientName: string,
    notificationType: 'new_problem' | 'escalated' | 'resolved'
  ): Promise<void> {
    const { error } = await supabase
      .from('order_problem_notifications')
      .insert({
        problem_id: problemId,
        recipient_name: recipientName,
        notification_type: notificationType,
        is_read: false,
      });

    if (error) {
      console.error('Error creating notification:', error);
    }
  },

  async getNotifications(recipientName: string): Promise<OrderProblemNotification[]> {
    const { data, error } = await supabase
      .from('order_problem_notifications')
      .select(`
        *,
        problem:problem_id (*)
      `)
      .eq('recipient_name', recipientName)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }

    return data || [];
  },

  async getUnreadNotificationCount(recipientName: string): Promise<number> {
    const { count, error } = await supabase
      .from('order_problem_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_name', recipientName)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('order_problem_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async markAllNotificationsAsRead(recipientName: string): Promise<void> {
    const { error } = await supabase
      .from('order_problem_notifications')
      .update({ is_read: true })
      .eq('recipient_name', recipientName)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  subscribeToProblems(callback: (problem: OrderProblem) => void) {
    const channel = supabase
      .channel('order_problems_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_problems',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            callback(payload.new as OrderProblem);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToNotifications(recipientName: string, callback: (notification: OrderProblemNotification) => void) {
    const channel = supabase
      .channel('order_problem_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_problem_notifications',
          filter: `recipient_name=eq.${recipientName}`,
        },
        async (payload) => {
          const notificationId = payload.new.id;
          const { data } = await supabase
            .from('order_problem_notifications')
            .select(`
              *,
              problem:problem_id (*)
            `)
            .eq('id', notificationId)
            .single();

          if (data) {
            callback(data as OrderProblemNotification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async syncProblemToGoogleSheet(problemId: string): Promise<void> {
    try {
      console.log(`🔄 Starting Google Sheets sync for problem ${problemId}`);

      const { data: problem, error: problemError } = await supabase
        .from('order_problems')
        .select('*')
        .eq('id', problemId)
        .single();

      if (problemError || !problem) {
        console.error('❌ Error fetching problem for sync:', problemError);
        return;
      }

      if (!problem.google_sheet_row_index) {
        console.warn('⚠️ Problem does not have a Google Sheet row index, skipping sync');
        return;
      }

      const settings = await googleSheetsService.getSettings();
      if (!settings?.google_sheets_id) {
        console.warn('⚠️ Google Sheets not connected, skipping sync');
        return;
      }

      const rowIndex = problem.google_sheet_row_index;

      const problemData = [
        problem.problem_reason || '',
        problem.problem_description || '',
        problem.reported_by || '',
        problem.reported_at || '',
        problem.status || '',
        problem.assigned_to || '',
        problem.picked_up_at || '',
        problem.resolution_description || '',
        problem.resolved_by || '',
        problem.resolved_at || '',
        problem.escalated_at || '',
        problem.escalation_reason || '',
      ];

      console.log(`📊 Syncing to Data!CC${rowIndex}:CN${rowIndex}`);
      console.log('📋 Data to sync:', {
        problemReason: problemData[0],
        problemDescription: problemData[1],
        reportedBy: problemData[2],
        status: problemData[4],
        resolutionDescription: problemData[7],
        resolvedBy: problemData[8],
        resolvedAt: problemData[9],
      });

      await googleSheetsService.writeSheetData(
        settings.google_sheets_id,
        `Data!CC${rowIndex}:CN${rowIndex}`,
        [problemData]
      );

      await supabase
        .from('order_problems')
        .update({ google_sheet_synced_at: new Date().toISOString() })
        .eq('id', problemId);

      console.log(`✅ Successfully synced problem ${problemId} to Google Sheet row ${rowIndex}`);

      if (problem.status === 'resolved') {
        console.log(`✅ Resolution data synced: "${problem.resolution_description}" by ${problem.resolved_by} at ${problem.resolved_at}`);
      }
    } catch (error) {
      console.error('❌ Error syncing problem to Google Sheet:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
    }
  },
};
