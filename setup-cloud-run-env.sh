#!/bin/bash

# Script to set environment variables on Cloud Run from .env.local
# This script extracts values and sets them securely on Cloud Run

set -e

echo "🔧 Setting up Cloud Run Environment Variables"
echo "=============================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  echo "Please create .env.local with your Firebase credentials"
  exit 1
fi

echo "📖 Reading values from .env.local..."
source .env.local

# Verify required variables are set
if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
  echo "⚠️  Warning: NEXT_PUBLIC_FIREBASE_API_KEY not found in .env.local"
fi

# Set default values if not provided
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-checkinv5}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-checkinv5.firebaseapp.com}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-checkinv5.appspot.com}

echo ""
echo "Step 1: Setting public Firebase environment variables..."
echo ""

# Build the env vars string for public variables
ENV_VARS="NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}"

# Update Cloud Run service
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="$ENV_VARS"

echo ""
echo "✅ Public environment variables set!"
echo ""

# Handle FIREBASE_SERVICE_ACCOUNT
if [ -n "$FIREBASE_SERVICE_ACCOUNT" ]; then
  echo "Step 2: Setting up FIREBASE_SERVICE_ACCOUNT using Secret Manager..."
  echo ""
  
  # Check if secret already exists
  if gcloud secrets describe firebase-service-account --project=checkinv5 >/dev/null 2>&1; then
    echo "📝 Secret 'firebase-service-account' already exists. Updating..."
    echo -n "$FIREBASE_SERVICE_ACCOUNT" | gcloud secrets versions add firebase-service-account \
      --data-file=- \
      --project=checkinv5
  else
    echo "📝 Creating new secret 'firebase-service-account'..."
    echo -n "$FIREBASE_SERVICE_ACCOUNT" | gcloud secrets create firebase-service-account \
      --data-file=- \
      --project=checkinv5 \
      --replication-policy="automatic"
  fi
  
  echo ""
  echo "🔐 Granting Cloud Run access to the secret..."
  
  # Get the Cloud Run service account
  SERVICE_ACCOUNT=$(gcloud run services describe checkinv5 \
    --region=australia-southeast2 \
    --format="value(spec.template.spec.serviceAccountName)")
  
  if [ -z "$SERVICE_ACCOUNT" ]; then
    # Use default compute service account
    SERVICE_ACCOUNT="checkinv5-compute@developer.gserviceaccount.com"
  fi
  
  # Grant access
  gcloud secrets add-iam-policy-binding firebase-service-account \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=checkinv5 \
    --quiet || echo "⚠️  Permission may already be set"
  
  echo ""
  echo "🔗 Linking secret to Cloud Run service..."
  gcloud run services update checkinv5 \
    --region=australia-southeast2 \
    --update-secrets="FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest"
  
  echo ""
  echo "✅ FIREBASE_SERVICE_ACCOUNT configured securely using Secret Manager!"
else
  echo "⚠️  FIREBASE_SERVICE_ACCOUNT not found in .env.local"
  echo "   You'll need to set this manually. See CLOUD_RUN_ENV_SETUP.md for instructions."
fi

echo ""
echo "🎉 Environment variables setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy Firebase Hosting: firebase deploy --only hosting"
echo "2. Test your service: Visit https://checkinv5.web.app"
echo ""

