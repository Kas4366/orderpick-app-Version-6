# Order Problems Resolution System - Complete Guide

## Overview

The Order Problems Resolution System is a comprehensive feature that enables packers to report issues with orders and allows design makers to review and resolve them efficiently. The system includes real-time notifications, automatic escalation, full tracking, and Google Sheets synchronization.

---

## Key Features

### 1. Universal Access Control
- **All Employees**: Can report problems while processing orders
- **All Employees**: Can view, pick up, and resolve problems in a dedicated interface
- **Simplified**: No role assignments needed - everyone can do everything

### 2. Real-Time Notifications
- All employees (except the person who took the action) receive instant notifications
- Browser notifications (if permissions granted)
- Visual notification badge with unread count
- Automatic escalation alerts for overdue problems
- Smart notification: you don't get notified about your own actions

### 3. Problem Tracking & Management
- Complete audit trail of all problem-related activities
- Status tracking: Pending → In Progress → Resolved/Escalated
- Timestamps for all actions
- Google Sheets synchronization for record-keeping

### 4. Escalation System
- Configurable time-based automatic escalation
- Default: 30 minutes (customizable in app_settings)
- Escalated problems get priority visibility

### 5. Customizable Problem Reasons
- Admin-manageable list of problem reasons
- Easy to add/remove reasons through Settings
- Historical reasons preserved in existing records

---

## Setup Instructions

### Step 1: Set Up Employees in Google Sheets

The system only requires employee name and PIN - no roles needed:

1. Open your Google Sheet
2. Go to the **Employees** tab
3. Ensure you have two columns:
   - Column A: **Name**
   - Column B: **PIN**

**Example:**
```
| Name          | PIN  |
|---------------|------|
| John Smith    | 1234 |
| Jane Doe      | 5678 |
| Bob Johnson   | 9012 |
| Alice Brown   | 3456 |
```

### Step 2: Refresh Employees in the App

1. Log out of the application
2. On the login screen, click "Refresh Employees"
3. The system will sync the updated employee data including roles

### Step 3: Configure Problem Reasons

1. Login as any user
2. Click the **Settings** icon (top-right)
3. Navigate to the **Problem Reasons** tab
4. Add your custom problem reasons:
   - Examples: "Missing design file", "Wrong specifications", "Quality issue", etc.
5. Click **Add** for each reason

**Default Reasons Included:**
- Missing design file
- Incorrect product specifications
- Design quality issue
- Customer customization unclear
- Product image mismatch

### Step 4: Configure Escalation Time (Optional)

The default escalation time is 30 minutes. To change this:

1. Connect to your Supabase database
2. Update the `app_settings` table:
   ```sql
   UPDATE app_settings
   SET problem_escalation_minutes = 60  -- Set to desired minutes
   WHERE id = (SELECT id FROM app_settings LIMIT 1);
   ```

### Step 5: Set Up Google Sheets Problem Columns

The system will automatically write problem data to columns starting from **Column CC** onwards in your Data tab:

**Problem Data Columns (CC-CN):**
- CC: Problem Reason
- CD: Problem Description
- CE: Reported By
- CF: Reported At
- CG: Status
- CH: Assigned To
- CI: Picked Up At
- CJ: Resolution Description
- CK: Resolved By
- CL: Resolved At
- CM: Escalated At
- CN: Escalation Reason

---

## User Workflows

### For All Employees: Reporting a Problem

1. **While Picking an Order:**
   - View the order details in the Order Display
   - Notice an issue with the order
   - Click the **"Report Problem"** button (red button with warning icon)

2. **Fill Problem Report:**
   - Select a problem reason from the dropdown
   - Provide a detailed description of the issue
   - Click **"Report Problem"**

3. **Confirmation:**
   - You'll see a success message
   - Design makers are automatically notified
   - Continue with your work

