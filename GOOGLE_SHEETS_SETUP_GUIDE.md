# Google Sheets Integration - Setup Guide

## Overview

This guide will walk you through setting up Google Sheets integration for the OrderPick application. The integration allows you to:

- Load orders directly from a Google Sheet
- Track packer names and timestamps in the sheet
- Sync employees from the sheet
- Auto-refresh orders every 15 minutes
- Search old orders directly from the sheet

---

## Part 1: Google Cloud Project Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name: `OrderPick Integration` (or any name you prefer)
5. Click "Create"

### Step 2: Enable Google Sheets API

1. In your Google Cloud Project, go to **APIs & Services > Library**
2. Search for "Google Sheets API"
3. Click on "Google Sheets API"
4. Click "Enable"

### Step 3: Enable Google Drive API (for read access)

1. While still in the Library, search for "Google Drive API"
2. Click on "Google Drive API"
3. Click "Enable"

### Step 4: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select "External" user type (unless you have a Google Workspace account)
3. Click "Create"

**Fill in the form:**
- App name: `OrderPick`
- User support email: Your email
- Developer contact: Your email
- Click "Save and Continue"

**Scopes:**
- Click "Add or Remove Scopes"
- Search for and add these scopes:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.readonly`
- Click "Update" then "Save and Continue"

**Test users:**
- Add your Google account email as a test user
- Click "Save and Continue"

### Step 5: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "+ Create Credentials" > "OAuth client ID"
3. Application type: **Web application**
4. Name: `OrderPick Web Client`

**Authorized JavaScript origins:**
```
http://localhost:5173
```

**Authorized redirect URIs:**
```
http://localhost:5173/auth/callback
```

5. Click "Create"
6. **IMPORTANT:** Copy the Client ID and Client Secret - you'll need these next

---

## Part 2: Configure the Application

### Step 6: Add Credentials to .env File

1. Open the `.env` file in your project root
2. Replace the placeholder values:

```env
VITE_GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

3. Save the file

---

## Part 3: Prepare Your Google Sheet

### Step 7: Set Up Your Google Sheet Structure

Your Google Sheet must have two tabs:

#### **Tab 1: "Data"** (Order Data)

Column structure:
- Column A: Order Number
- Column B: Downloaded Date (format: YYYY-MM-DD)
- Columns C-BY: Your order data (80+ columns total)
- **Column BZ (78)**: Packer Name (will be written by app)
- **Column CA (79)**: Packed Time (will be written by app)

**Important:**
- Row 1 should contain headers
- Order data starts from Row 2
- The "Downloaded Date" column (B) is used for filtering orders by date

#### **Tab 2: "Employees"** (Employee List)

Structure:
- Column A: Employee Name
- Column B: Employee PIN

Example:
```
Name          | PIN
--------------|------
John Smith    | 1234
Jane Doe      | 5678
Mike Johnson  | 9012
```

**Important:**
- Row 1 should contain headers
- Employee data starts from Row 2
- PINs can be any numeric or alphanumeric string
- Keep this tab private and secure

### Step 8: Share Your Google Sheet

