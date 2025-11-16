import React, { useState, useEffect } from 'react';
import { Link, CheckCircle, XCircle, RefreshCw, AlertCircle, Calendar, Download, ChevronDown, ChevronUp, Webhook } from 'lucide-react';
import { googleSheetsService } from '../services/googleSheetsService';
import { GoogleSheetsConnectionInfo } from '../types/GoogleSheets';
import { GoogleSheetsColumnMapping } from './GoogleSheetsColumnMapping';
import { CsvColumnMapping } from '../types/Csv';
import { dateUtils } from '../utils/dateUtils';
import { webhookService } from '../services/webhookService';

interface GoogleSheetSettingsProps {
  onLoadOrders?: (selectedDate: string) => void;
}

export const GoogleSheetsSettings: React.FC<GoogleSheetSettingsProps> = ({ onLoadOrders }) => {
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<GoogleSheetsConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<CsvColumnMapping | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecretKey, setWebhookSecretKey] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await googleSheetsService.getSettings();
      if (settings?.google_sheets_url) {
        setSheetsUrl(settings.google_sheets_url);
        if (settings.connection_status === 'connected') {
          setIsConnected(true);
          if (settings.google_sheets_id) {
            await fetchAvailableDates(settings.google_sheets_id);
          }
        }
        if (settings.last_sync_time) {
          setLastSyncTime(new Date(settings.last_sync_time));
        }
        if (settings.selected_date) {
          setSelectedDate(settings.selected_date);
        }
        if (settings.auto_refresh_enabled !== undefined) {
          setAutoRefreshEnabled(settings.auto_refresh_enabled);
        }
        if (settings.google_sheets_column_mapping) {
          setColumnMapping(settings.google_sheets_column_mapping as CsvColumnMapping);
        }
        if (settings.apps_script_webhook_url) {
          setWebhookUrl(settings.apps_script_webhook_url);
        }
        if (settings.apps_script_secret_key) {
          setWebhookSecretKey(settings.apps_script_secret_key);
        }
        if (settings.webhook_enabled !== undefined) {
          setWebhookEnabled(settings.webhook_enabled);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveColumnMapping = (mapping: CsvColumnMapping) => {
    setColumnMapping(mapping);
    console.log('Column mapping saved:', mapping);
  };

  const fetchAvailableDates = async (sheetId: string) => {
    setIsLoadingDates(true);
    try {
      const dates = await googleSheetsService.fetchAvailableDates(sheetId);
      setAvailableDates(dates);
      if (dates.length > 0 && !selectedDate) {
        setSelectedDate(dates[0]);
      }
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
      setError('Failed to fetch available dates from sheet');
    } finally {
      setIsLoadingDates(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setError(null);

    if (!sheetsUrl.trim()) {
      setError('Please enter a Google Sheets URL');
      setIsTesting(false);
      return;
    }

    const sheetId = googleSheetsService.extractSheetId(sheetsUrl);
    if (!sheetId) {
      setError('Invalid Google Sheets URL. Please enter a valid URL.');
      setIsTesting(false);
      return;
    }

    try {
      const info = await googleSheetsService.getSheetInfo(sheetId);
      setConnectionInfo(info);

      await googleSheetsService.saveSettings({
        google_sheets_url: sheetsUrl,
        google_sheets_id: sheetId,
        connection_status: 'connected',
        last_sync_time: new Date().toISOString(),
      });

      setIsConnected(true);
      setLastSyncTime(new Date());

      await fetchAvailableDates(sheetId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test connection';
      setError(errorMessage);
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadOrders = async () => {
    if (!selectedDate) {
      setError('Please select a date first');
      return;
    }

    setIsLoadingOrders(true);
    setError(null);

    try {
      const isoDate = dateUtils.toISOFormat(selectedDate);

      if (!isoDate) {
        throw new Error(`Invalid date format: ${selectedDate}`);
      }

      console.log(`📅 Saving date to database: ${isoDate} (from ${selectedDate})`);

      await googleSheetsService.saveSettings({
        selected_date: isoDate,
        last_sync_time: new Date().toISOString(),
      });

      setLastSyncTime(new Date());

      if (onLoadOrders) {
        onLoadOrders(selectedDate);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      setError(errorMessage);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleAutoRefreshToggle = async (enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    try {
      await googleSheetsService.saveSettings({
        auto_refresh_enabled: enabled,
      });
    } catch (err) {
      console.error('Failed to save auto-refresh setting:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await googleSheetsService.saveSettings({
        connection_status: 'disconnected',
      });

      setIsConnected(false);
      setConnectionInfo(null);
      setError(null);
      setSheetsUrl('');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      await googleSheetsService.saveSettings({
        apps_script_webhook_url: webhookUrl || null,
        apps_script_secret_key: webhookSecretKey || null,
        webhook_enabled: webhookEnabled,
      });
      setWebhookTestResult({ success: true, message: 'Webhook settings saved successfully' });
      setTimeout(() => setWebhookTestResult(null), 3000);
    } catch (err) {
      console.error('Failed to save webhook settings:', err);
      setWebhookTestResult({ success: false, message: 'Failed to save webhook settings' });
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookTestResult({ success: false, message: 'Please enter a webhook URL' });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const result = await webhookService.testWebhookConnection(
        webhookUrl,
        webhookSecretKey || undefined
      );
      setWebhookTestResult(result);
    } catch (err) {
      setWebhookTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleWebhookEnabledToggle = async (enabled: boolean) => {
    setWebhookEnabled(enabled);
    try {
      await googleSheetsService.saveSettings({
        webhook_enabled: enabled,
      });
    } catch (err) {
      console.error('Failed to save webhook enabled setting:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Google Sheets Integration
        </h3>
        <p className="text-gray-600">
          Connect to your Google Sheet to load orders and track packer information.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Make your Google Sheet publicly accessible (Share &gt; Anyone with the link can view/edit)</li>
          <li>Create a Google Cloud Project and enable Google Sheets API</li>
          <li>Create an API key in Google Cloud Console</li>
          <li>Add VITE_GOOGLE_API_KEY to your .env file</li>
          <li>Enter your Google Sheets URL below and test the connection</li>
        </ol>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="sheets-url" className="block text-sm font-medium text-gray-700 mb-2">
            Google Sheets URL
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="sheets-url"
                type="text"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isConnected}
              />
            </div>
            <button
              onClick={testConnection}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-green-900">Connected</h4>
            </div>

            {connectionInfo && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-800">Sheet Name:</span>
                  <span className="font-medium text-green-900">{connectionInfo.sheetName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Available Tabs:</span>
                  <span className="font-medium text-green-900">{connectionInfo.tabNames.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-800">Total Rows:</span>
                  <span className="font-medium text-green-900">{connectionInfo.rowCount}</span>
                </div>
              </div>
            )}

            {lastSyncTime && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700">
                  Last synced: {lastSyncTime.toLocaleString()}
                </p>
              </div>
            )}

            <button
              onClick={testConnection}
              disabled={isTesting}
              className="mt-3 inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 transition-colors disabled:text-green-400"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testing...' : 'Refresh Connection'}
            </button>
          </div>
        )}

        {isConnected && connectionInfo && (
          <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
            <button
              onClick={() => setShowColumnMapping(!showColumnMapping)}
              className="w-full flex items-center justify-between text-left"
            >
              <h4 className="font-medium text-purple-900 flex items-center gap-2">
                <Link className="w-5 h-5" />
                Column Mapping Configuration
              </h4>
              {showColumnMapping ? (
                <ChevronUp className="w-5 h-5 text-purple-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-purple-600" />
              )}
            </button>

            {showColumnMapping && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <GoogleSheetsColumnMapping
                  sheetId={connectionInfo ? googleSheetsService.extractSheetId(sheetsUrl)! : ''}
                  onSaveMappings={handleSaveColumnMapping}
                  savedMappings={columnMapping || undefined}
                />
              </div>
            )}
          </div>
        )}

        {isConnected && availableDates.length > 0 && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
            <h4 className="font-medium text-blue-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Load Orders by Date
            </h4>

            <div>
              <label htmlFor="date-select" className="block text-sm font-medium text-blue-800 mb-2">
                Select Date
              </label>
              <select
                id="date-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                disabled={isLoadingDates || isLoadingOrders}
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {dateUtils.toDisplayFormat(date)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLoadOrders}
              disabled={isLoadingOrders || !selectedDate}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isLoadingOrders ? 'Loading Orders...' : 'Load Orders'}
            </button>

            <div className="pt-3 border-t border-blue-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">Enable Auto-Refresh</span>
                  <p className="text-xs text-blue-700">Automatically check for new orders every 15 minutes</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-gray-400" />
              <h4 className="font-medium text-gray-700">Not Connected</h4>
            </div>
            <p className="text-sm text-gray-600">
              Enter your Google Sheets URL and click "Test Connection" to get started.
            </p>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
          <button
            onClick={() => setShowWebhookConfig(!showWebhookConfig)}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-medium text-orange-900 flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Packer Info Webhook Configuration
            </h4>
            {showWebhookConfig ? (
              <ChevronUp className="w-5 h-5 text-orange-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-orange-600" />
            )}
          </button>

          <p className="text-sm text-orange-700 mt-2">
            Configure Google Apps Script webhook to write packer information back to your sheet in real-time.
          </p>

          {showWebhookConfig && (
            <div className="mt-4 pt-4 border-t border-orange-200 space-y-4">
              <div className="bg-orange-100 rounded-lg p-3">
                <p className="text-sm text-orange-800 font-medium mb-1">Setup Instructions:</p>
                <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
                  <li>Open your Google Sheet</li>
                  <li>Go to Extensions &gt; Apps Script</li>
                  <li>Copy the Apps Script code from the setup guide</li>
                  <li>Deploy as Web App (Execute as: Me, Who has access: Anyone)</li>
                  <li>Copy the Web App URL (ends with /exec)</li>
                  <li>Paste the URL below and test the connection</li>
                </ol>
                <p className="text-xs text-orange-600 mt-2">
                  Note: The app uses a secure proxy to avoid CORS issues. Your webhook URL is never exposed to the browser.
                </p>
              </div>

              <div>
                <label htmlFor="webhook-url" className="block text-sm font-medium text-orange-800 mb-2">
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="webhook-secret" className="block text-sm font-medium text-orange-800 mb-2">
                  Secret Key (Optional)
                </label>
                <input
                  id="webhook-secret"
                  type="password"
                  value={webhookSecretKey}
                  onChange={(e) => setWebhookSecretKey(e.target.value)}
                  placeholder="Enter a secret key for additional security"
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-orange-600 mt-1">
                  Use the same secret key in your Apps Script for validation
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhookEnabled}
                    onChange={(e) => handleWebhookEnabledToggle(e.target.checked)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-orange-900">Enable Webhook</span>
                </label>
              </div>

              {webhookTestResult && (
                <div className={`rounded-lg p-3 ${
                  webhookTestResult.success
                    ? 'bg-green-100 border border-green-200'
                    : 'bg-red-100 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {webhookTestResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-sm ${
                      webhookTestResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {webhookTestResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !webhookUrl.trim()}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isTestingWebhook ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSaveWebhook}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Sheet Requirements</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Data Tab:</strong> Must contain order data starting from row 2 (row 1 is headers)</p>
          <p><strong>Employees Tab:</strong> Must contain Name (column A) and PIN (column B)</p>
          <p><strong>Columns BZ & CA:</strong> Will be used to write packer name and packed time</p>
        </div>
      </div>
    </div>
  );
};
