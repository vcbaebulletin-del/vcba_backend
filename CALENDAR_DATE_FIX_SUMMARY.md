# 🎯 CALENDAR DATE OFF-BY-ONE ERROR - FIXED

**Date:** October 8, 2025  
**Commit:** aaad045  
**Status:** ✅ RESOLVED

---

## 📋 ISSUE DESCRIPTION

**Problem:**
When creating calendar events in the Admin Calendar, dates were being saved one day earlier than selected:
- **User selects:** October 6, 2025
- **Database stores:** October 6, 2025 (correct)
- **Application displays:** October 5, 2025 (wrong!)

**Impact:**
- Critical data integrity issue
- User confusion and loss of trust
- Affects all calendar-related features (Admin Calendar, TV Display, Calendar View)

---

## 🔍 ROOT CAUSE ANALYSIS

### **The Problem:**

1. **Database Storage:** MySQL stores `event_date` and `end_date` as `DATE` type (no timezone component)
2. **MySQL2 Driver Behavior:** When retrieving dates, MySQL2 converts them to JavaScript `Date` objects at **midnight local time** (Philippine Time, UTC+8)
3. **Timezone Conversion Bug:** When converting to ISO string for API response:
   ```javascript
   // BEFORE (BUGGY CODE):
   event.event_date.toISOString().split('T')[0]
   
   // Example:
   // Database: 2025-10-06 (DATE type)
   // MySQL2 returns: Mon Oct 06 2025 00:00:00 GMT+0800 (Philippine Standard Time)
   // toISOString(): "2025-10-05T16:00:00.000Z" (midnight PHT = 16:00 previous day UTC)
   // split('T')[0]: "2025-10-05" ← WRONG DATE!
   ```

4. **Why This Happens:**
   - Philippine Time is UTC+8
   - Midnight in PHT (00:00) = 16:00 previous day in UTC
   - `toISOString()` always returns UTC time
   - Extracting the date part from UTC gives the previous day

---

## ✅ THE FIX

### **Solution:**
Extract date components **directly from the Date object** without timezone conversion:

```javascript
// AFTER (FIXED CODE):
const formatDateWithoutTimezone = (dateValue) => {
  if (!dateValue) return null;
  
  if (dateValue instanceof Date) {
    // Extract date components directly from the Date object (local time)
    // This avoids timezone conversion issues
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (typeof dateValue === 'string') {
    // For string dates, extract the date part
    return dateValue.split('T')[0];
  }
  return null;
};

// Example:
// Database: 2025-10-06 (DATE type)
// MySQL2 returns: Mon Oct 06 2025 00:00:00 GMT+0800
// getFullYear(): 2025
// getMonth(): 9 (0-indexed, so +1 = 10)
// getDate(): 6
// Result: "2025-10-06" ← CORRECT DATE!
```

---

## 🔧 CHANGES MADE

### **File: `BACK-VCBA-E-BULLETIN-BOARD/src/models/CalendarModel.js`**

#### **1. Updated `formatEventDates()` function (lines 9-37)**
- Replaced `toISOString().split('T')[0]` with direct date component extraction
- Added comprehensive comments explaining the timezone issue
- Handles both Date objects and string dates

#### **2. Fixed `createEvent()` method (line 66)**
```javascript
// BEFORE:
return await this.findById(result.insertId);

// AFTER:
return await this.getEventById(result.insertId);
```
- `findById()` returns raw database result (Date objects with timezone issues)
- `getEventById()` calls `formatEventDates()` to fix dates

#### **3. Fixed `getEvents()` method (lines 228-229)**
```javascript
// Added date formatting before returning:
const formattedEvents = events.map(event => this.formatEventDates(event));
return { events: formattedEvents, pagination: {...} };
```

#### **4. Fixed `getEventsByDate()` method (lines 409-411)**
```javascript
// Added date formatting before returning:
const formattedEvents = events.map(event => this.formatEventDates(event));
return formattedEvents;
```

#### **5. Fixed `getEventsByDateRange()` method (lines 461-463)**
```javascript
// Added date formatting before returning:
const formattedEvents = events.map(event => this.formatEventDates(event));
return formattedEvents;
```

