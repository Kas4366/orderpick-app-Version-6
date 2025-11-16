# Google Apps Script Webhook Setup Guide

This guide will help you set up a Google Apps Script webhook to enable real-time packer information updates in your Google Sheet.

## Overview

The webhook allows the OrderPick app to write packer names and packed times directly to your Google Sheet whenever an order is marked as complete. This eliminates the need for complex OAuth authentication while maintaining secure, real-time updates.

## Prerequisites

- A Google Sheet with order data
- Access to Google Apps Script (Extensions > Apps Script in Google Sheets)
- Your Google Sheet must have columns BZ and CA available for packer info

## Step-by-Step Setup

### 1. Open Google Apps Script Editor

1. Open your Google Sheet
2. Click on **Extensions** in the menu bar
3. Select **Apps Script**
4. This will open the Apps Script editor in a new tab

### 2. Create the Webhook Script

Delete any existing code in the editor and paste the following script:

```javascript
// Google Apps Script Webhook for OrderPick Packer Info
// This script receives packer information from the OrderPick app and writes it to the sheet

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

    // Validate required fields
    if (!data.rowIndex || !data.packerName || !data.packedTime) {
      console.error("Missing required fields");
      return createCorsResponse({
        success: false,
        error: "Missing required fields: rowIndex, packerName, packedTime"
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

    // Column indices for packer info (BZ = 78, CA = 79)
    const PACKER_NAME_COLUMN = 78; // Column BZ
    const PACKED_TIME_COLUMN = 79; // Column CA

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

    // Return success response
    return createCorsResponse({
      success: true,
      message: `Packer info updated for row ${data.rowIndex}`
    });

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

// Test function to verify the script works (optional)
function testWebhook() {
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
```

### 3. Configure the Script

In the script you just pasted, configure the following:

1. **SECRET_KEY** (Optional but recommended):
   - Replace `"YOUR_SECRET_KEY_HERE"` with a secure random string
   - Example: `"my-super-secret-key-12345"`
   - Leave empty (`""`) if you don't want to use a secret key
   - You'll need to enter the same key in the OrderPick app settings

2. **DATA_SHEET_NAME**:
   - Make sure this matches your sheet tab name (default is "Data")
   - If your data is in a different tab, change this value

### 4. Save the Script

1. Click the **disk icon** or press `Ctrl+S` (Windows) or `Cmd+S` (Mac) to save
2. Give your project a name (e.g., "OrderPick Packer Info Webhook")

### 5. Deploy as Web App

1. Click on **Deploy** button in the top-right corner
2. Select **New deployment**
3. Click the gear icon next to "Select type"
4. Choose **Web app**
5. Configure the deployment:
   - **Description**: "OrderPick Packer Info Webhook" (or any description)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (this allows the OrderPick app to access it)
6. Click **Deploy**
7. You may need to authorize the app:
   - Click **Authorize access**
   - Select your Google account
   - Click **Advanced** if you see a warning
   - Click **Go to [Project Name] (unsafe)** - this is safe as it's your own script
   - Click **Allow**

### 6. Copy the Webhook URL

1. After deployment, you'll see a **Web app URL**
2. It will look like: `https://script.google.com/macros/s/XXXXX/exec`
3. Click the **Copy** button or select and copy the entire URL
4. **Save this URL** - you'll need it in the next step

### 7. Configure OrderPick App

1. Open your OrderPick app
2. Go to **Settings**
3. Navigate to **Google Sheets** section
4. Expand the **Packer Info Webhook Configuration** section
5. Paste the webhook URL you copied in step 6
6. If you set a SECRET_KEY in step 3, enter it in the "Secret Key" field
7. Click **Test Connection** to verify it works
8. If successful, check **Enable Webhook**
9. Click **Save Settings**

## Testing the Setup

### Test 1: Connection Test
1. In OrderPick app settings, click **Test Connection**
2. You should see a green success message
3. Check the Apps Script logs (View > Logs) to see the test request

### Test 2: Complete an Order
1. Load orders from your Google Sheet
2. Select an order and mark it as complete
3. Check your Google Sheet columns BZ and CA
4. You should see the packer name and timestamp appear

## Troubleshooting

### Error: "Network Error. Failed to Fetch" or CORS Policy Error
- This means the Google Apps Script doesn't have CORS headers enabled
- Make sure you're using the updated script with the `doOptions()` function and `createCorsResponse()` helper
- If you previously deployed without CORS support, you MUST redeploy:
  1. Go to Apps Script editor
  2. Click **Deploy** > **Manage deployments**
  3. Click the **Edit** icon (pencil) next to your deployment
  4. Change **Version** to "New version"
  5. Click **Deploy**
- The webhook URL remains the same after redeployment

### Error: "Sheet 'Data' not found"
- Make sure your DATA_SHEET_NAME in the script matches your actual sheet tab name
- Edit the script, change DATA_SHEET_NAME, and redeploy

### Error: "Unauthorized: Invalid secret key"
- Verify the secret key in the script matches the one in OrderPick app
- Secret keys are case-sensitive

### Error: "Connection timeout"
- Check your internet connection
- Verify the webhook URL is correct
- Make sure you deployed the script as "Anyone" can access

### No data appears in columns BZ/CA
1. Check that webhook is enabled in OrderPick app
2. Verify the order has a rowIndex (loaded from Google Sheets)
3. Check Apps Script logs for errors (View > Logs)
4. Make sure you're logged in as an employee when marking orders complete

### How to view Apps Script logs
1. Open Apps Script editor
2. Click **View** > **Logs** or **Execution log**
3. You'll see all webhook requests and any errors

## Security Considerations

1. **Use a Secret Key**: While optional, it's highly recommended to use a secret key to prevent unauthorized access
2. **HTTPS**: All communication uses HTTPS, so data is encrypted in transit
3. **Access Control**: The script runs with your permissions, so it can only modify sheets you have access to
4. **Audit Trail**: Apps Script logs all executions, allowing you to review all webhook calls

## Updating the Script

If you need to modify the script:

1. Edit the code in the Apps Script editor
2. Click **Save**
3. Click **Deploy** > **Manage deployments**
4. Click the edit icon (pencil) next to your deployment
5. Change **Version** to "New version"
6. Click **Deploy**
7. The webhook URL remains the same - no need to update OrderPick app

## Column Reference

- **Column BZ (78)**: Packer Name
- **Column CA (79)**: Packed Time

These columns will be automatically populated when orders are marked as complete.

## Advanced Configuration

### Using Different Columns

If you want to use different columns for packer info:

1. Edit the script
2. Modify these lines:
   ```javascript
   const PACKER_NAME_COLUMN = 78; // Change 78 to your desired column number
   const PACKED_TIME_COLUMN = 79; // Change 79 to your desired column number
   ```
3. Column A = 1, B = 2, ..., Z = 26, AA = 27, etc.
4. Save and redeploy

### Multiple Sheets

If you have multiple sheets and want to use different tabs:

1. Modify the DATA_SHEET_NAME variable in the script
2. Or pass the sheet name in the webhook request (requires code modification)

## Support

If you encounter issues not covered in this guide:

1. Check the Apps Script execution logs
2. Verify all configuration steps were followed
3. Test with a simple order first
4. Check browser console for any client-side errors

## Summary

Once configured, the webhook will:
- ✅ Automatically write packer info when orders are completed
- ✅ Handle multiple packers for merged orders
- ✅ Provide real-time updates without OAuth complexity
- ✅ Work securely with optional secret key validation
- ✅ Log all operations for debugging and audit purposes

Your packer information will now be recorded in real-time directly to your Google Sheet!
