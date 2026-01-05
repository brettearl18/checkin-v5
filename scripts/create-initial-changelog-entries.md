# Initial Changelog Entries to Create

## Entry 1: Issue Reporting Feature

**Category:** new-feature  
**Title:** New Issue Reporting Feature  
**Description:** Clients can now report bugs and issues directly from their portal. Access it via the 'Submit Issue' menu item. Reports are automatically sent to the development team with browser information, console errors, and screenshots (when available).  
**Details:** This feature allows clients to report issues they encounter while using the platform. When submitting an issue, clients can provide a detailed description, steps to reproduce, browser console errors, and optional screenshots. All reports are sent to the development team for quick resolution.  
**Status:** completed  
**Impact:** low  
**Date:** 2026-01-03 (or current date)

---

## Entry 2: Platform Updates Changelog

**Category:** new-feature  
**Title:** Platform Updates Changelog  
**Description:** Clients can now view a complete changelog of all platform updates, bug fixes, and improvements. Access it via the 'Platform Updates' menu item.  
**Details:** This changelog provides transparency about ongoing platform improvements and helps clients stay informed about fixes and new features. You can filter updates by category (Bug Fixes, New Features, Maintenance, etc.) and see the status of each update.  
**Status:** completed  
**Impact:** low  
**Date:** 2026-01-03 (or current date)

---

## Entry 3: Improved Date Display on Progress Photos

**Category:** bug-fix  
**Title:** Improved Date Display on Progress Photos  
**Description:** Progress photo dates are now displayed below the images instead of as overlays, making them easier to read and more visible.  
**Details:** The date text has been moved from an overlay on the image to a dedicated section below each photo. The text is now larger, bolder, and uses better contrast for improved readability. This change applies to all progress photo views (client portal dashboard, progress images page, and coach client profile).  
**Status:** completed  
**Impact:** low  
**Date:** 2026-01-03 (or current date)

---

## How to Add These

1. **Via Admin Interface:**
   - Navigate to `/admin/platform-updates`
   - Fill out the form for each entry
   - Click "Create"

2. **Via Firebase Console:**
   - Go to Firestore Database
   - Navigate to `platform_updates` collection
   - Add document for each entry
   - Use Firestore Timestamp for `date`, `createdAt`, and `updatedAt` fields

