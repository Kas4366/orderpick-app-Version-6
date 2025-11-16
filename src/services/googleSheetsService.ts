import { supabase } from '../lib/supabase';
import { Employee } from '../types/Employee';
import { Order } from '../types/Order';
import { AppSettings, GoogleSheetsConnectionInfo } from '../types/GoogleSheets';
import { CsvColumnMapping, defaultCsvColumnMapping } from '../types/Csv';
import { dateUtils } from '../utils/dateUtils';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export const googleSheetsService = {
  extractSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  },

  async fetchSheetData(sheetId: string, range: string): Promise<any[][]> {
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured. Please add VITE_GOOGLE_API_KEY to .env file.');
    }

    const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }

    const data = await response.json();
    return data.values || [];
  },

  async writeSheetData(sheetId: string, range: string, values: any[][]): Promise<void> {
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured. Please add VITE_GOOGLE_API_KEY to .env file.');
    }

    const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to write sheet data: ${response.statusText}`);
    }
  },

  async getSheetInfo(sheetId: string): Promise<GoogleSheetsConnectionInfo> {
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured. Please add VITE_GOOGLE_API_KEY to .env file.');
    }

    const url = `${SHEETS_API_BASE}/${sheetId}?fields=properties.title,sheets.properties.title,sheets.properties.gridProperties.rowCount&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet info: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      sheetName: data.properties.title,
      tabNames: data.sheets.map((sheet: any) => sheet.properties.title),
      rowCount: data.sheets[0]?.properties.gridProperties.rowCount || 0,
    };
  },

  async fetchEmployees(sheetId: string): Promise<Employee[]> {
    const rows = await this.fetchSheetData(sheetId, 'Employees!A2:B');

    return rows
      .filter(row => row.length >= 2 && row[0] && row[1])
      .map(row => ({
        name: row[0].trim(),
        pin: row[1].trim(),
      }));
  },

  async fetchAvailableDates(sheetId: string): Promise<string[]> {
    const rows = await this.fetchSheetData(sheetId, 'Data!A2:A');

    const uniqueDates = new Set<string>();

    rows.forEach(row => {
      if (row && row[0] && row[0].trim()) {
        const rawDate = row[0].trim();
        const normalizedDate = dateUtils.toISOFormat(rawDate);

        if (normalizedDate) {
          uniqueDates.add(normalizedDate);
          console.log(`📅 Normalized date: "${rawDate}" -> "${normalizedDate}"`);
        } else {
          console.warn(`⚠️ Could not parse date: "${rawDate}"`);
        }
      }
    });

    const sortedDates = dateUtils.sortDates(Array.from(uniqueDates), true);

    return sortedDates;
  },

  async fetchOrders(sheetId: string, selectedDate?: string, columnMapping?: CsvColumnMapping | null): Promise<Order[]> {
    const allRows = await this.fetchSheetData(sheetId, 'Data!A1:CA');

    if (allRows.length === 0) {
      console.warn('No data found in Google Sheets');
      return [];
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);
    console.log('📋 Google Sheets headers:', headers);
    console.log('📊 Processing', dataRows.length, 'rows from Google Sheets');

    const mapping = columnMapping || defaultCsvColumnMapping;
    console.log('📍 Using column mapping:', mapping);

    const columnIndices: { [key: string]: number } = {};
    for (const fieldKey in mapping) {
      const csvColumnHeader = mapping[fieldKey];
      if (csvColumnHeader && csvColumnHeader.trim() !== '') {
        const headerIndex = headers.findIndex(h => h && h.toLowerCase().trim() === csvColumnHeader.toLowerCase().trim());
        if (headerIndex !== -1) {
          columnIndices[fieldKey] = headerIndex;
          console.log(`📍 Mapped ${fieldKey} to column index ${headerIndex} (${csvColumnHeader})`);
        } else {
          console.warn(`⚠️ Column "${csvColumnHeader}" not found for field "${fieldKey}"`);
        }
      }
    }

    const orders: Order[] = [];
    const fileDate = new Date().toISOString();

    console.log('🔍 Date Filtering Configuration:');
    console.log(`  📅 Selected Date: ${selectedDate || 'None (loading all orders)'}`);
    console.log(`  📋 fileDate column mapped: ${columnIndices['fileDate'] !== undefined ? 'Yes (index ' + columnIndices['fileDate'] + ')' : 'No'}`);
    console.log(`  📋 orderDate column mapped: ${columnIndices['orderDate'] !== undefined ? 'Yes (index ' + columnIndices['orderDate'] + ')' : 'No'}`);

    let filteredCount = 0;
    let skippedDueToDate = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      const extractValue = (fieldKey: string): string => {
        const columnIndex = columnIndices[fieldKey];
        if (columnIndex !== undefined && columnIndex < row.length) {
          const value = row[columnIndex]?.toString().trim() || '';
          return value;
        }
        return '';
      };

      const downloadedDate = extractValue('fileDate') || extractValue('orderDate');

      if (selectedDate) {
        if (!downloadedDate) {
          if (i < 3) {
            console.log(`⚠️ Row ${i + 2}: No date found, skipping (fileDate: "${extractValue('fileDate')}", orderDate: "${extractValue('orderDate')}")`);
          }
          skippedDueToDate++;
          continue;
        }

        const normalizedDownloadedDate = dateUtils.toISOFormat(downloadedDate);
        const normalizedSelectedDate = dateUtils.toISOFormat(selectedDate);

        if (i < 3) {
          console.log(`🔍 Row ${i + 2}: Comparing dates - Downloaded: "${downloadedDate}" (normalized: "${normalizedDownloadedDate}") vs Selected: "${normalizedSelectedDate}"`);
        }

        if (normalizedDownloadedDate !== normalizedSelectedDate) {
          if (i < 3) {
            console.log(`  ❌ Date mismatch, skipping row ${i + 2}`);
          }
          skippedDueToDate++;
          continue;
        }

        if (i < 3) {
          console.log(`  ✅ Date match! Processing row ${i + 2}`);
        }
      }

      const orderNumber = extractValue('orderNumber') || `Row-${i + 1}`;
      const customerFirstName = extractValue('customerFirstName');
      const customerLastName = extractValue('customerLastName');
      const sku = extractValue('sku');
      const quantityStr = extractValue('quantity');
      const location = extractValue('location');
      const buyerPostcode = extractValue('buyerPostcode');
      const remainingStockStr = extractValue('remainingStock');
      const orderValueStr = extractValue('orderValue');
      const channelType = extractValue('channelType');
      const channel = extractValue('channel');
      const itemName = extractValue('itemName');
      const notes = extractValue('notes');

      const customerName = `${customerFirstName} ${customerLastName}`.trim() || `Customer-${i + 1}`;

      if (!sku) {
        console.warn(`⚠️ Skipping row ${i + 2} - missing SKU`);
        continue;
      }

      const quantity = quantityStr ? Math.max(1, parseInt(quantityStr, 10) || 1) : 1;
      const remainingStock = remainingStockStr ? parseInt(remainingStockStr, 10) : undefined;

      let orderValue: number | undefined = undefined;
      if (orderValueStr) {
        const cleanedValue = orderValueStr
          .replace(/[£$€¥₹₽¢]/g, '')
          .replace(/[,\s]/g, '')
          .replace(/[^\d.-]/g, '');

        if (cleanedValue) {
          const parsedValue = parseFloat(cleanedValue);
          if (!isNaN(parsedValue)) {
            orderValue = parsedValue;
          }
        }
      }

      const order: Order = {
        rowIndex: i + 2,
        orderNumber: orderNumber,
        customerName: customerName,
        sku: sku,
        quantity: quantity,
        location: location || 'Unknown',
        buyerPostcode: buyerPostcode ? buyerPostcode.replace(/\s/g, '') : undefined,
        imageUrl: undefined,
        remainingStock: remainingStock,
        orderValue: orderValue,
        fileDate: fileDate,
        channelType: channelType || undefined,
        channel: channel || undefined,
        itemName: itemName || undefined,
        notes: notes || '',
        completed: false,
      };

      orders.push(order);
      filteredCount++;
      if (filteredCount <= 3) {
        console.log(`✅ Row ${i + 2}: Created order for ${customerName} - ${sku}`);
      }
    }

    console.log('📊 Filtering Summary:');
    console.log(`  📥 Total rows processed: ${dataRows.length}`);
    console.log(`  ❌ Rows skipped due to date filtering: ${skippedDueToDate}`);
    console.log(`  ✅ Orders loaded: ${orders.length}`);

    if (orders.length === 0 && selectedDate && skippedDueToDate > 0) {
      console.warn(`⚠️ WARNING: No orders found for selected date "${selectedDate}".`);
      console.warn('   This could mean:');
      console.warn('   1. No orders exist for this date in your Google Sheet');
      console.warn('   2. The date column mapping may be incorrect');
      console.warn('   3. The date format in your sheet doesn\'t match the selected date');
      console.warn(`   Please verify your "Downloaded Date" column contains orders for ${selectedDate}`);
    }

    console.log(`✅ Successfully loaded ${orders.length} orders from Google Sheets`);
    return orders;
  },

  compareOrders(existingOrders: Order[], newOrders: Order[]): Order[] {
    const existingOrderKeys = new Set(
      existingOrders.map(order => `${order.orderNumber}-${order.sku || order.customerName}`)
    );

    return newOrders.filter(order => {
      const orderKey = `${order.orderNumber}-${order.sku || order.customerName}`;
      return !existingOrderKeys.has(orderKey);
    });
  },

  parseOrderItems(row: string[]): any[] {
    const items = [];
    let itemIndex = 0;

    for (let col = 18; col < 77; col += 6) {
      const sku = row[col];
      const title = row[col + 1];
      const quantity = parseInt(row[col + 2]) || 0;
      const price = parseFloat(row[col + 3]) || 0;

      if (sku || title) {
        items.push({
          index: itemIndex++,
          sku: sku || '',
          title: title || '',
          quantity,
          price,
          location: row[col + 4] || '',
          notes: row[col + 5] || '',
        });
      }
    }

    return items;
  },

  async updatePackerInfo(
    sheetId: string,
    rowIndex: number,
    packerName: string,
    packedTime: string
  ): Promise<void> {
    const existingData = await this.fetchSheetData(sheetId, `Data!BZ${rowIndex}:CA${rowIndex}`);

    let newPackerName = packerName;
    let newPackedTime = packedTime;

    if (existingData.length > 0 && existingData[0].length > 0) {
      const existingPacker = existingData[0][0] || '';
      const existingTime = existingData[0][1] || '';

      if (existingPacker) {
        newPackerName = `${existingPacker} | ${packerName}`;
      }
      if (existingTime) {
        newPackedTime = `${existingTime} | ${packedTime}`;
      }
    }

    await this.writeSheetData(sheetId, `Data!BZ${rowIndex}:CA${rowIndex}`, [
      [newPackerName, newPackedTime],
    ]);
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const { data: existing } = await supabase
      .from('app_settings')
      .select('*')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('app_settings')
        .update(settings)
        .eq('id', existing.id);
    } else {
      await supabase.from('app_settings').insert(settings);
    }
  },

  async getSettings(): Promise<AppSettings | null> {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .maybeSingle();

    return data;
  },

  async getColumnMapping(): Promise<CsvColumnMapping | null> {
    const settings = await this.getSettings();
    if (settings && settings.google_sheets_column_mapping) {
      return settings.google_sheets_column_mapping as CsvColumnMapping;
    }
    return null;
  },

  async saveColumnMapping(mapping: CsvColumnMapping): Promise<void> {
    await this.saveSettings({
      google_sheets_column_mapping: mapping,
    });
  },

  async fetchHeaders(sheetId: string): Promise<string[]> {
    const rows = await this.fetchSheetData(sheetId, 'Data!A1:CA1');
    if (rows.length > 0) {
      return rows[0].map(h => h?.toString() || '');
    }
    return [];
  },

  async fetchPackingInstructions(sheetId: string, tabName: string = 'Packing Instructions'): Promise<{ sku: string; instruction: string }[]> {
    try {
      console.log(`🔍 Fetching packing instructions from tab: "${tabName}"`);

      const rows = await this.fetchSheetData(sheetId, `${tabName}!A2:B`);

      if (rows.length === 0) {
        console.warn(`⚠️ No packing instructions found in "${tabName}" tab`);
        return [];
      }

      const instructions: { sku: string; instruction: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (!row || row.length < 2) {
          console.warn(`⚠️ Skipping row ${i + 2}: insufficient columns`);
          continue;
        }

        const sku = row[0]?.toString().trim() || '';
        const instruction = row[1]?.toString().trim() || '';

        if (!sku || !instruction) {
          console.warn(`⚠️ Skipping row ${i + 2}: empty SKU or instruction`);
          continue;
        }

        instructions.push({ sku, instruction });
      }

      console.log(`✅ Successfully fetched ${instructions.length} packing instructions`);
      return instructions;

    } catch (error) {
      console.error('❌ Error fetching packing instructions:', error);
      throw new Error(`Failed to fetch packing instructions from "${tabName}" tab: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async syncPackingInstructionsToSettings(sheetId: string, tabName: string = 'Packing Instructions'): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const instructions = await this.fetchPackingInstructions(sheetId, tabName);

      await this.saveSettings({
        packing_instructions_last_sync: new Date().toISOString(),
        packing_instructions_sync_status: 'success',
        packing_instructions_error_message: null,
      });

      return { success: true, count: instructions.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.saveSettings({
        packing_instructions_sync_status: 'error',
        packing_instructions_error_message: errorMessage,
      });

      return { success: false, count: 0, error: errorMessage };
    }
  },
};
