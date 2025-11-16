import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, Download, Upload, AlertTriangle, FileText, Package, Trash2, RefreshCw, Sheet } from 'lucide-react';
import { archiveService } from '../services/archiveService';
import { packingInstructionService } from '../services/packingInstructionService';
import { googleSheetsService } from '../services/googleSheetsService';
import { PackingInstruction } from '../types/PackingInstructions';

interface OtherSettingsProps {
  autoCompleteEnabled: boolean;
  onSaveSettings: (settings: { autoCompleteEnabled: boolean }) => void;
}

export const OtherSettings: React.FC<OtherSettingsProps> = ({
  autoCompleteEnabled,
  onSaveSettings,
}) => {
  const [settings, setSettings] = useState({
    autoCompleteEnabled: autoCompleteEnabled
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingInstructions, setIsSyncingInstructions] = useState(false);
  const [instructionsStats, setInstructionsStats] = useState<{ totalInstructions: number; lastUpdated: string } | null>(null);
  const [googleSheetsConnected, setGoogleSheetsConnected] = useState(false);
  const [googleSheetsId, setGoogleSheetsId] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('never_synced');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings({ autoCompleteEnabled });
    loadInstructionsStats();
    loadGoogleSheetsStatus();
  }, [autoCompleteEnabled]);

  const loadInstructionsStats = async () => {
    try {
      await packingInstructionService.init();
      const stats = await packingInstructionService.getStats();
      setInstructionsStats(stats);
    } catch (error) {
      console.error('Failed to load packing instructions stats:', error);
    }
  };

  const loadGoogleSheetsStatus = async () => {
    try {
      const appSettings = await googleSheetsService.getSettings();
      if (appSettings) {
        setGoogleSheetsConnected(appSettings.connection_status === 'connected');
        setGoogleSheetsId(appSettings.google_sheets_id || null);
        setLastSyncTime(appSettings.packing_instructions_last_sync || '');
        setSyncStatus(appSettings.packing_instructions_sync_status || 'never_synced');
        setSyncErrorMessage(appSettings.packing_instructions_error_message || '');
      }
    } catch (error) {
      console.error('Failed to load Google Sheets status:', error);
    }
  };

  const handleSyncInstructions = async () => {
    if (!googleSheetsId) {
      setMessage({
        type: 'error',
        text: 'Please connect to Google Sheets first in the Google Sheets tab.'
      });
      return;
    }

    try {
      setIsSyncingInstructions(true);
      setMessage(null);

      console.log('🔄 Syncing packing instructions from Google Sheets...');

      const instructions = await googleSheetsService.fetchPackingInstructions(googleSheetsId, 'Packing Instructions');

      if (instructions.length === 0) {
        setMessage({
          type: 'error',
          text: 'No packing instructions found in the "Packing Instructions" tab. Please add instructions to your Google Sheet.'
        });

        await googleSheetsService.saveSettings({
          packing_instructions_sync_status: 'error',
          packing_instructions_error_message: 'No instructions found in tab',
        });

        await loadGoogleSheetsStatus();
        return;
      }

      await packingInstructionService.init();
      const savedCount = await packingInstructionService.syncFromGoogleSheets(instructions);

      await googleSheetsService.saveSettings({
        packing_instructions_last_sync: new Date().toISOString(),
        packing_instructions_sync_status: 'success',
        packing_instructions_error_message: null,
      });

      await loadInstructionsStats();
      await loadGoogleSheetsStatus();

      setMessage({
        type: 'success',
        text: `Successfully synced ${savedCount} packing instructions from Google Sheets!`
      });

    } catch (error) {
      console.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setMessage({
        type: 'error',
        text: `Failed to sync packing instructions: ${errorMessage}`
      });

      await googleSheetsService.saveSettings({
        packing_instructions_sync_status: 'error',
        packing_instructions_error_message: errorMessage,
      });

      await loadGoogleSheetsStatus();
    } finally {
      setIsSyncingInstructions(false);
    }
  };
  const handleSave = () => {
    onSaveSettings(settings);
    setMessage({ type: 'success', text: 'Settings saved successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReset = () => {
    const defaultSettings = { autoCompleteEnabled: false };
    setSettings(defaultSettings);
    onSaveSettings(defaultSettings);
    setMessage({ type: 'success', text: 'Settings reset to defaults!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleExportArchive = async () => {
    try {
      setIsExporting(true);
      setMessage(null);

      // Get all archive data
      await archiveService.init();
      const stats = await archiveService.getArchiveStats();
      
      if (stats.totalOrders === 0) {
        setMessage({ type: 'error', text: 'No archive data to export.' });
        return;
      }

      // Get all orders from archive
      const searchResult = await archiveService.searchArchive(''); // Empty search returns all
      const allOrders = searchResult.orders;

      if (allOrders.length === 0) {
        setMessage({ type: 'error', text: 'No archive data found to export.' });
        return;
      }

      // Create CSV content
      const headers = [
        'Order Number', 'Customer Name', 'SKU', 'Quantity', 'Location', 
        'Buyer Postcode', 'Image URL', 'Item Name', 'Remaining Stock',
        'Order Value', 'File Date', 'File Name', 'Archived At', 'Completed',
        'Channel Type', 'Channel', 'Packaging Type', 'Notes'
      ];

      const csvContent = [
        headers.join(','),
        ...allOrders.map(order => [
          `"${order.orderNumber}"`,
          `"${order.customerName}"`,
          `"${order.sku}"`,
          order.quantity,
          `"${order.location}"`,
          `"${order.buyerPostcode || ''}"`,
          `"${order.imageUrl || ''}"`,
          `"${order.itemName || ''}"`,
          order.remainingStock || '',
          order.orderValue || '',
          order.fileDate || '',
          `"${order.fileName}"`,
          order.archivedAt,
          order.completed ? 'Yes' : 'No',
          `"${order.channelType || ''}"`,
          `"${order.channel || ''}"`,
          `"${order.packagingType || ''}"`,
          `"${order.notes || ''}"`
        ].join(','))
      ].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `orderpick-archive-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: `Successfully exported ${allOrders.length} archived orders!` });
    } catch (error) {
      console.error('Export failed:', error);
      setMessage({ type: 'error', text: 'Failed to export archive data. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportArchive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setMessage(null);

      const text = await file.text();
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        setMessage({ type: 'error', text: 'Invalid CSV file format.' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const dataLines = lines.slice(1).filter(line => line.trim());

      let importedCount = 0;
      const orders = [];

      for (const line of dataLines) {
        if (!line.trim()) continue;

        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        
        if (values.length < headers.length) continue;

        const order = {
          orderNumber: values[0] || '',
          customerName: values[1] || '',
          sku: values[2] || '',
          quantity: parseInt(values[3]) || 1,
          location: values[4] || '',
          buyerPostcode: values[5] || '',
          imageUrl: values[6] || '',
          itemName: values[7] || '',
          remainingStock: values[8] ? parseInt(values[8]) : undefined,
          orderValue: values[9] ? parseFloat(values[9]) : undefined,
          fileDate: values[10] || new Date().toISOString(),
          fileName: values[11] || 'Imported',
          archivedAt: values[12] || new Date().toISOString(),
          completed: values[13] === 'Yes',
          channelType: values[14] || '',
          channel: values[15] || '',
          width: values[16] ? parseFloat(values[16]) : undefined,
          weight: values[17] ? parseFloat(values[17]) : undefined,
          shipFromLocation: values[18] || '',
          packageDimension: values[19] || '',
          notes: values[20] || ''
        };

        orders.push(order);
      }

      if (orders.length === 0) {
        setMessage({ type: 'error', text: 'No valid orders found in the CSV file.' });
        return;
      }

      // Import to archive
      await archiveService.init();
      const archived = await archiveService.archiveOrders(orders, `Imported-${file.name}`);
      
      setMessage({ type: 'success', text: `Successfully imported ${archived} orders to archive!` });
      importedCount = archived;

    } catch (error) {
      console.error('Import failed:', error);
      setMessage({ type: 'error', text: 'Failed to import archive data. Please check the file format.' });
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Other Settings
        </h3>
        <p className="text-gray-600 mb-4">
          Additional application settings and archive management options.
        </p>
      </div>

      {/* Auto-Complete Setting */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-blue-800 mb-3">Auto-Complete Orders</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-700 text-sm mb-1">
              Automatically mark orders as completed when scanned or searched
            </p>
            <p className="text-blue-600 text-xs">
              When enabled, scanning a QR code or searching for an order will automatically mark it as completed.
              This works with all order sources (HTML, CSV, Selro, Veeqo).
            </p>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, autoCompleteEnabled: !prev.autoCompleteEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoCompleteEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoCompleteEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {settings.autoCompleteEnabled && (
          <div className="mt-3 p-2 bg-blue-100 rounded">
            <p className="text-xs text-blue-800 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Auto-complete is enabled - orders will be marked as completed automatically
            </p>
          </div>
        )}
      </div>

      {/* Packing Instructions from Google Sheets */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-purple-800 mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Packing Instructions from Google Sheets
        </h4>
        <p className="text-purple-700 text-sm mb-4">
          Sync packing instructions from the "Packing Instructions" tab in your connected Google Sheet. Column A should contain SKUs, Column B should contain instructions.
        </p>

        {/* Connection Status */}
        <div className={`border rounded-lg p-3 mb-4 ${
          googleSheetsConnected ? 'bg-green-100 border-green-300' : 'bg-yellow-100 border-yellow-300'
        }`}>
          <div className="flex items-center gap-2">
            <Sheet className="h-4 w-4" />
            <p className={`text-sm font-medium ${
              googleSheetsConnected ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {googleSheetsConnected ? '✓ Google Sheets Connected' : '⚠️ Google Sheets Not Connected'}
            </p>
          </div>
          {!googleSheetsConnected && (
            <p className="text-xs text-yellow-700 mt-1">
              Please connect to Google Sheets in the Google Sheets tab first.
            </p>
          )}
        </div>

        {/* Current Instructions Info */}
        {instructionsStats && instructionsStats.totalInstructions > 0 && (
          <div className="bg-purple-100 border border-purple-300 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-purple-800">
                  📋 {instructionsStats.totalInstructions} instructions loaded
                </p>
                {lastSyncTime && (
                  <p className="text-xs text-purple-600">
                    Last synced: {new Date(lastSyncTime).toLocaleString('en-GB')}
                  </p>
                )}
                {syncStatus === 'success' && (
                  <p className="text-xs text-green-700 flex items-center gap-1 mt-1">
                    <CheckCircle className="h-3 w-3" />
                    Sync successful
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sync Error Display */}
        {syncStatus === 'error' && syncErrorMessage && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Sync Error</p>
                <p className="text-xs text-red-700 mt-1">{syncErrorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div className="space-y-3">
          <button
            onClick={handleSyncInstructions}
            disabled={!googleSheetsConnected || isSyncingInstructions}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncingInstructions ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Syncing from Google Sheets...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sync Instructions from Google Sheets
              </>
            )}
          </button>
          <p className="text-xs text-purple-600 text-center">
            Syncs automatically when loading orders • Click to sync manually
          </p>
        </div>

        <div className="mt-4 p-3 bg-purple-100 border border-purple-200 rounded">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-purple-800">
              <p className="font-medium mb-1">Google Sheet Format Requirements:</p>
              <div className="bg-white rounded border p-2 font-mono text-xs mb-2">
                <div className="text-gray-600 mb-1">Tab Name: "Packing Instructions"</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-gray-600">Column A (SKU)</div>
                    <div className="text-gray-800">ABC123</div>
                    <div className="text-gray-800">XYZ456</div>
                    <div className="text-gray-800">DEF789</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Column B (Instruction)</div>
                    <div className="text-gray-800">Handle with care - fragile</div>
                    <div className="text-gray-800">Pack in bubble wrap</div>
                    <div className="text-gray-800">Include assembly guide</div>
                  </div>
                </div>
              </div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Create a tab named "Packing Instructions" in your Google Sheet</li>
                <li>Column A: SKU (must match exactly with order SKUs)</li>
                <li>Column B: Packing instruction text</li>
                <li>Instructions pop up automatically when matching SKUs are processed</li>
                <li>No header row needed - start from Row 1 with your first SKU</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Import/Export */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Archive Data Management</h4>
        <p className="text-gray-600 text-sm mb-4">
          Export your archive data for backup or import previously exported archive data.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-700">Export Archive</h5>
            <p className="text-xs text-gray-600">
              Download all archived orders as a CSV file for backup or analysis.
            </p>
            <button
              onClick={handleExportArchive}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Archive
                </>
              )}
            </button>
          </div>

          {/* Import */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-700">Import Archive</h5>
            <p className="text-xs text-gray-600">
              Import previously exported archive data back into the system.
            </p>
            <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import Archive
                </>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={handleImportArchive}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-800">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Export creates a CSV file with all archived order data</li>
                <li>Import will add data to existing archive (no duplicates)</li>
                <li>Use export regularly to backup your order history</li>
                <li>Imported data will be searchable in the archive</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Default
        </button>
        
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Current Settings Summary */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Current Settings:</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Auto-Complete:</strong> {settings.autoCompleteEnabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
    </div>
  );
};