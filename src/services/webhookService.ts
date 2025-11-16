import { googleSheetsService } from './googleSheetsService';

interface PackerInfoPayload {
  rowIndex: number;
  packerName: string;
  packedTime: string;
  secretKey?: string;
}

interface ReorderInfoPayload {
  rowIndex: number;
  reorderTime: string;
  secretKey?: string;
}

interface WebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-webhook-proxy`;

export const webhookService = {
  async sendPackerInfo(
    rowIndex: number,
    packerName: string,
    packedTime: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const settings = await googleSheetsService.getSettings();

      if (!settings) {
        console.warn('⚠️ No app settings found');
        return { success: false, message: 'Settings not configured' };
      }

      if (!settings.webhook_enabled) {
        console.log('ℹ️ Webhook is disabled, skipping packer info update');
        return { success: false, message: 'Webhook disabled' };
      }

      if (!settings.apps_script_webhook_url) {
        console.warn('⚠️ Webhook URL not configured');
        return { success: false, message: 'Webhook URL not configured' };
      }

      console.log(`📤 Sending packer info via proxy for row ${rowIndex}...`);

      const payload: PackerInfoPayload = {
        rowIndex,
        packerName,
        packedTime,
      };

      if (settings.apps_script_secret_key) {
        payload.secretKey = settings.apps_script_secret_key;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            appsScriptUrl: settings.apps_script_webhook_url,
            payload,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Webhook proxy request failed with status ${response.status}:`, errorText);
          return {
            success: false,
            message: `Webhook error: ${response.status} ${response.statusText}`,
          };
        }

        const result: WebhookResponse = await response.json();

        if (result.success) {
          console.log(`✅ Successfully sent packer info for row ${rowIndex}`);
          return { success: true, message: result.message };
        } else {
          console.error('❌ Webhook returned error:', result.error || result.message);
          return {
            success: false,
            message: result.error || result.message || 'Unknown webhook error',
          };
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error('❌ Webhook request timed out after 15 seconds');
          return { success: false, message: 'Request timeout' };
        }

        console.error('❌ Network error during webhook request:', fetchError);
        return { success: false, message: `Network error: ${fetchError.message}` };
      }
    } catch (error: any) {
      console.error('❌ Error in sendPackerInfo:', error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  },

  async testWebhookConnection(
    webhookUrl: string,
    secretKey?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Testing webhook connection via proxy...');

      const testPayload: PackerInfoPayload = {
        rowIndex: 0,
        packerName: 'TEST',
        packedTime: new Date().toLocaleString(),
      };

      if (secretKey) {
        testPayload.secretKey = secretKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            appsScriptUrl: webhookUrl,
            payload: testPayload,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Test webhook failed with status ${response.status}:`, errorText);
          return {
            success: false,
            message: `Connection failed: ${response.status} ${response.statusText}`,
          };
        }

        const result: WebhookResponse = await response.json();

        if (result.success) {
          console.log('✅ Webhook connection test successful via proxy');
          await this.saveTestResult(true, 'Connection successful');
          return { success: true, message: 'Connection successful' };
        } else {
          console.error('❌ Webhook test returned error:', result.error || result.message);
          await this.saveTestResult(false, result.error || result.message || 'Unknown error');
          return {
            success: false,
            message: result.error || result.message || 'Unknown error',
          };
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error('❌ Webhook test timed out after 15 seconds');
          await this.saveTestResult(false, 'Request timeout');
          return { success: false, message: 'Connection timeout (15s)' };
        }

        console.error('❌ Network error during webhook test:', fetchError);
        await this.saveTestResult(false, `Network error: ${fetchError.message}`);
        return { success: false, message: `Network error: ${fetchError.message}` };
      }
    } catch (error: any) {
      console.error('❌ Error in testWebhookConnection:', error);
      await this.saveTestResult(false, error.message || 'Unknown error');
      return { success: false, message: error.message || 'Unknown error' };
    }
  },

  async saveTestResult(success: boolean, message: string): Promise<void> {
    try {
      await googleSheetsService.saveSettings({
        last_webhook_test_time: new Date().toISOString(),
        last_webhook_test_status: success ? 'success' : `error: ${message}`,
      });
    } catch (error) {
      console.error('Failed to save webhook test result:', error);
    }
  },

  async sendReorderInfo(
    rowIndex: number,
    reorderTime: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const settings = await googleSheetsService.getSettings();

      if (!settings) {
        console.warn('⚠️ No app settings found');
        return { success: false, message: 'Settings not configured' };
      }

      if (!settings.webhook_enabled) {
        console.log('ℹ️ Webhook is disabled, skipping reorder info update');
        return { success: false, message: 'Webhook disabled' };
      }

      if (!settings.apps_script_webhook_url) {
        console.warn('⚠️ Webhook URL not configured');
        return { success: false, message: 'Webhook URL not configured' };
      }

      console.log(`📤 Sending reorder info via proxy for row ${rowIndex}...`);

      const payload: ReorderInfoPayload = {
        rowIndex,
        reorderTime,
      };

      if (settings.apps_script_secret_key) {
        payload.secretKey = settings.apps_script_secret_key;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            appsScriptUrl: settings.apps_script_webhook_url,
            payload,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Reorder webhook proxy request failed with status ${response.status}:`, errorText);
          return {
            success: false,
            message: `Webhook error: ${response.status} ${response.statusText}`,
          };
        }

        const result: WebhookResponse = await response.json();

        if (result.success) {
          console.log(`✅ Successfully sent reorder info for row ${rowIndex}`);
          return { success: true, message: result.message };
        } else {
          console.error('❌ Webhook returned error:', result.error || result.message);
          return {
            success: false,
            message: result.error || result.message || 'Unknown webhook error',
          };
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error('❌ Reorder webhook request timed out after 15 seconds');
          return { success: false, message: 'Request timeout' };
        }

        console.error('❌ Network error during reorder webhook request:', fetchError);
        return { success: false, message: `Network error: ${fetchError.message}` };
      }
    } catch (error: any) {
      console.error('❌ Error in sendReorderInfo:', error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  },
};