---

## 🧪 TESTING

### **Test Suite: `test-calendar-date-fix.js`**

Created comprehensive test covering all calendar event methods:

```
✅ Test 1: createEvent() - Returns 2025-10-06 (was 2025-10-05T16:00:00.000Z)
✅ Test 2: getEventById() - Returns 2025-10-06
✅ Test 3: getEvents() - Returns 2025-10-06 (was 2025-10-05T16:00:00.000Z)
✅ Test 4: getEventsByDate() - Returns 2025-10-06
✅ Test 5: getEventsByDateRange() - Returns 2025-10-06

🔍 VERIFICATION:
Expected event_date: 2025-10-06
Actual event_date:   2025-10-06
Match: ✅ PASS

Expected end_date: 2025-10-10
Actual end_date:   2025-10-10
Match: ✅ PASS
```

### **Test Results:**
- ✅ All 5 tests pass
- ✅ Dates are now correct across all methods
- ✅ No timezone conversion issues

---

## 📊 IMPACT ANALYSIS

### **Before Fix:**
- ❌ Calendar events displayed one day earlier
- ❌ Multi-day events had incorrect date ranges
- ❌ TV Display showed wrong event dates
- ❌ Calendar view showed events on wrong days
- ❌ User confusion and data integrity concerns

### **After Fix:**
- ✅ Calendar events display on correct dates
- ✅ Multi-day events have correct date ranges
- ✅ TV Display shows correct event dates
- ✅ Calendar view shows events on correct days
- ✅ User-selected dates are preserved exactly

---

## 🚀 DEPLOYMENT

**Backend:**
- Commit: aaad045
- Pushed to: main branch
- Railway: Auto-deployment triggered
- Status: ⏳ Deploying (2-5 minutes)

**Frontend:**
- No changes required (frontend date handling was already correct)

---

## ✅ VERIFICATION STEPS

After Railway deployment completes:

1. **Create New Event:**
   - Go to Admin Calendar
   - Click on October 6, 2025
   - Create a new event
   - Verify event appears on October 6, 2025 (not October 5)

2. **Create Multi-Day Event:**
   - Create event from October 6 to October 10, 2025
   - Verify it spans exactly 5 days (Oct 6, 7, 8, 9, 10)

3. **Check Existing Events:**
   - View existing calendar events
   - Verify all dates are correct
   - Check TV Display shows correct dates

4. **Test Edge Cases:**
   - Create event on first day of month (e.g., November 1)
   - Create event on last day of month (e.g., October 31)
   - Create event spanning month boundary (e.g., Oct 30 - Nov 2)

---

## 📝 TECHNICAL NOTES

### **Why This Fix Works:**

1. **Direct Component Extraction:**
   - `getFullYear()`, `getMonth()`, `getDate()` operate on the Date object's **local time**
   - No conversion to UTC occurs
   - Preserves the date as stored in the database

2. **Consistent Across All Methods:**
   - All calendar event retrieval methods now use `formatEventDates()`
   - Ensures consistent date formatting throughout the application

3. **Backward Compatible:**
   - Handles both Date objects and string dates
   - Existing data is not affected
   - No database migration required

### **Alternative Approaches Considered:**

1. **Store as DATETIME with timezone:** ❌ Overkill for date-only events
2. **Use UTC dates everywhere:** ❌ Confusing for users in different timezones
3. **Client-side timezone handling:** ❌ Inconsistent across browsers
4. **Current solution (direct extraction):** ✅ Simple, reliable, no timezone issues

---

## 🎯 CONCLUSION

**Status:** ✅ **RESOLVED**

The calendar date off-by-one error has been completely fixed by:
1. Identifying the root cause (timezone conversion in `toISOString()`)
2. Implementing proper date formatting (direct component extraction)
3. Applying the fix to all calendar event methods
4. Comprehensive testing to verify correctness

**Confidence Level:** **HIGH** - All tests pass, root cause understood and addressed.

---

**Next Steps:**
1. ⏳ Wait for Railway deployment to complete
2. 🧪 Test in production environment
3. ✅ Verify with real calendar events
4. 🎉 Issue resolved!

