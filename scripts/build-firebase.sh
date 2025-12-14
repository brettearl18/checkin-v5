#!/bin/bash

# Build script for Firebase Hosting
# This script prepares the Next.js standalone build for Firebase Hosting
# Note: npm run build should be called before this script

set -e

echo "📦 Preparing Firebase Hosting files..."

# Copy public folder to standalone output
if [ -d "public" ]; then
  echo "📁 Copying public folder..."
  cp -r public .next/standalone/ 2>/dev/null || true
fi

# Copy .next/static to standalone output
if [ -d ".next/static" ]; then
  echo "📁 Copying static files..."
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/
fi

echo "✅ Build preparation complete! Ready for Firebase deployment."
echo "🚀 Run 'firebase deploy --only hosting' to deploy"

