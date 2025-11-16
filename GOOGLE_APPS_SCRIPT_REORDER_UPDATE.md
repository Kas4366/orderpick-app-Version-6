# Google Apps Script Update for Reorder Timestamps

This guide explains how to update your existing Google Apps Script webhook to support reorder timestamp tracking in column CB.

## Overview

The updated script now handles both:
- **Packer Info** (columns BZ & CA): Written when orders are completed
- **Reorder Timestamps** (column CB): Written when items are marked for reorder

## Updated Google Apps Script

Replace your existing Google Apps Script code with this updated version:

```javascript
// Google Apps Script Webhook for OrderPick Packer Info & Reorder Tracking
// This script receives both packer information and reorder timestamps from the OrderPick app

// CONFIGURATION
const SECRET_KEY = "YOUR_SECRET_KEY_HERE"; // Optional: Set a secret key for security, or leave empty
const DATA_SHEET_NAME = "Data"; // Name of the sheet tab containing your order data

// Handle OPTIONS requests for CORS preflight
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type")
    .setHeader("Access-Control-Max-Age", "86400");
}

// Main function to handle POST requests from OrderPick app
function doPost(e) {
  try {
    // Log the incoming request
    console.log("Received webhook request");

    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    console.log("Parsed data:", JSON.stringify(data));

    // Validate secret key if configured
    if (SECRET_KEY && SECRET_KEY !== "" && data.secretKey !== SECRET_KEY) {
      console.error("Invalid secret key");
      return createCorsResponse({ success: false, error: "Unauthorized: Invalid secret key" });
    }

    // Validate required fields - either packer info OR reorder info
    if (!data.rowIndex) {
      console.error("Missing rowIndex field");
      return createCorsResponse({
        success: false,
        error: "Missing required field: rowIndex"
      });
    }

    // Handle test requests (rowIndex = 0 is used for connection tests)
    if (data.rowIndex === 0) {
      console.log("Test request received - connection successful");
      return createCorsResponse({ success: true, message: "Test connection successful" });
    }

    // Get the active spreadsheet and data sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!sheet) {
      console.error("Sheet not found:", DATA_SHEET_NAME);
      return createCorsResponse({
        success: false,
        error: `Sheet "${DATA_SHEET_NAME}" not found`
      });
    }

    // Column indices
    const PACKER_NAME_COLUMN = 78;    // Column BZ
    const PACKED_TIME_COLUMN = 79;    // Column CA
    const REORDER_TIME_COLUMN = 80;   // Column CB

    // Determine if this is a packer info update or reorder info update
    if (data.packerName && data.packedTime) {
      // PACKER INFO UPDATE
      console.log("Processing packer info update");

      // Get existing values in the packer info columns
      const existingPackerName = sheet.getRange(data.rowIndex, PACKER_NAME_COLUMN).getValue();
      const existingPackedTime = sheet.getRange(data.rowIndex, PACKED_TIME_COLUMN).getValue();

      // Append to existing values if present (for merged orders with multiple packers)
      let newPackerName = data.packerName;
      let newPackedTime = data.packedTime;

      if (existingPackerName && existingPackerName.toString().trim() !== "") {
        newPackerName = existingPackerName + " | " + data.packerName;
      }

      if (existingPackedTime && existingPackedTime.toString().trim() !== "") {
        newPackedTime = existingPackedTime + " | " + data.packedTime;
      }

      // Write the packer info to the sheet
      sheet.getRange(data.rowIndex, PACKER_NAME_COLUMN).setValue(newPackerName);
      sheet.getRange(data.rowIndex, PACKED_TIME_COLUMN).setValue(newPackedTime);

      console.log(`Successfully updated row ${data.rowIndex} with packer info`);

      return createCorsResponse({
        success: true,
        message: `Packer info updated for row ${data.rowIndex}`
      });

    } else if (data.hasOwnProperty('reorderTime')) {
      // REORDER INFO UPDATE
      console.log("Processing reorder info update");

      // Write the reorder timestamp to column CB
      // Empty string means clear the cell (item was unmarked for reorder)
      sheet.getRange(data.rowIndex, REORDER_TIME_COLUMN).setValue(data.reorderTime);

      const action = data.reorderTime === '' ? 'cleared' : 'updated';
      console.log(`Successfully ${action} reorder timestamp for row ${data.rowIndex}`);

      return createCorsResponse({
        success: true,
        message: `Reorder timestamp ${action} for row ${data.rowIndex}`
      });

    } else {
      // Invalid request - neither packer info nor reorder info
      console.error("Invalid request: missing required fields");
      return createCorsResponse({
        success: false,
        error: "Missing required fields: either (packerName + packedTime) or reorderTime"
      });
    }

  } catch (error) {
    console.error("Error processing webhook:", error.toString());
    return createCorsResponse({ success: false, error: error.toString() });
  }
}

// Helper function to create CORS-enabled responses
function createCorsResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Test function to verify packer info works (optional)
function testPackerInfo() {
  const testData = {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        rowIndex: 2,
        packerName: "Test Packer",
        packedTime: new Date().toLocaleString(),
        secretKey: SECRET_KEY
      })
    }
  };

  const result = doPost(testData);
  console.log("Test result:", result.getContent());
}

// Test function to verify reorder info works (optional)
function testReorderInfo() {
  const testData = {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        rowIndex: 2,
        reorderTime: new Date().toLocaleString(),
        secretKey: SECRET_KEY
      })
    }
  };

  const result = doPost(testData);
  console.log("Test result:", result.getContent());
}

// Test function to verify clearing reorder info works (optional)
function testClearReorderInfo() {
  const testData = {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        rowIndex: 2,
        reorderTime: "",
        secretKey: SECRET_KEY
      })
    }
  };

  const result = doPost(testData);
  console.log("Test result:", result.getContent());
}
```

