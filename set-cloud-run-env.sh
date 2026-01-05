#!/bin/bash

# Script to set environment variables on Cloud Run
# Usage: ./set-cloud-run-env.sh

set -e

echo "🔧 Setting environment variables on Cloud Run..."
echo ""

# Read values from .env.local if it exists
if [ -f .env.local ]; then
  echo "📖 Reading values from .env.local..."
  source .env.local
else
  echo "⚠️  .env.local not found. Please provide values manually."
  echo ""
fi

# Required environment variables
# We'll use the values from .env.local or ask user to provide them

# For FIREBASE_SERVICE_ACCOUNT, we'll need to handle it specially
# Option 1: Use Secret Manager (recommended)
# Option 2: Set as env var (less secure but simpler)

echo "Setting environment variables on Cloud Run service..."
echo ""

# Build the --update-env-vars string
ENV_VARS="NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY:-},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-checkinv5.firebaseapp.com},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-checkinv5},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-checkinv5.appspot.com},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-},"
ENV_VARS+="NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID:-}"

echo "Updating Cloud Run service with environment variables..."
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="$ENV_VARS"

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "⚠️  IMPORTANT: FIREBASE_SERVICE_ACCOUNT still needs to be set."
echo "   Options:"
echo "   1. Use Secret Manager (recommended for security)"
echo "   2. Set as environment variable (see instructions below)"
echo ""






