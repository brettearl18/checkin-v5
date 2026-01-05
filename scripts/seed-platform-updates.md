# Platform Updates Seed Data

To add initial platform updates to Firestore, you can manually create documents in the `platform_updates` collection with the following structure:

## Firestore Collection: `platform_updates`

### Example Documents:

#### 1. New Issue Reporting Feature
```json
{
  "date": "2026-01-01T00:00:00Z",  // Use Firestore Timestamp
  "category": "new-feature",
  "title": "New Issue Reporting Feature",
  "description": "Clients can now report bugs and issues directly from their portal. Access it via the 'Submit Issue' menu item.",
  "details": "This feature allows clients to report issues they encounter while using the platform. Reports are automatically sent to the development team with browser information, console errors, and screenshots (when available).",
  "status": "completed",
  "impact": "low",
  "createdAt": "2026-01-01T00:00:00Z",  // Use Firestore Timestamp
  "updatedAt": "2026-01-01T00:00:00Z"   // Use Firestore Timestamp
}
```

#### 2. Platform Updates Changelog Feature
```json
{
  "date": "2026-01-03T00:00:00Z",
  "category": "new-feature",
  "title": "Platform Updates Changelog",
  "description": "Clients can now view a complete changelog of all platform updates, bug fixes, and improvements. Access it via the 'Platform Updates' menu item.",
  "details": "This changelog provides transparency about ongoing platform improvements and helps clients stay informed about fixes and new features.",
  "status": "completed",
  "impact": "low",
  "createdAt": "2026-01-03T00:00:00Z",
  "updatedAt": "2026-01-03T00:00:00Z"
}
```

## How to Add via Firebase Console:

1. Go to Firebase Console → Firestore Database
2. Navigate to the `platform_updates` collection
3. Click "Add document"
4. Add the following fields:
   - `date`: Timestamp (use the date picker)
   - `category`: String (bug-fix, new-feature, maintenance, downtime, security, performance)
   - `title`: String
   - `description`: String
   - `details`: String (optional)
   - `status`: String (completed, in-progress, planned)
   - `impact`: String (low, medium, high, critical) - optional
   - `createdAt`: Timestamp
   - `updatedAt`: Timestamp

## How to Add via Admin Interface:

1. Log in as an admin
2. Navigate to `/admin/platform-updates`
3. Fill out the form
4. Click "Create"

