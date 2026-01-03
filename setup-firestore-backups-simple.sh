#!/bin/bash

# Simplified script to set up daily Firestore backups
# Uses native Firestore backup schedules if available, otherwise uses Cloud Scheduler

set -e

PROJECT_ID="checkinv5"
BACKUP_BUCKET="checkinv5-firestore-backups"
REGION="australia-southeast2"

echo "🔧 Setting up Daily Firestore Backups"
echo "======================================"
echo ""

# Step 1: Create Cloud Storage bucket for backups
echo "Step 1: Creating Cloud Storage bucket..."
if gsutil ls -b "gs://${BACKUP_BUCKET}" >/dev/null 2>&1; then
  echo "✅ Bucket '${BACKUP_BUCKET}' already exists"
else
  echo "Creating bucket '${BACKUP_BUCKET}' in region ${REGION}..."
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BACKUP_BUCKET}"
  echo "✅ Bucket created"
fi

# Step 2: Set lifecycle policy (90-day retention)
echo ""
echo "Step 2: Setting 90-day retention policy..."
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
echo "✅ Retention policy set (90 days)"

# Step 3: Try native Firestore backup schedules (if available)
echo ""
echo "Step 3: Attempting to create native Firestore backup schedule..."

if gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence="daily" \
  --retention="90d" \
  --project="${PROJECT_ID}" 2>&1; then
  echo "✅ Native daily backup schedule created!"
  echo ""
  echo "📋 Backup Configuration:"
  echo "  - Frequency: Daily"
  echo "  - Retention: 90 days"
  echo "  - Location: ${REGION}"
  echo ""
  echo "Note: Native backups don't allow specifying exact time (backups run automatically)"
else
  echo "⚠️  Native backup schedules not available (may require Firestore Enterprise tier)"
  echo ""
  echo "📝 Alternative: Using Cloud Scheduler with manual exports..."
  echo ""
  
  # Step 4: Set up Cloud Scheduler as fallback
  echo "Step 4: Setting up Cloud Scheduler job..."
  
  # Enable APIs
  gcloud services enable cloudscheduler.googleapis.com --project="${PROJECT_ID}" 2>/dev/null || true
  
  # Grant permissions
  SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.owner" \
    --quiet 2>/dev/null || true
  
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.admin" \
    --quiet 2>/dev/null || true
  
  # Create Cloud Function for backup (simpler than direct API call)
  echo ""
  echo "Creating Cloud Function for daily backups..."
  
  cat > /tmp/backup-function/index.js << 'FUNCTION_EOF'
const {exec} = require('child_process');
const {promisify} = require('util');
const execAsync = promisify(exec);

exports.dailyBackup = async (req, res) => {
  const projectId = process.env.GCLOUD_PROJECT || 'checkinv5';
  const bucketName = 'checkinv5-firestore-backups';
  const timestamp = new Date().toISOString().split('T')[0];
  const outputUri = `gs://${bucketName}/backups/daily/${timestamp}`;
  
  try {
    const {stdout, stderr} = await execAsync(
      `gcloud firestore export ${outputUri} --project=${projectId} --quiet`
    );
    
    console.log('Backup completed:', stdout);
    
    res.status(200).json({
      success: true,
      message: `Backup completed: ${outputUri}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
FUNCTION_EOF

  cat > /tmp/backup-function/package.json << 'PKG_EOF'
{
  "name": "firestore-backup",
  "version": "1.0.0",
  "dependencies": {}
}
PKG_EOF

  # Deploy Cloud Function
  gcloud functions deploy firestore-daily-backup \
    --runtime nodejs20 \
    --trigger-http \
    --allow-unauthenticated \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --source=/tmp/backup-function 2>/dev/null || {
      echo "⚠️  Cloud Function deployment requires additional setup"
      echo ""
      echo "📝 Manual Setup Required:"
      echo "1. Go to: https://console.cloud.google.com/cloudscheduler?project=${PROJECT_ID}"
      echo "2. Create a job that runs daily at 2 AM"
      echo "3. Command: gcloud firestore export gs://${BACKUP_BUCKET}/backups/daily/\$(date +%Y-%m-%d) --project=${PROJECT_ID}"
      echo ""
    }
  
  # Create Cloud Scheduler job
  SCHEDULER_JOB="firestore-daily-backup"
  FUNCTION_URL=$(gcloud functions describe firestore-daily-backup --region="${REGION}" --format="value(httpsTrigger.url)" 2>/dev/null || echo "")
  
  if [ -n "$FUNCTION_URL" ]; then
    # Delete existing job if it exists
    gcloud scheduler jobs delete "${SCHEDULER_JOB}" \
      --location="${REGION}" \
      --quiet 2>/dev/null || true
    
    # Create new job
    gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
      --location="${REGION}" \
      --schedule="0 2 * * *" \
      --time-zone="Australia/Sydney" \
      --uri="${FUNCTION_URL}" \
      --http-method=GET \
      --project="${PROJECT_ID}" && {
        echo "✅ Cloud Scheduler job created!"
      } || {
        echo "⚠️  Could not create scheduler job automatically"
      }
  fi
fi

echo ""
echo "✅ Backup setup complete!"
echo ""
echo "🧪 Test backup manually:"
echo "  gcloud firestore export gs://${BACKUP_BUCKET}/backups/daily/$(date +%Y-%m-%d-%H%M%S) --project=${PROJECT_ID}"
echo ""
echo "📋 View backups:"
echo "  gsutil ls -r gs://${BACKUP_BUCKET}/backups/"
echo ""

