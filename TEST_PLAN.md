# Report System Testing Plan

## Pre-Testing Setup

1. **Start Backend Server**:
   ```bash
   cd BACK-VCBA-E-BULLETIN-BOARD
   npm install
   npm start
   ```

2. **Start Frontend Server**:
   ```bash
   cd FRONT-VCBA-E-BULLETIN-BOARD
   npm install
   npm start
   ```

## Automated Testing

### 1. Backend Validation Testing

Run the validation test script:
```bash
cd BACK-VCBA-E-BULLETIN-BOARD
node test-validation-fix.js
```

**Expected Results**:
- ✅ Monthly Report: 200 OK or report generation success
- ✅ Weekly Report: 200 OK or report generation success  
- ✅ Daily Report: 200 OK or report generation success
- ✅ Custom Report: 200 OK or report generation success
- ❌ Invalid requests: 400 Bad Request with validation errors

### 2. Manual Frontend Testing

#### Test Case 1: Monthly Reports (Regression Test)
1. Navigate to Admin → Reports
2. Select "Monthly" report type
3. Choose a month (e.g., September 2024)
4. Select both "Announcements" and "School Calendar"
5. Click "Generate Report"

**Expected**: ✅ Report generates successfully (no regression)

#### Test Case 2: Weekly Reports (Primary Fix)
1. Select "Weekly" report type
2. Choose a week range
3. Select content types
4. Click "Generate Report"

**Expected**: ✅ Report generates without 400 validation error

#### Test Case 3: Daily Reports (Primary Fix)
1. Select "Daily" report type
2. Choose a specific date
3. Select content types
4. Click "Generate Report"

**Expected**: ✅ Report generates without 400 validation error

#### Test Case 4: Custom Reports (Primary Fix)
1. Select "Custom" report type
2. Choose start and end dates
3. Select content types
4. Click "Generate Report"

**Expected**: ✅ Report generates without 400 validation error

## Data Inclusion Testing

### Test Case 5: Comprehensive Data Verification

**Setup**: Create test data with different statuses:
- Active announcements
- Archived announcements (status = 'archived')
- Soft-deleted announcements (deleted_at IS NOT NULL)
- Active calendar events (is_active = 1)
- Inactive calendar events (is_active = 0)
- Soft-deleted calendar events (deleted_at IS NOT NULL)

**Test**: Generate any report type covering the date range of test data

**Expected**: ✅ Report includes ALL records regardless of status

### Test Case 6: Date Range Filtering

**Test**: Generate reports with different date ranges

**Expected**: ✅ Only records within the specified date range are included

## Error Handling Testing

### Test Case 7: Invalid Payloads

Test these invalid requests manually or via API:

1. **Missing fields**:
   ```json
   {"month": "2024-09"}
   ```
   **Expected**: ❌ 400 - Fields required

2. **Invalid date format**:
   ```json
   {"startDate": "2024/09/26", "endDate": "2024/09/26", "fields": ["Announcements"]}
   ```
   **Expected**: ❌ 400 - Invalid date format

3. **Missing date parameters**:
   ```json
   {"fields": ["Announcements"]}
   ```
   **Expected**: ❌ 400 - Date parameters required

## Performance Testing

### Test Case 8: Large Dataset

**Test**: Generate reports for date ranges with large amounts of data (e.g., full year)

**Expected**: ✅ Report generates within reasonable time (< 30 seconds)

## PDF Export Testing

### Test Case 9: PDF Generation

For each report type that generates successfully:
1. Click "Export to PDF"
2. Verify PDF downloads
3. Open PDF and verify content

**Expected**: ✅ PDF contains all expected data with proper formatting

## Browser Console Monitoring

During all tests, monitor browser console for:
- ✅ Successful API requests (200 status)
- ❌ No 400 validation errors for valid requests
- ✅ Proper error messages for invalid requests
- ✅ No JavaScript errors

## Network Tab Monitoring

Check Network tab for:
- Request payloads match expected format
- Response status codes are correct
- Response data structure is valid

## Troubleshooting Guide

### If Weekly/Daily/Custom Reports Still Fail:

1. **Check Backend Logs**: Look for validation error details
2. **Verify Request Payload**: Ensure frontend sends correct format
3. **Check Date Formatting**: Verify `getPhilippinesDateString()` output
4. **Validate Route Order**: Ensure validation middleware is applied correctly

### If Data is Missing from Reports:

1. **Check Database**: Verify test data exists with different statuses
2. **Review SQL Queries**: Ensure no WHERE clauses filter by status
3. **Check Date Ranges**: Verify created_at dates fall within report range

### If PDF Export Fails:

1. **Check Report Data**: Ensure report generation succeeds first
2. **Verify jsPDF**: Check for JavaScript errors in PDF generation
3. **Test Image Inclusion**: Try with and without images

## Success Criteria

All tests pass when:
- ✅ All 4 report types generate without validation errors
- ✅ Reports include comprehensive data (all statuses)
- ✅ Date range filtering works correctly
- ✅ PDF export works for all report types
- ✅ No regression in existing functionality
- ✅ Error handling works for invalid requests
