# Individual Item Reorder Marking - Implementation Summary

## Overview

The reorder marking feature has been enhanced to support marking individual items in multiple-item and merged orders. Previously, the mark reorder button only appeared for single-item orders. Now, each item in a multiple-item or merged order has its own checkbox, and reorder timestamps are automatically synced to Google Sheets column CB.

## What Was Implemented

### 1. Enhanced Data Structure
- **StockTrackingItem Interface**: Added `rowIndex` and `orderValue` fields to support Google Sheets synchronization
- **Tracking Logic**: Updated to identify items by the combination of SKU + order number for accurate tracking across multi-item orders

### 2. User Interface Updates
- **Individual Checkboxes**: Each item in grouped orders now displays its own "Mark for reorder" checkbox
- **Visual Feedback**: Checkboxes show checked state and confirmation message when items are marked
- **Independent Operation**: Items can be marked/unmarked independently without affecting other items in the same order

### 3. Google Sheets Integration
- **Column CB Updates**: When an item is marked for reorder, the date/time is written to column CB
- **Auto-Clear**: When an item is unmarked, column CB is automatically cleared
- **Same Format**: Reorder timestamps use the same format as packed date/time (locale-specific)
- **Webhook Service**: New `sendReorderInfo` function handles reorder timestamp updates

### 4. Backend Logic
- **Async Operations**: Reorder marking/unmarking now supports async operations for Google Sheets updates
- **Error Handling**: Comprehensive error handling with console logging for debugging
- **Row Index Tracking**: Each tracked item stores its Google Sheets row index for updates

### 5. Edge Function Support
- **Updated Proxy**: Google Sheets webhook proxy now handles both packer info and reorder info payloads
- **Flexible Payload**: Supports `reorderTime` field (in addition to existing `packerName` and `packedTime`)
- **Clear Operation**: Empty `reorderTime` value clears the column

## How It Works

### Marking an Item for Reorder

1. User clicks the checkbox next to an item in a multiple-item or merged order
2. App creates a `StockTrackingItem` with all relevant details including `rowIndex`
3. Item is added to the stock tracking list and saved to localStorage
4. If the item has a `rowIndex` (from Google Sheets):
   - App calls `webhookService.sendReorderInfo(rowIndex, timestamp)`
   - Webhook proxy forwards the request to Google Apps Script
   - Google Apps Script writes the timestamp to column CB at the specified row
5. Item details are copied to clipboard in the format: `(SKU) (Quantity) (Price) (Location) (Channel)`

### Unmarking an Item for Reorder

1. User unchecks the checkbox for a marked item
2. App finds the item in stock tracking using SKU + order number + marked date
3. Item is removed from stock tracking list and localStorage
4. If the item has a `rowIndex`:
   - App calls `webhookService.sendReorderInfo(rowIndex, '')`  // Empty string
   - Webhook proxy forwards the request to Google Apps Script
   - Google Apps Script clears column CB at the specified row

### Multiple Items from Same Order

- Each item in a multi-item order has its own entry in stock tracking
- Items are distinguished by their unique combination of SKU + order number
- Marking one item doesn't affect others
- Each item's reorder timestamp is tracked independently in Google Sheets

## Files Modified

### Core Logic
- `src/types/StockTracking.ts`: Added rowIndex and orderValue fields
- `src/hooks/useOrderData.tsx`: Updated mark/unmark functions to be async and integrate with Google Sheets
- `src/services/webhookService.ts`: Added `sendReorderInfo` function

### UI Components
- `src/components/OrderDisplay.tsx`: Added checkboxes for individual items in grouped orders
- `src/components/StockTrackingTab.tsx`: Updated to pass orderNumber parameter to remove function

### Edge Functions
- `supabase/functions/google-sheets-webhook-proxy/index.ts`: Updated to handle reorder info payloads

### Documentation
- `GOOGLE_APPS_SCRIPT_REORDER_UPDATE.md`: Complete guide for updating Google Apps Script
- `REORDER_FEATURE_SUMMARY.md`: This summary document

## Google Sheets Column Layout

| Column | Letter | Purpose | When Updated |
|--------|--------|---------|--------------|
| 78 | BZ | Packer Name | Order completed |
| 79 | CA | Packed Time | Order completed |
| 80 | CB | **Reorder Timestamp** | Item marked/unmarked for reorder |

## Usage Instructions

### For Users

1. **Load orders from Google Sheets** (for automatic timestamp syncing)
2. **Navigate to an order** with multiple items or merged orders
3. **Find the "Mark for reorder" checkbox** for each item
4. **Check the box** to mark an item as needing reorder
   - Timestamp is written to Google Sheets column CB
   - Item details are copied to clipboard
   - Item appears in Stock Tracking tab in Settings
5. **Uncheck the box** to unmark an item
   - Timestamp is cleared from Google Sheets column CB
   - Item is removed from Stock Tracking list

### For Administrators

1. **Update Google Apps Script** using the guide in `GOOGLE_APPS_SCRIPT_REORDER_UPDATE.md`
2. **Ensure column CB exists** in your Google Sheet Data tab
3. **Test the webhook connection** in app settings
4. **Verify timestamps appear** in column CB when items are marked

## Technical Details

### Webhook Payload for Reorder Info

**Mark for reorder:**
```json
{
  "rowIndex": 123,
  "reorderTime": "09/01/2025, 14:30:45",
  "secretKey": "your-secret-key"
}
```

**Unmark for reorder:**
```json
{
  "rowIndex": 123,
  "reorderTime": "",
  "secretKey": "your-secret-key"
}
```

### Stock Tracking Item Structure

```typescript
{
  sku: "PROD-123",
  markedDate: "2025-01-09T14:30:45.123Z",
  orderNumber: "ORD-456",
  customerName: "John Doe",
  currentStock: 5,
  location: "A1-B2",
  imageUrl: "blob:...",
  rowIndex: 123,           // NEW: For Google Sheets updates
  orderValue: 29.99,       // NEW: For reference
  localImageSource: {...}
}
```

## Benefits

1. **Granular Control**: Mark individual items out of stock without affecting entire orders
2. **Automatic Tracking**: Google Sheets automatically updated with reorder timestamps
3. **Better Organization**: Stock tracking shows complete context for each item
4. **Audit Trail**: Clear record of when each item was marked for reorder
5. **Efficient Workflow**: Clipboard copy includes all necessary information for reordering

## Compatibility

- **Works with**: Orders loaded from Google Sheets (with rowIndex)
- **Partial support**: CSV/PDF orders (no Google Sheets sync, but local tracking works)
- **Requires**: Updated Google Apps Script for full functionality
- **Backward compatible**: Existing single-item reorder marking unchanged

## Future Enhancements

Potential improvements for future versions:
- Bulk mark/unmark operations
- Reorder quantity suggestions based on historical data
- Integration with inventory management systems
- Email notifications when items are marked for reorder
- Export reorder list in various formats

## Testing Checklist

- [x] Single item orders can be marked for reorder
- [x] Multiple item orders show individual checkboxes
- [x] Merged orders show individual checkboxes
- [x] Marking an item adds it to stock tracking
- [x] Unmarking an item removes it from stock tracking
- [x] Google Sheets column CB receives timestamp when marked
- [x] Google Sheets column CB is cleared when unmarked
- [x] Clipboard copy works for individual items
- [x] Stock tracking tab displays items correctly
- [x] Build succeeds without errors
- [x] orderNumber parameter passed correctly throughout the app

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify Google Apps Script is updated to the latest version
3. Ensure webhook is enabled in app settings
4. Check Apps Script execution logs in Google Cloud Console
5. Verify column CB exists in your Google Sheet