**Best Practices When Reporting:**
- Be specific in your problem description
- Include relevant details (SKU, what's wrong, what you expected)
- Use clear and concise language
- Report problems as soon as you notice them

### For All Employees: Resolving Problems

1. **Accessing the Problems Interface:**
   - Login with your employee PIN
   - You'll see an **"Order Problems"** tab in the header
   - A notification badge shows unread problem count
   - Click the tab to view all problems

2. **Problem Queue:**
   - View problems filtered by status:
     - **Pending**: New problems waiting to be picked up
     - **In Progress**: Problems currently being worked on
     - **Escalated**: Overdue problems needing urgent attention
     - **Resolved**: Completed problems
   - Click any filter to view specific categories

3. **Picking Up a Problem:**
   - Review the problem details
   - Click **"Pick Up"** to assign it to yourself
   - Status changes to "In Progress"
   - Problem is now assigned to you

4. **Resolving a Problem:**
   - Work on fixing the issue
   - Click **"Mark as Resolved"**
   - Enter a detailed resolution description
   - Click **"Mark as Resolved"** to complete

5. **Viewing Problem Details:**
   - Click **"View Details"** on any problem
   - See complete timeline and information
   - Review all timestamps and actions taken

**Best Practices When Resolving:**
- Check the Order Problems tab regularly
- Prioritize escalated problems (red badges)
- Provide detailed resolution descriptions
- Communicate with packers if clarification needed

---

## Real-Time Notifications

### In-App Notifications

All employees receive instant notifications when:
- A new problem is reported (except the person who reported it)
- A problem is escalated
- A problem they reported is resolved

**Notification Badge:**
- Appears in the header next to "Order Problems" tab
- Shows unread notification count
- Pulses/animates when new notification arrives
- Click to view problems and mark notifications as read

### Browser Notifications

If you grant permission, you'll receive browser notifications:
- Desktop alerts even when app is in background
- Sound alerts (if enabled in browser)
- Click notification to open app

**Enabling Browser Notifications:**
1. Click the notification badge when prompted
2. Allow notifications in browser prompt
3. Notifications will appear immediately

---

## System Architecture

### Database Tables

**problem_reasons**
- Stores customizable problem reasons
- Managed through Settings interface
- Soft delete (is_active flag)

**order_problems**
- Main problems table
- Tracks all problem data and status
- Links to Google Sheets row for syncing

**order_problem_notifications**
- Tracks notifications sent to users
- Real-time subscriptions via Supabase
- Read/unread status tracking

**app_settings** (extended)
- problem_escalation_minutes: Time before auto-escalation
- problem_reasons_last_updated: Last update to reasons

### Real-Time Features

The system uses Supabase's real-time capabilities:
- Instant problem updates across all connected clients
- Notification delivery without page refresh
- Status changes reflected immediately
- No polling required - truly real-time

### Google Sheets Integration

Problem data is automatically synced to Google Sheets:
- Writes to columns CC-CN in Data tab
- Updates when problem status changes
- Preserves complete audit trail
- Syncs immediately after each action

---

## Troubleshooting

### "No employees found to notify"

**Cause:** No employees are configured in Google Sheets

**Solution:**
1. Open Google Sheets
2. Go to Employees tab
3. Ensure employees have Name (Column A) and PIN (Column B)
4. Refresh employees in the app

### Notifications Not Appearing

**Cause 1:** Browser notifications not enabled

**Solution:** Grant notification permissions when prompted

**Cause 2:** Not logged in

**Solution:** Ensure you are logged in with a valid employee PIN

### Problems Not Syncing to Google Sheets

**Cause:** Order doesn't have rowIndex

**Solution:** Orders loaded from Google Sheets automatically have rowIndex. For CSV/HTML orders, Google Sheets sync is not available.

### Escalation Not Working

**Cause:** Escalation check not running

**Solution:** The system checks every 60 seconds automatically. Ensure the Order Problems view is open or refresh the page.

---

## API Reference

### orderProblemsService Functions

```typescript
// Get all active problem reasons
getProblemReasons(): Promise<ProblemReason[]>

// Create new problem reason
createProblemReason(reason: string): Promise<ProblemReason>

// Report a problem
reportProblem(
  orderNumber: string,
  sku: string,
  customerName: string,
  reportedBy: string,
  formData: ReportProblemFormData,
  googleSheetRowIndex?: number
): Promise<OrderProblem>

// Pick up a problem
pickUpProblem(problemId: string, designMakerName: string): Promise<void>

// Resolve a problem
resolveProblem(
  problemId: string,
  resolvedBy: string,
  formData: ResolveProblemFormData
): Promise<void>

// Subscribe to real-time updates
subscribeToProblems(callback: (problem: OrderProblem) => void): () => void

subscribeToNotifications(
  recipientName: string,
  callback: (notification: OrderProblemNotification) => void
): () => void
```

---

## Future Enhancements

Potential features for future versions:

1. **Email Notifications**
   - Send email alerts to design makers
   - Requires email service integration

2. **Problem Comments/Notes**
   - Allow back-and-forth discussion
   - Attach files or images

3. **Priority Levels**
   - Manual priority assignment
   - Automatic priority based on order value

4. **Analytics Dashboard**
   - Problem trends over time
   - Resolution time metrics
   - Most common problem types

5. **Custom Workflows**
   - Multi-step resolution processes
   - Approval requirements

6. **Mobile App**
   - Native mobile notifications
   - Mobile-optimized interface

---

## Security Considerations

The system is designed for a trusted, single-tenant environment:

- RLS enabled on all tables with permissive policies
- Designed for internal team use only
- No public access or authentication required
- All actions logged with employee names
- Google Sheets provides additional audit trail

---

## Support

For issues or questions:

1. Check this guide for common solutions
2. Review the troubleshooting section
3. Check browser console for error messages
4. Verify Google Sheets employee roles
5. Ensure Supabase connection is active

---

## Summary

The Order Problems Resolution System provides:

✅ Universal access for all employees - no role management needed
✅ Real-time notifications and updates
✅ Smart notifications - no self-notifications
✅ Automatic escalation for overdue problems
✅ Complete audit trail and tracking
✅ Google Sheets synchronization
✅ Customizable problem reasons
✅ Clean, intuitive interface
✅ Zero external service costs
✅ Flexible workflow - anyone can report or resolve problems

The system is production-ready and fully integrated with your existing OrderPick workflow!
