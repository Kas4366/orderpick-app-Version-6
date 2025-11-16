# Quick Start: Individual Item Reorder Marking

## What's New

✅ Mark individual items for reorder in multiple-item and merged orders
✅ Each item has its own checkbox
✅ Automatic Google Sheets sync to column CB
✅ Timestamps written when marked, cleared when unmarked

## Setup (5 Minutes)

### Step 1: Update Google Apps Script

1. Open your Google Sheet
2. Go to **Extensions** > **Apps Script**
3. Replace all code with the script from `GOOGLE_APPS_SCRIPT_REORDER_UPDATE.md`
4. Update `SECRET_KEY` if you use one
5. **Save** and **Deploy** as a web app
6. Copy the deployment URL

### Step 2: Configure App

1. Open OrderPick app
2. Go to **Settings** > **Google Sheets**
3. Paste the new webhook URL
4. Click **Test Connection** (should show success)
5. Close settings

## Usage

### For Single Items
- Works exactly as before
- Checkbox at the bottom of order details

### For Multiple Items / Merged Orders
- **Each item now has its own checkbox**
- Find it in the item details section
- Check to mark, uncheck to remove

### What Happens When You Mark an Item

1. ✅ Item added to Stock Tracking (Settings)
2. ✅ Date/time written to Google Sheets column CB
3. ✅ Item details copied to clipboard
4. ✅ Green checkmark shows item is marked

### What Happens When You Unmark

1. ✅ Item removed from Stock Tracking
2. ✅ Column CB cleared in Google Sheets
3. ✅ Checkbox unchecked

## Google Sheets Column Layout

| Column | Purpose |
|--------|---------|
| BZ | Packer Name (when order completed) |
| CA | Packed Time (when order completed) |
| CB | **Reorder Timestamp** ⭐ NEW |

## Troubleshooting

**Checkboxes not showing for multi-item orders?**
- Refresh the page
- Ensure you have the latest version

**Timestamps not appearing in Google Sheets?**
- Verify column CB exists in your sheet
- Check webhook is enabled (Settings > Google Sheets)
- Ensure Google Apps Script is updated
- Only works for orders loaded from Google Sheets

**Can't unmark items?**
- Click the checkbox again or the label text
- Check browser console for errors

## Key Features

✨ **Independent Tracking**: Each item tracked separately
✨ **Audit Trail**: See exactly when items were marked
✨ **Clipboard Copy**: All details copied for easy reordering
✨ **Real-time Sync**: Google Sheets updated instantly
✨ **Backward Compatible**: Single-item marking unchanged

## Documentation

- **Full Details**: See `REORDER_FEATURE_SUMMARY.md`
- **Google Script**: See `GOOGLE_APPS_SCRIPT_REORDER_UPDATE.md`
- **Original Setup**: See `GOOGLE_APPS_SCRIPT_WEBHOOK_SETUP.md`

## Example Workflow

1. **Load orders** from Google Sheets
2. **Pick an order** with 3 items
3. **Item 1**: In stock ✅ (don't mark)
4. **Item 2**: Out of stock ❌ (check the box)
5. **Item 3**: In stock ✅ (don't mark)
6. **Result**: Only Item 2 tracked for reorder
7. **Google Sheet**: Only Item 2's row has timestamp in column CB
8. **Stock Tracking**: Only Item 2 appears in the list

## Need Help?

Check the full documentation in:
- `REORDER_FEATURE_SUMMARY.md` - Complete technical details
- `GOOGLE_APPS_SCRIPT_REORDER_UPDATE.md` - Script setup guide

## Version Info

- Feature added: January 2025
- Requires: Updated Google Apps Script
- Compatible with: All order types (PDF, CSV, Google Sheets)
- Google Sheets sync: Only for orders with rowIndex
