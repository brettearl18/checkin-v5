# Firestore Indexes Guide - CHECKINV5

## **Overview**
This document contains the Firestore composite indexes needed to resolve the "FAILED_PRECONDITION" errors and improve query performance.

## **Current Index Errors (From Terminal Logs)**

### **1. Check-in Assignments Index**
**Error:** `The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/checkinv5/firestore/indexes?create_composite=ClZwcm9qZWN0cy9jaGVja2ludjUvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2NoZWNrX2luX2Fzc2lnbm1lbnRzL2luZGV4ZXMvXxABGgwKCGNsaWVudElkEAEaCwoHZHVlRGF0ZRABGgwKCF9fbmFtZV9fEAE`

**Collection:** `check_in_assignments`
**Fields to index:**
- `clientId` (Ascending)
- `dueDate` (Ascending) 
- `__name__` (Ascending)

**Purpose:** Client portal check-ins queries

### **2. Forms Collection Index**
**Error:** `The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/checkinv5/firestore/indexes?create_composite=Ckdwcm9qZWN0cy9jaGVja2ludjUvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2Zvcm1zL2luZGV4ZXMvXxABGgsKB2NvYWNoSWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC`

**Collection:** `forms`
**Fields to index:**
- `coachId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Forms library queries

### **3. Questions Collection Index**
**Error:** `The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/checkinv5/firestore/indexes?create_composite=Cktwcm9qZWN0cy9jaGVja2ludjUvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3F1ZXN0aW9ucy9pbmRleGVzL18QARoLCgdjb2FjaElkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg`

**Collection:** `questions`
**Fields to index:**
- `coachId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Questions library queries

## **Required Indexes Summary**

| Collection | Fields | Order | Purpose |
|------------|--------|-------|---------|
| `check_in_assignments` | `clientId`, `dueDate`, `__name__` | ASC, ASC, ASC | Client check-ins |
| `check_in_assignments` | `coachId`, `assignedAt`, `__name__` | ASC, DESC, ASC | Coach assignments |
| `forms` | `coachId`, `createdAt`, `__name__` | ASC, DESC, ASC | Forms library |
| `questions` | `coachId`, `createdAt`, `__name__` | ASC, DESC, ASC | Questions library |
| `clients` | `coachId`, `cleared`, `__name__` | ASC, ASC, ASC | Recent activity |
| `formResponses` | `coachId`, `submittedAt`, `__name__` | ASC, DESC, ASC | Recent activity |
| `messages` | `coachId`, `createdAt`, `__name__` | ASC, DESC, ASC | Messages |
| `messages` | `clientId`, `createdAt`, `__name__` | ASC, DESC, ASC | Client messages |

## **How to Create Indexes**

### **Method 1: Direct Links (Recommended)**
Click the links in the error messages above to create indexes directly in the Firebase Console.

### **Method 2: Manual Creation**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `checkinv5`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Add the fields in the order specified above
6. Set the query scope to **Collection**
7. Click **Create**

### **Method 3: Firebase CLI**
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy indexes
firebase deploy --only firestore:indexes
```

### **Method 4: Using the Setup Script**
```bash
# Run the index deployment script
node scripts/deploy-indexes.js
```

## **Index Creation Time**
- **Small collections:** 1-5 minutes
- **Large collections:** 5-15 minutes
- **Very large collections:** 15-60 minutes

## **Monitoring Index Status**
1. Go to Firebase Console → Firestore → Indexes
2. Check the **Status** column
3. Wait for all indexes to show **Enabled**

## **Testing Indexes**
Use the API endpoint to test if indexes are working:
```bash
curl http://localhost:3000/api/setup-indexes
```

## **Impact on Application**
- **Before indexes:** Queries fail with "FAILED_PRECONDITION" errors
- **After indexes:** Queries work normally, all features function properly
- **Performance:** Significantly improved query performance

## **Temporary Workaround**
The application currently handles missing indexes gracefully by:
- Catching index errors
- Logging warnings
- Using fallback queries without ordering
- Continuing to function normally

This means the app works even without indexes, but some features may be slower or show limited data.

## **Next Steps**
1. Create the indexes using the direct links above
2. Wait for indexes to become enabled
3. Test the application functionality
4. Monitor performance improvements

## **Production Considerations**
- Indexes are essential for production performance
- Monitor index usage in Firebase Console
- Consider removing unused indexes to save costs
- Set up alerts for index build failures

## **Cost Impact**
- **Index creation:** Free
- **Index storage:** Minimal cost
- **Query performance:** Significant improvement
- **Overall:** Cost-effective for better user experience 