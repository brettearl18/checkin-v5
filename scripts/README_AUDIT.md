# Audit Script: All Client Check-ins Report

This script generates a comprehensive markdown report of all client check-ins with timestamps, scores, and assignment details.

## Usage

### Prerequisites

1. Make sure you have `FIREBASE_SERVICE_ACCOUNT` set in your `.env.local` file
2. Ensure you have Node.js installed
3. Install dependencies: `npm install`

### Run the Script

```bash
# Run and save output to markdown file
node scripts/audit-all-client-checkins.js > CLIENT_CHECKINS_AUDIT.md

# Or view output in terminal
node scripts/audit-all-client-checkins.js
```

### Output

The script generates a markdown report with:

1. **Client Sections** - Each client's check-ins grouped together
   - Client name and email
   - Total check-in count
   
2. **Form Sections** - Check-ins grouped by form for each client
   - Form title and ID
   - Table with:
     - Week number
     - Response ID
     - Submitted timestamp (Perth timezone)
     - Score percentage
     - Status
     - Assignment ID
     - recurringWeek

3. **Summary** - Overall statistics
   - Total clients
   - Clients with check-ins
   - Total responses
   - Average check-ins per client

4. **Week Distribution** - Breakdown by week number
   - Count of check-ins per week

## Example Output

```markdown
# Client Check-ins Audit Report

**Generated:** 11 January, 2026, 10:30:00 AM

---

## Client: Brett Earl
- **Client ID:** `abc123...`
- **Email:** brett@example.com
- **Total Check-ins:** 6

### Form: Vana Health 2026 Check In
- **Form ID:** `form123...`
- **Check-ins:** 6

| Week | Response ID | Submitted At | Score | Status | Assignment ID | recurringWeek |
|------|-------------|--------------|-------|--------|---------------|---------------|
| 1 | `resp123...` | 2 January, 2026, 09:35 PM | 75% | completed | `assign123...` | 1 |
| 2 | `resp456...` | 9 January, 2026, 10:40 AM | 68% | completed | `assign456...` | 2 |
...

## Summary
| Metric | Count |
|--------|-------|
| Total Clients | 50 |
| Clients with Check-ins | 45 |
| Total Responses | 230 |
| Average Check-ins per Client | 5.11 |
```

## Notes

- All timestamps are displayed in Australian Perth timezone (AWST)
- The script processes all responses, even if assignment links are missing
- Missing data is displayed as "N/A"
- The report is sorted by client name, then by week number (or date)

