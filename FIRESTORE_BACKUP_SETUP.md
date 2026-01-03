# Firestore Daily Backup Configuration Guide

This guide will help you set up automated daily backups for your Firestore database.

---

## Overview

**Backup Strategy:**
- **Frequency:** Daily at 2:00 AM
- **Retention:** 90 days (automatic cleanup)
- **Storage Location:** Cloud Storage bucket `checkinv5-firestore-backups`
- **Region:** australia-southeast2 (same as Firestore)

---

## Quick Setup (Automated Script)

Run the setup script:

```bash
./setup-firestore-backups-simple.sh
```

Or use the simple command (if bucket already exists):

```bash
gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence="daily" \
  --retention="90d" \
  --project=checkinv5
```

This will:
1. Create a Cloud Storage bucket for backups
2. Set up 90-day retention policy
3. Create native Firestore daily backup schedule

---

## Manual Setup Steps

If you prefer to set up manually, follow these steps:

### Step 1: Create Cloud Storage Bucket

```bash
gsutil mb -p checkinv5 -l australia-southeast2 gs://checkinv5-firestore-backups
```

### Step 2: Set Lifecycle Policy (90-day retention)

Create a file `lifecycle.json`:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["backups/"]
        }
      }
    ]
  }
}
```

Apply it:

```bash
gsutil lifecycle set lifecycle.json gs://checkinv5-firestore-backups
```

### Step 3: Enable Required APIs

```bash
gcloud services enable cloudscheduler.googleapis.com --project=checkinv5
gcloud services enable firestore.googleapis.com --project=checkinv5
```

### Step 4: Grant Permissions

Grant the App Engine service account permission to export Firestore:

```bash
gcloud projects add-iam-policy-binding checkinv5 \
  --member="serviceAccount:checkinv5@appspot.gserviceaccount.com" \
  --role="roles/datastore.owner"

gcloud projects add-iam-policy-binding checkinv5 \
  --member="serviceAccount:checkinv5@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Step 5: Create Cloud Scheduler Job

**Option A: Using Cloud Console (Recommended)**

1. Go to [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=checkinv5)
2. Click **"Create Job"**
3. Fill in the details:
   - **Name:** `firestore-daily-backup`
   - **Region:** `australia-southeast2`
   - **Schedule:** `0 2 * * *` (2 AM daily in your timezone)
   - **Timezone:** Select your timezone (e.g., `Australia/Sydney`)
   - **Target type:** HTTP
   - **URL:** `https://firestore.googleapis.com/v1/projects/checkinv5/databases/(default):exportDocuments`
   - **HTTP method:** POST
   - **Auth header:** Add OAuth token
   - **Service account:** `checkinv5@appspot.gserviceaccount.com`
   - **Body:**
     ```json
     {
       "outputUriPrefix": "gs://checkinv5-firestore-backups/backups/daily/"
     }
     ```
4. Click **"Create"**

**Option B: Using Cloud Function (More Flexible)**

Create a Cloud Function that runs the export:

1. Create a new Cloud Function:
   - Runtime: Node.js 20
   - Entry point: `exportFirestore`
   - Trigger: Cloud Scheduler (HTTP)

2. Function code:

```javascript
const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');

exports.exportFirestore = async (req, res) => {
  const projectId = 'checkinv5';
  const bucketName = 'checkinv5-firestore-backups';
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const outputUriPrefix = `gs://${bucketName}/backups/daily/${timestamp}`;

  try {
    // Note: Direct Firestore export via Admin SDK requires different approach
    // This is a placeholder - you'd need to use gcloud command or REST API
    
    // Alternative: Use REST API
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`
        },
        body: JSON.stringify({
          outputUriPrefix: outputUriPrefix
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    res.status(200).json({
      success: true,
      message: `Backup started: ${outputUriPrefix}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

3. Schedule it with Cloud Scheduler to run daily at 2 AM

---

## Test Backup

Run a test backup manually:

```bash
gcloud firestore export gs://checkinv5-firestore-backups/backups/daily/$(date +%Y-%m-%d-%H%M%S) --project=checkinv5
```

Check the backup status:

```bash
gcloud firestore operations list --project=checkinv5
```

---

## View Backups

List all backups:

```bash
gsutil ls -r gs://checkinv5-firestore-backups/backups/
```

---

## Restore from Backup

To restore from a backup:

```bash
gcloud firestore import gs://checkinv5-firestore-backups/backups/daily/2026-01-03 --project=checkinv5
```

⚠️ **Warning:** This will overwrite existing data. Use with caution!

---

## Monitoring

**Check Backup Status:**
- View Cloud Scheduler job executions: [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=checkinv5)
- Check backup files: [Cloud Storage](https://console.cloud.google.com/storage/browser/checkinv5-firestore-backups?project=checkinv5)
- View Firestore operations: `gcloud firestore operations list`

**Set Up Alerts:**
1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring?project=checkinv5)
2. Create an alert for:
   - Cloud Scheduler job failures
   - Backup bucket size/errors
   - Firestore export operation failures

---

## Backup Structure

Backups are stored with the following structure:

```
gs://checkinv5-firestore-backups/
  └── backups/
      └── daily/
          └── YYYY-MM-DD/
              ├── all_namespaces/
              │   └── all_kinds/
              │       └── [export files]
              └── [metadata files]
```

---

## Cost Considerations

- **Storage:** ~$0.026 per GB/month in australia-southeast2
- **Operations:** Export operations are billed as read operations
- **Lifecycle policy:** Automatically deletes backups older than 90 days

**Estimated monthly cost:** Depends on database size, typically $1-5/month for small to medium databases.

---

## Alternative: Point-in-Time Recovery

For more advanced backup needs, consider enabling **Point-in-Time Recovery (PITR)**:

```bash
gcloud firestore databases update --enable-pitr --project=checkinv5
```

This provides:
- 7-day point-in-time recovery window
- Continuous backup (no manual exports needed)
- Additional cost (~20% increase in storage costs)

---

## Troubleshooting

### Backup Job Fails

1. Check Cloud Scheduler logs: [Cloud Scheduler Logs](https://console.cloud.google.com/cloudscheduler?project=checkinv5)
2. Verify service account permissions
3. Check Firestore API is enabled
4. Verify bucket exists and is accessible

### Backup Not Running

1. Check Cloud Scheduler job status
2. Verify schedule timezone is correct
3. Check job execution history
4. Verify HTTP endpoint is accessible

### Storage Costs Too High

1. Reduce retention period in lifecycle policy
2. Only backup specific collections (modify export command)
3. Consider PITR instead for more efficient backups

---

## Next Steps

1. ✅ Run setup script: `./setup-firestore-backups.sh`
2. ✅ Test a manual backup
3. ✅ Verify Cloud Scheduler job is created
4. ✅ Monitor first scheduled backup
5. ✅ Set up monitoring alerts

---

## Support

For issues or questions:
- [Firestore Documentation](https://cloud.google.com/firestore/docs)
- [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)
- [Firestore Export Documentation](https://cloud.google.com/firestore/docs/manage-data/export-import)

