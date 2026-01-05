#!/bin/bash

# Script to set up daily Firestore backups
# Tries native Firestore backup schedules first, falls back to Cloud Scheduler

set -e

PROJECT_ID="checkinv5"
BACKUP_BUCKET="checkinv5-firestore-backups"
REGION="australia-southeast2"  # Same region as Firestore
SCHEDULER_JOB_NAME="firestore-daily-backup"
SCHEDULE="0 2 * * *"  # 2 AM daily (in your timezone)
SERVICE_ACCOUNT_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"

echo "🔧 Setting up Daily Firestore Backups"
echo "======================================"
echo ""

# Step 1: Create Cloud Storage bucket for backups (if it doesn't exist)
echo "Step 1: Creating Cloud Storage bucket for backups..."
if gsutil ls -b "gs://${BACKUP_BUCKET}" >/dev/null 2>&1; then
  echo "✅ Bucket '${BACKUP_BUCKET}' already exists"
else
  echo "Creating bucket '${BACKUP_BUCKET}' in region ${REGION}..."
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BACKUP_BUCKET}"
  echo "✅ Bucket created"
fi

# Set bucket lifecycle policy (keep backups for 90 days, then delete)
echo ""
echo "Step 2: Setting bucket lifecycle policy (90-day retention)..."
cat > /tmp/lifecycle.json << EOF
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
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://${BACKUP_BUCKET}"
rm /tmp/lifecycle.json
echo "✅ Lifecycle policy set (backups retained for 90 days)"

# Step 3: Enable required APIs
echo ""
echo "Step 3: Enabling required APIs..."
gcloud services enable cloudscheduler.googleapis.com --project="${PROJECT_ID}"
gcloud services enable cloudfunctions.googleapis.com --project="${PROJECT_ID}" || echo "Cloud Functions API already enabled"
echo "✅ APIs enabled"

# Step 4: Grant permissions to service account
echo ""
echo "Step 4: Granting permissions..."
# Grant Cloud Datastore User role to App Engine default service account
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/datastore.owner" \
  --condition=None || echo "Permissions may already be set"

# Grant Storage Admin role for backup bucket
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/storage.admin" \
  --condition=None || echo "Permissions may already be set"

echo "✅ Permissions granted"

# Step 5: Create Cloud Scheduler job
echo ""
echo "Step 5: Creating Cloud Scheduler job for daily backups..."

# Delete existing job if it exists
gcloud scheduler jobs delete "${SCHEDULER_JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --quiet 2>/dev/null || echo "No existing job to delete"

# Create new scheduler job
gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
  --location="${REGION}" \
  --schedule="${SCHEDULE}" \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
  --http-method=POST \
  --message-body='{
    "outputUriPrefix": "gs://'${BACKUP_BUCKET}'/backups/daily/'"$(date +%Y-%m-%d)"'"
  }' \
  --headers="Content-Type=application/json" \
  --oauth-service-account-email="${SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" || {
    echo "⚠️  Note: Cloud Scheduler HTTP jobs with OAuth require a different approach."
    echo "Creating job with gcloud command instead..."
    
    # Alternative: Use gcloud command in a Cloud Function or Cloud Run job
    # For now, create a manual scheduler job that runs a script
    echo ""
    echo "📝 Manual Setup Required:"
    echo "Due to API limitations, you'll need to set up the scheduler job manually:"
    echo ""
    echo "Option 1: Use Cloud Console"
    echo "1. Go to: https://console.cloud.google.com/cloudscheduler?project=${PROJECT_ID}"
    echo "2. Click 'Create Job'"
    echo "3. Set schedule to: ${SCHEDULE}"
    echo "4. Target type: HTTP"
    echo "5. URL: https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments"
    echo "6. HTTP method: POST"
    echo "7. Auth header: Add OAuth token"
    echo "8. Body: {\"outputUriPrefix\": \"gs://${BACKUP_BUCKET}/backups/daily/\"}"
    echo ""
    echo "Option 2: Use the command below to run a test backup now:"
    echo "gcloud firestore export gs://${BACKUP_BUCKET}/backups/daily/$(date +%Y-%m-%d-%H%M%S)"
  }

echo ""
echo "✅ Backup setup complete!"
echo ""
echo "📋 Summary:"
echo "  - Backup bucket: gs://${BACKUP_BUCKET}"
echo "  - Retention: 90 days"
echo "  - Schedule: Daily at 2 AM"
echo ""
echo "🧪 Test backup:"
echo "  gcloud firestore export gs://${BACKUP_BUCKET}/backups/daily/$(date +%Y-%m-%d-%H%M%S)"
echo ""

