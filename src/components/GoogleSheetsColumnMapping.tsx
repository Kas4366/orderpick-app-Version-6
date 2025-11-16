import React, { useState, useEffect } from 'react';
import { Map, Save, AlertCircle, CheckCircle, RefreshCw, Hash, Image, Package, DollarSign, Store, Truck, Calendar } from 'lucide-react';
import { CsvColumnMapping, CsvField, defaultCsvColumnMapping } from '../types/Csv';
import { googleSheetsService } from '../services/googleSheetsService';

interface GoogleSheetsColumnMappingProps {
  sheetId: string;
  onSaveMappings: (mappings: CsvColumnMapping) => void;
  savedMappings?: CsvColumnMapping;
}

export const GoogleSheetsColumnMapping: React.FC<GoogleSheetsColumnMappingProps> = ({
  sheetId,
  onSaveMappings,
  savedMappings,
}) => {
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [currentMappings, setCurrentMappings] = useState<CsvColumnMapping>(savedMappings || defaultCsvColumnMapping);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mappableFields: { key: CsvField; label: string; required: boolean; icon?: React.ReactNode; description?: string }[] = [
    { key: 'orderNumber', label: 'Order Number/ID', required: true, icon: <Hash className="h-4 w-4" />, description: 'Unique identifier for the order' },
    { key: 'customerFirstName', label: 'Customer First Name', required: true, description: 'Customer\'s first name' },
    { key: 'customerLastName', label: 'Customer Last Name', required: true, description: 'Customer\'s last name' },
    { key: 'sku', label: 'SKU', required: true, description: 'Product SKU or item code' },
    { key: 'quantity', label: 'Quantity', required: true, description: 'Number of items ordered' },
    { key: 'fileDate', label: 'Downloaded Date', required: true, icon: <Calendar className="h-4 w-4" />, description: 'Date when orders were downloaded to Google Sheets (required for date filtering)' },
    { key: 'orderDate', label: 'Order Created Date', required: false, icon: <Calendar className="h-4 w-4" />, description: 'Original order creation date (fallback for date filtering)' },
    { key: 'location', label: 'Location', required: false, description: 'Warehouse location or bin' },
    { key: 'buyerPostcode', label: 'Buyer Postcode', required: false, description: 'Customer\'s postcode for QR matching' },
    { key: 'remainingStock', label: 'Remaining Stock', required: false, icon: <Package className="h-4 w-4" />, description: 'Current stock level' },
    { key: 'orderValue', label: 'Order Value', required: false, icon: <DollarSign className="h-4 w-4" />, description: 'Monetary value of the order' },
    { key: 'channelType', label: 'Channel Type', required: false, icon: <Store className="h-4 w-4" />, description: 'Sales channel (e.g., eBay, Amazon)' },
    { key: 'channel', label: 'Channel', required: false, icon: <Store className="h-4 w-4" />, description: 'Specific channel information' },
    { key: 'width', label: 'Width (cm)', required: false, icon: <Package className="h-4 w-4" />, description: 'Product width (for packaging rules)' },
    { key: 'weight', label: 'Weight (g)', required: false, icon: <Package className="h-4 w-4" />, description: 'Product weight (for packaging rules)' },
    { key: 'itemName', label: 'Item/Product Name', required: false, description: 'Product or item name/title' },
    { key: 'shipFromLocation', label: 'Ship From Location', required: false, icon: <Truck className="h-4 w-4" />, description: 'Location where the order ships from' },
    { key: 'packageDimension', label: 'Package Dimension', required: false, icon: <Package className="h-4 w-4" />, description: 'Package size information' },
    { key: 'notes', label: 'Notes', required: false, description: 'Special instructions for this order' },
  ];

  useEffect(() => {
    if (savedMappings) {
      setCurrentMappings(savedMappings);
    }
  }, [savedMappings]);

  const fetchHeaders = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const headers = await googleSheetsService.fetchHeaders(sheetId);
      setSheetHeaders(headers);
      setMessage({
        type: 'success',
        text: `Successfully detected ${headers.length} columns from your Google Sheet. You can now map them below.`
      });
    } catch (error) {
      console.error('Error fetching headers:', error);
      setMessage({
        type: 'error',
        text: `Failed to fetch headers from Google Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoMap = () => {
    const newMappings: CsvColumnMapping = { ...currentMappings };
    let mappedCount = 0;

    const headerVariations: { [key: string]: string[] } = {
      orderNumber: ['number', 'order number', 'order id', 'order_number', 'order_id', 'ordernumber'],
      customerFirstName: ['billing_address_first_name', 'shipping_address_first_name', 'first name', 'firstname', 'first_name'],
      customerLastName: ['billing_address_last_name', 'shipping_address_last_name', 'last name', 'lastname', 'last_name'],
      sku: ['sku', 'product code', 'item code', 'product_code', 'item_code'],
      quantity: ['quantity', 'qty', 'amount', 'count'],
      fileDate: ['downloaded date', 'downloaded_date', 'file date', 'file_date', 'download date', 'download_date'],
      orderDate: ['created_at', 'created at', 'order date', 'order_date', 'date created', 'date_created'],
      location: ['bin_location', 'location', 'warehouse location', 'bin'],
      buyerPostcode: ['billing_address_zip', 'shipping_address_zip', 'postcode', 'postal code', 'zip code'],
      remainingStock: ['remaining stock', 'remaining_stock', 'stock', 'stock level'],
      orderValue: ['order value', 'order_value', 'value', 'price', 'total'],
      channelType: ['channel type', 'channel_type', 'sales channel', 'marketplace'],
      channel: ['channel', 'sales channel name', 'marketplace name'],
      itemName: ['product name', 'product_name', 'item name', 'item_name', 'title'],
      notes: ['notes', 'note', 'special instructions', 'order notes'],
    };

    mappableFields.forEach(field => {
      const variations = headerVariations[field.key] || [field.key];
      let matchedHeader = '';

      for (const variation of variations) {
        const exactMatch = sheetHeaders.find(h => h.toLowerCase().trim() === variation.toLowerCase());
        if (exactMatch) {
          matchedHeader = exactMatch;
          break;
        }

        const partialMatch = sheetHeaders.find(h => {
          const headerLower = h.toLowerCase().trim();
          const variationLower = variation.toLowerCase();
          return headerLower.includes(variationLower) || variationLower.includes(headerLower);
        });

        if (partialMatch) {
          matchedHeader = partialMatch;
          break;
        }
      }

      if (matchedHeader) {
        newMappings[field.key] = matchedHeader;
        mappedCount++;
      }
    });

    setCurrentMappings(newMappings);
    setMessage({
      type: mappedCount > 0 ? 'success' : 'error',
      text: `Auto-mapping completed! Mapped ${mappedCount} out of ${mappableFields.length} fields. Please verify and adjust as needed.`
    });
  };

  const handleMappingChange = (field: CsvField, header: string) => {
    setCurrentMappings(prev => ({ ...prev, [field]: header }));
  };

  const handleSaveMappings = async () => {
    const missingMappings = mappableFields.filter(
      field => field.required && (!currentMappings[field.key] || currentMappings[field.key].trim() === '')
    );

    if (missingMappings.length > 0) {
      setMessage({
        type: 'error',
        text: `Please map all required fields: ${missingMappings.map(m => m.label).join(', ')}`
      });
      return;
    }

    try {
      await googleSheetsService.saveColumnMapping(currentMappings);
      onSaveMappings(currentMappings);
      setMessage({
        type: 'success',
        text: 'Column mappings saved successfully! These will be used when loading orders from Google Sheets.'
      });
    } catch (error) {
      console.error('Error saving mappings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save column mappings. Please try again.'
      });
    }
  };

  const handleResetToDefault = () => {
    setCurrentMappings(defaultCsvColumnMapping);
    setMessage({ type: 'success', text: 'Column mappings reset to default values.' });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-2">Column Mapping Configuration</h4>
        <p className="text-sm text-gray-600">
          Map your Google Sheets columns to the app's order fields. This only needs to be configured once.
        </p>
      </div>

      {message && (
        <div className={`border rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={fetchHeaders}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Detect Columns'}
        </button>

        {sheetHeaders.length > 0 && (
          <>
            <button
              onClick={handleAutoMap}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Map className="w-4 h-4" />
              Auto-Map
            </button>
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Reset to Default
            </button>
          </>
        )}
      </div>

      {sheetHeaders.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h5 className="text-sm font-medium text-gray-700 mb-3">
            Detected Columns ({sheetHeaders.length})
          </h5>
          <div className="text-xs text-gray-600 max-h-24 overflow-y-auto">
            {sheetHeaders.join(', ')}
          </div>
        </div>
      )}

      {sheetHeaders.length > 0 && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-gray-700 mb-3">Map Your Columns</h5>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mappableFields.map(field => (
                <div key={field.key} className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {field.icon}
                      <label className="text-sm font-medium text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-600 ml-1">*</span>}
                      </label>
                    </div>
                    {field.description && (
                      <p className="text-xs text-gray-500 mb-2">{field.description}</p>
                    )}
                    <select
                      value={currentMappings[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {sheetHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveMappings}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Column Mappings
          </button>
        </div>
      )}
    </div>
  );
};