1. Open your Google Sheet
2. Click the "Share" button
3. Add the Google account you used in OAuth consent screen as a test user
4. Give it "Editor" permissions (app needs to write packer data)
5. Copy the full URL of your Google Sheet (you'll need this in the app)

---

## Part 4: Connect the Application

### Step 9: Start the Application

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Step 10: Connect to Google Sheets

1. In the app, click the Settings icon (gear icon in top right)
2. Click on the **"Google Sheets"** tab
3. Paste your Google Sheets URL in the input field
4. Click **"Connect"**

**What happens next:**
- You'll be redirected to Google's login page
- Sign in with your Google account
- Grant permissions when asked
- You'll be redirected back to the app
- The connection will be tested automatically

If successful, you'll see:
- ✅ Connected status
- Sheet name
- Available tabs
- Total rows
- Last sync time

---

## Part 5: Using the Integration

### Loading Employees

Employees are loaded automatically from your Google Sheet when:
- You first connect to Google Sheets
- You click the "Refresh Employees" button on the login screen
- The app starts (employees are cached in memory)

### Employee Login

1. When you navigate to Order Pick view, you'll see the employee login screen
2. Enter your PIN
3. Click "Login"

Your session will be tracked for packer information.

### Loading Orders

**Current Implementation Status:**
- ✅ Google Sheets connection and authentication
- ✅ Employee management system
- ✅ Settings UI for Google Sheets configuration
- 🔄 Order loading with date filtering (needs integration)
- 🔄 Auto-refresh every 15 minutes (needs integration)
- 🔄 Manual refresh button (needs integration)
- 🔄 Packer tracking write-back (needs integration)
- 🔄 Old order search from Google Sheets (needs integration)

---

## Implementation Notes

### What's Been Completed:

1. **Database Schema**
   - OAuth tokens table (stores Google authentication)
   - App settings table (stores connection info and preferences)

2. **Services**
   - Google OAuth authentication service
   - Google Sheets API service (read/write)
   - Employee management service

3. **UI Components**
   - Google Sheets settings tab in Settings modal
   - OAuth callback handler
   - Employee login screen
   - Connection status indicators

4. **Core Features**
   - OAuth 2.0 flow with Google
   - Token refresh and management
   - Employee data loading from Google Sheets
   - Employee PIN authentication (in-memory)
   - Sheet metadata retrieval

### What Needs Integration:

The following features are implemented in services but need to be integrated into the existing order workflow:

1. **Order Loading**
   - Add Google Sheets as order source option
   - Implement date picker for "Downloaded Date" filtering
   - Load orders from "Data" tab with column mapping

2. **Auto-Refresh System**
   - Background check every 15 minutes for new orders
   - Popup: "X new orders available. Add to workflow?"
   - Merge new orders without losing packed data

3. **Manual Refresh**
   - Add refresh button in Order Pick view
   - Same merge logic as auto-refresh

4. **Packer Tracking**
   - Write packer name to column BZ when order is scanned
   - Write timestamp to column CA
   - Append to existing data (preserve history)

5. **Old Order Search**
   - When QR/search doesn't find order in loaded set
   - Search Google Sheets directly
   - Load and display the old order
   - Disable "extra pick" logic for old orders

6. **Order Group Classification**
   - Track which orders belong to selected date group
   - Identify "old orders" from search
   - Apply business logic accordingly

---

## Troubleshooting

### "Failed to connect to Google Sheets"

**Check:**
- Are your credentials in `.env` correct?
- Did you enable both Google Sheets API and Drive API?
- Is your Google account added as a test user in OAuth consent screen?
- Is the redirect URI exactly `http://localhost:5173/auth/callback`?

### "No employees loaded"

**Check:**
- Does your Google Sheet have an "Employees" tab?
- Is the data in columns A (Name) and B (PIN)?
- Does your Google account have access to the sheet?

### "Invalid PIN"

**Check:**
- Is the PIN exactly as it appears in the Google Sheet (case-sensitive)?
- Are there any extra spaces in the PIN in the sheet?

### "Permission denied"

**Check:**
- Did you grant all requested permissions during OAuth?
- Try disconnecting and reconnecting in the settings

---

## Security Considerations

1. **OAuth Tokens**
   - Stored securely in Supabase database
   - Never exposed in client-side code
   - Automatically refreshed when expired

2. **Employee PINs**
   - Loaded directly from Google Sheets each session
   - Stored in memory only (not in database)
   - No local persistence for security

3. **Google Sheet Access**
   - Use Editor permissions (app needs to write packer data)
   - Keep the "Employees" tab private
   - Consider using Google Workspace for better control

---

## Next Steps for Full Integration

To complete the Google Sheets integration, the following components need to be connected:

1. **Modify HomeView or create order source selector**
   - Add option to load from Google Sheets vs HTML/CSV

2. **Extend useOrderData hook**
   - Add Google Sheets order loading function
   - Implement refresh logic
   - Add packer tracking on order completion

3. **Update OrderPickView**
   - Add employee login requirement when using Google Sheets
   - Add refresh button and status
   - Show connection status

4. **Implement write-back on QR scan**
   - When order is scanned, write to columns BZ and CA

5. **Add order group tracking**
   - Track selected date group
   - Classify orders as "current" or "old"
   - Apply business logic accordingly

---

## Support

For issues or questions:
1. Check this documentation
2. Review console logs in browser dev tools
3. Check Google Cloud Console for API usage/errors
4. Verify all environment variables are set correctly

---

**Implementation Date:** 2025-10-05
**Status:** Foundational components complete, awaiting full integration