## What's New

### Changes from Previous Version

1. **New Column Support**: Added `REORDER_TIME_COLUMN = 80` (Column CB)
2. **Dual Request Handling**: Script now handles both packer info and reorder info
3. **Request Detection**: Automatically detects request type based on payload fields
4. **Clear Functionality**: Empty `reorderTime` clears the cell (for when items are unmarked)

### How It Works

**When an item is marked for reorder:**
- App sends `{ rowIndex: X, reorderTime: "DD/MM/YYYY, HH:MM:SS" }`
- Script writes the timestamp to column CB at row X

**When an item is unmarked for reorder:**
- App sends `{ rowIndex: X, reorderTime: "" }`
- Script clears column CB at row X

**When an order is completed:**
- App sends `{ rowIndex: X, packerName: "Name", packedTime: "timestamp" }`
- Script writes to columns BZ & CA at row X (same as before)

## Installation Steps

1. **Open your Google Sheet**
2. **Go to Extensions > Apps Script**
3. **Replace all existing code** with the updated script above
4. **Update the SECRET_KEY** (if you're using one)
5. **Click Save** (disk icon or Ctrl+S)
6. **Deploy the script**:
   - Click "Deploy" > "New deployment"
   - Select type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Click "Deploy"
   - Copy the web app URL

7. **Update the URL in OrderPick app**:
   - Open Settings in the app
   - Go to Google Sheets tab
   - Paste the new deployment URL
   - Test the connection

## Testing

You can test the functionality using the built-in test functions:

1. **Test Packer Info**: Run `testPackerInfo()` function
2. **Test Reorder Marking**: Run `testReorderInfo()` function
3. **Test Reorder Clearing**: Run `testClearReorderInfo()` function

## Column Layout

| Column | Letter | Purpose |
|--------|--------|---------|
| 78 | BZ | Packer Name |
| 79 | CA | Packed Time |
| 80 | CB | **Reorder Timestamp** (NEW) |

## Troubleshooting

**Reorder timestamps not appearing:**
- Ensure column CB exists in your sheet
- Check that the item has a rowIndex (only works with Google Sheets integration)
- Verify webhook is enabled in app settings
- Check browser console for error messages

**Timestamps not clearing:**
- Ensure you're using the updated script version
- Verify the webhook URL is correct
- Check Apps Script execution logs for errors

## Notes

- Only orders loaded from Google Sheets will have rowIndex values
- PDF/CSV orders without Google Sheets integration won't update the sheet
- Individual items in multi-item orders can now be marked independently
- Each item tracks its own reorder timestamp
- The timestamp format matches your system's locale settings
